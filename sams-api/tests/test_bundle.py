"""
Tests for pipeline bundle.py — 0단계 파일 그룹핑

참조: docs/autofill_pipeline_spec.md 섹션 2.1
"""

import pytest
from pathlib import Path

from sams.pipeline.bundle import bundle_files, FileGroup


class TestObjBundle:
    """OBJ + MTL + 텍스처 참조 번들."""

    def test_obj_with_mtl_and_texture(self, tmp_path):
        """OBJ가 MTL을 참조하고, MTL이 텍스처를 참조하면 하나의 번들."""
        (tmp_path / "model.obj").write_text("mtllib model.mtl\nv 0 0 0\n")
        (tmp_path / "model.mtl").write_text("newmtl mat1\nmap_Kd model.jpg\n")
        (tmp_path / "model.jpg").write_bytes(b"\xff\xd8\xff\xe0")

        files = [str(tmp_path / f) for f in ["model.obj", "model.mtl", "model.jpg"]]
        groups = bundle_files(files)

        assert len(groups) == 1
        g = groups[0]
        assert g.group_type == "3d_model_bundle"
        assert "model.obj" in g.primary_file
        assert len(g.bundled_files) == 2  # mtl + jpg

    def test_obj_only_without_mtl(self, tmp_path):
        """OBJ에 mtllib이 없으면 단독 번들."""
        (tmp_path / "solo.obj").write_text("v 0 0 0\nv 1 0 0\n")

        groups = bundle_files([str(tmp_path / "solo.obj")])

        assert len(groups) == 1
        assert groups[0].group_type == "3d_model_bundle"
        assert groups[0].bundled_files == []

    def test_obj_does_not_consume_unrelated_images(self, tmp_path):
        """OBJ가 참조하지 않는 이미지는 번들에 포함되지 않는다."""
        (tmp_path / "model.obj").write_text("mtllib model.mtl\n")
        (tmp_path / "model.mtl").write_text("newmtl mat1\nmap_Kd texture.png\n")
        (tmp_path / "texture.png").write_bytes(b"\x89PNG")
        (tmp_path / "photo1.jpg").write_bytes(b"\xff\xd8")
        (tmp_path / "photo2.jpg").write_bytes(b"\xff\xd8")

        files = [str(tmp_path / f) for f in [
            "model.obj", "model.mtl", "texture.png", "photo1.jpg", "photo2.jpg"
        ]]
        groups = bundle_files(files)

        obj_group = [g for g in groups if g.group_type == "3d_model_bundle"][0]
        assert len(obj_group.bundled_files) == 2  # mtl + texture.png만
        # photo1, photo2는 단독
        singles = [g for g in groups if g.group_type == "single"]
        assert len(singles) == 2

    def test_real_world_pattern(self, tmp_path):
        """실무 패턴: OBJ+MTL+텍스처1장 + 독립 이미지 10장."""
        (tmp_path / "삼양.obj").write_text("mtllib 삼양.mtl\n")
        (tmp_path / "삼양.mtl").write_text("newmtl mat1\nmap_Kd 삼양.jpg\n")
        (tmp_path / "삼양.jpg").write_bytes(b"\xff\xd8")

        for i in range(1, 11):
            (tmp_path / f"삼양{i}.jpg").write_bytes(b"\xff\xd8")

        files = [str(tmp_path / "삼양.obj"), str(tmp_path / "삼양.mtl"), str(tmp_path / "삼양.jpg")]
        files += [str(tmp_path / f"삼양{i}.jpg") for i in range(1, 11)]

        groups = bundle_files(files)

        types = {g.group_type for g in groups}
        assert "3d_model_bundle" in types
        assert "image_set" in types

        obj_group = [g for g in groups if g.group_type == "3d_model_bundle"][0]
        assert len(obj_group.all_files) == 3  # obj + mtl + 삼양.jpg

        img_group = [g for g in groups if g.group_type == "image_set"][0]
        assert len(img_group.all_files) == 10  # 삼양1~10.jpg


class TestImageSet:
    """이미지 세트 번들."""

    def test_more_than_5_images(self, tmp_path):
        """6장 이상이면 이미지 세트로 묶임."""
        files = []
        for i in range(8):
            p = tmp_path / f"photo_{i}.jpg"
            p.write_bytes(b"\xff\xd8")
            files.append(str(p))

        groups = bundle_files(files)

        assert len(groups) == 1
        assert groups[0].group_type == "image_set"
        assert len(groups[0].all_files) == 8

    def test_more_than_5_png_images(self, tmp_path):
        """PNG 원본 이미지도 6장 이상이면 이미지 세트로 묶임."""
        files = []
        for i in range(1, 16):
            p = tmp_path / f"240911_펼쳐성수_준공사진_스컷_{i:02d}.png"
            p.write_bytes(b"\x89PNG")
            files.append(str(p))

        groups = bundle_files(files)

        assert len(groups) == 1
        assert groups[0].group_type == "image_set"
        assert len(groups[0].all_files) == 15

    def test_5_or_fewer_images_stay_single(self, tmp_path):
        """5장 이하면 개별 파일로 유지."""
        files = []
        for i in range(4):
            p = tmp_path / f"photo_{i}.jpg"
            p.write_bytes(b"\xff\xd8")
            files.append(str(p))

        groups = bundle_files(files)

        assert len(groups) == 4
        assert all(g.group_type == "single" for g in groups)


class TestTiles:
    """3D Tiles 번들."""

    def test_tileset_json_bundles_folder(self, tmp_path):
        """tileset.json이 있으면 같은 폴더를 묶음."""
        (tmp_path / "tileset.json").write_text('{"asset":{"version":"1.1"}}')
        (tmp_path / "tile1.b3dm").write_bytes(b"b3dm")
        (tmp_path / "tile2.b3dm").write_bytes(b"b3dm")

        files = [str(tmp_path / f) for f in ["tileset.json", "tile1.b3dm", "tile2.b3dm"]]
        groups = bundle_files(files)

        assert len(groups) == 1
        assert groups[0].group_type == "3d_tiles"
        assert len(groups[0].all_files) == 3


class TestPriority:
    """우선순위: 3D Tiles > OBJ > 이미지 세트."""

    def test_tiles_takes_priority(self, tmp_path):
        """tileset.json 폴더의 파일은 다른 규칙에 잡히지 않는다."""
        (tmp_path / "tileset.json").write_text("{}")
        for i in range(8):
            (tmp_path / f"tile_{i}.jpg").write_bytes(b"\xff\xd8")

        files = [str(tmp_path / "tileset.json")]
        files += [str(tmp_path / f"tile_{i}.jpg") for i in range(8)]

        groups = bundle_files(files)

        assert len(groups) == 1
        assert groups[0].group_type == "3d_tiles"


class TestSingleFiles:
    """단독 파일 처리."""

    def test_unrelated_files_stay_single(self, tmp_path):
        """관련 없는 파일들은 각각 단독 그룹."""
        (tmp_path / "scan.las").write_bytes(b"")
        (tmp_path / "report.pdf").write_bytes(b"")
        (tmp_path / "video.mp4").write_bytes(b"")

        files = [str(tmp_path / f) for f in ["scan.las", "report.pdf", "video.mp4"]]
        groups = bundle_files(files)

        assert len(groups) == 3
        assert all(g.group_type == "single" for g in groups)

    def test_empty_input(self):
        """빈 입력."""
        assert bundle_files([]) == []
