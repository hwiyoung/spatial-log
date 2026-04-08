"""
0단계: 파일 그룹핑 (Bundling)

업로드된 파일 목록을 분석하여, 논리적으로 하나의 Item을 구성하는 파일들을 묶는다.
그룹핑 후 각 그룹 단위로 1단계(detect) 이후 파이프라인이 진행된다.

핵심 규칙:
- OBJ/PLY: 내부 참조(mtllib, map_Kd 등)를 파싱하여 실제 참조 파일만 번들
- 이미지 세트: OBJ 번들에 포함되지 않은 이미지가 5장 초과 시 하나의 세트로 묶음
- 3D Tiles: tileset.json 존재 시 폴더 전체를 하나의 Item으로 번들
- 우선순위: 3D Tiles > OBJ/PLY 참조 번들 > 이미지 세트 > 단독 파일

참조: docs/autofill_pipeline_spec.md 섹션 2.1
"""

import re
from pathlib import Path
from dataclasses import dataclass, field


@dataclass
class FileGroup:
    """번들된 파일 그룹. 하나의 STAC Item 후보."""
    primary_file: str
    bundled_files: list[str] = field(default_factory=list)
    group_type: str = "single"  # single, 3d_model_bundle, image_set, 3d_tiles

    @property
    def all_files(self) -> list[str]:
        return [self.primary_file] + self.bundled_files


def bundle_files(file_paths: list[str]) -> list[FileGroup]:
    """파일 목록을 분석하여 그룹으로 묶는다.

    Args:
        file_paths: 업로드된 파일 경로 목록

    Returns:
        FileGroup 목록. 각 그룹이 하나의 Item 후보.
    """
    paths = [Path(p) for p in file_paths]
    consumed: set[str] = set()  # 이미 그룹에 포함된 파일
    groups: list[FileGroup] = []

    path_map = {p.name.lower(): p for p in paths}

    # 1) 3D Tiles: tileset.json이 있으면 같은 폴더 전체를 묶음
    for p in paths:
        if p.name.lower() == "tileset.json" and str(p) not in consumed:
            folder = p.parent
            folder_files = [str(f) for f in paths if _is_under(f, folder)]
            consumed.update(folder_files)
            groups.append(FileGroup(
                primary_file=str(p),
                bundled_files=[f for f in folder_files if f != str(p)],
                group_type="3d_tiles",
            ))

    # 2) OBJ 참조 번들: .obj → .mtl → 텍스처 파싱
    for p in paths:
        if p.suffix.lower() == ".obj" and str(p) not in consumed:
            bundle = _parse_obj_references(p, paths, consumed)
            if bundle:
                consumed.update(bundle.all_files)
                groups.append(bundle)

    # 3) PLY + 텍스처 번들 (파일명 prefix 매칭, face 있는 PLY만)
    for p in paths:
        if p.suffix.lower() == ".ply" and str(p) not in consumed:
            if _ply_has_faces(p):
                bundle = _match_prefix_textures(p, paths, consumed)
                consumed.update(bundle.all_files)
                groups.append(bundle)

    # 4) 이미지 세트: 아직 소비되지 않은 이미지가 5장 초과
    image_exts = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}
    remaining_images = [
        p for p in paths
        if p.suffix.lower() in image_exts and str(p) not in consumed
    ]
    if len(remaining_images) > 5:
        primary = remaining_images[0]
        rest = remaining_images[1:]
        img_files = [str(f) for f in remaining_images]
        consumed.update(img_files)
        groups.append(FileGroup(
            primary_file=str(primary),
            bundled_files=[str(f) for f in rest],
            group_type="image_set",
        ))

    # 5) 동영상 + SRT 번들: 같은 이름의 .srt 파일을 동반 파일로 묶음
    video_exts = {".mp4", ".mov", ".avi", ".mkv"}
    for p in paths:
        if p.suffix.lower() in video_exts and str(p) not in consumed:
            srt = _find_companion(p, ".srt", paths, consumed)
            if srt:
                consumed.update([str(p), str(srt)])
                groups.append(FileGroup(
                    primary_file=str(p),
                    bundled_files=[str(srt)],
                    group_type="video_bundle",
                ))

    # 6) 나머지: 단독 파일
    for p in paths:
        if str(p) not in consumed:
            groups.append(FileGroup(primary_file=str(p), group_type="single"))

    return groups


def _parse_obj_references(obj_path: Path, all_paths: list[Path], consumed: set[str]) -> FileGroup | None:
    """OBJ 파일 내부의 mtllib 참조 → MTL 내부의 텍스처 참조를 파싱하여 번들."""
    try:
        obj_text = obj_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return FileGroup(primary_file=str(obj_path), group_type="3d_model_bundle")

    bundled: list[str] = []
    obj_dir = obj_path.parent

    # mtllib 참조 찾기
    mtl_names = re.findall(r"^mtllib\s+(.+)$", obj_text, re.MULTILINE)

    for mtl_name in mtl_names:
        mtl_name = mtl_name.strip()
        mtl_file = _find_file(mtl_name, obj_dir, all_paths, consumed)
        if mtl_file:
            bundled.append(str(mtl_file))
            # MTL 내부 텍스처 참조 파싱
            tex_files = _parse_mtl_textures(mtl_file, obj_dir, all_paths, consumed, bundled)
            bundled.extend(tex_files)

    return FileGroup(
        primary_file=str(obj_path),
        bundled_files=bundled,
        group_type="3d_model_bundle",
    )


def _parse_mtl_textures(
    mtl_path: Path,
    obj_dir: Path,
    all_paths: list[Path],
    consumed: set[str],
    already_bundled: list[str],
) -> list[str]:
    """MTL 파일에서 텍스처 참조(map_Kd, map_Ka 등)를 파싱."""
    texture_keywords = [
        "map_Kd", "map_Ka", "map_Ks", "map_Ns", "map_d",
        "map_bump", "bump", "disp", "decal", "norm",
    ]
    pattern = re.compile(
        r"^\s*(?:" + "|".join(texture_keywords) + r")\s+(.+)$",
        re.MULTILINE | re.IGNORECASE,
    )
    try:
        mtl_text = mtl_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return []

    tex_files: list[str] = []
    already = set(already_bundled) | consumed

    for match in pattern.finditer(mtl_text):
        tex_name = match.group(1).strip()
        # MTL의 map 옵션(-s, -o 등)을 제거하고 마지막 토큰을 파일명으로
        tex_name = _extract_filename_from_map_line(tex_name)
        tex_file = _find_file(tex_name, obj_dir, all_paths, already)
        if tex_file and str(tex_file) not in already:
            tex_files.append(str(tex_file))
            already.add(str(tex_file))

    return tex_files


def _extract_filename_from_map_line(line: str) -> str:
    """MTL의 map_ 라인에서 옵션을 제거하고 파일명만 추출.

    예: "-s 1 1 1 -o 0 0 0 texture.png" → "texture.png"
    """
    tokens = line.split()
    i = 0
    while i < len(tokens):
        if tokens[i].startswith("-"):
            # 옵션 + 값 건너뛰기 (-s x y z, -o x y z 등)
            opt = tokens[i]
            i += 1
            if opt in ("-s", "-o", "-t"):
                i += 3  # 3개 값
            elif opt in ("-mm",):
                i += 2  # 2개 값
            elif opt in ("-blendu", "-blendv", "-cc", "-clamp", "-texres", "-bm", "-imfchan"):
                i += 1  # 1개 값
        else:
            # 옵션이 아닌 첫 토큰부터 끝까지가 파일명 (공백 포함 가능)
            return " ".join(tokens[i:])
    return tokens[-1] if tokens else line


def _find_file(name: str, base_dir: Path, all_paths: list[Path], consumed: set[str]) -> Path | None:
    """이름으로 파일을 찾는다. 정확히 일치 → 대소문자 무시 → base_dir 기준 상대 경로."""
    name_lower = name.lower()
    # 업로드된 파일 목록에서 찾기
    for p in all_paths:
        if str(p) in consumed:
            continue
        if p.name == name or p.name.lower() == name_lower:
            return p
    # base_dir 기준 상대 경로로 찾기
    candidate = base_dir / name
    for p in all_paths:
        if str(p) in consumed:
            continue
        try:
            if p.resolve() == candidate.resolve():
                return p
        except OSError:
            continue
    return None


def _match_prefix_textures(ply_path: Path, all_paths: list[Path], consumed: set[str]) -> FileGroup:
    """PLY 파일명 prefix와 일치하는 텍스처를 번들."""
    texture_exts = {".jpg", ".jpeg", ".png", ".tga", ".bmp"}
    prefix = ply_path.stem.lower()
    bundled = []
    for p in all_paths:
        if str(p) in consumed or p == ply_path:
            continue
        if p.suffix.lower() in texture_exts and p.stem.lower().startswith(prefix):
            if p.parent == ply_path.parent:
                bundled.append(str(p))
    return FileGroup(
        primary_file=str(ply_path),
        bundled_files=bundled,
        group_type="3d_model_bundle",
    )


def _ply_has_faces(path: Path) -> bool:
    """PLY 헤더에 element face가 있는지 확인."""
    try:
        with open(path, "rb") as f:
            header = f.read(2048).decode("ascii", errors="ignore")
        return "element face" in header
    except OSError:
        return False


def _find_companion(primary: Path, ext: str, all_paths: list[Path], consumed: set[str]) -> Path | None:
    """primary와 같은 stem, 다른 확장자를 가진 동반 파일을 찾는다."""
    stem_lower = primary.stem.lower()
    ext_lower = ext.lower()
    for p in all_paths:
        if str(p) in consumed or p == primary:
            continue
        if p.suffix.lower() == ext_lower and p.stem.lower() == stem_lower:
            return p
    return None


def _is_under(path: Path, folder: Path) -> bool:
    """path가 folder 하위에 있는지."""
    try:
        path.resolve().relative_to(folder.resolve())
        return True
    except ValueError:
        return False
