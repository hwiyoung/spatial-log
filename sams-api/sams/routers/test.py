"""
개발용 테스트 엔드포인트. 운영 배포 시 제거.
"""

import os
import tempfile
from pathlib import Path
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import HTMLResponse

from sams.pipeline.detect import detect_category
from sams.pipeline.bundle import bundle_files
from sams.pipeline.extract import extract_metadata

router = APIRouter()


@router.post("/test/detect")
async def test_detect(file: UploadFile = File(...)):
    """파일을 업로드하면 유형 판별 결과를 반환한다."""
    suffix = os.path.splitext(file.filename or "")[1]
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = detect_category(tmp_path)
        return {
            "filename": file.filename,
            "size_bytes": len(content),
            "detected_category": result.category,
            "confidence": result.confidence,
            "warning": result.warning,
        }
    finally:
        os.unlink(tmp_path)


@router.post("/test/detect-batch")
async def test_detect_batch(files: list[UploadFile] = File(...)):
    """여러 파일을 업로드하여 번들링 + 유형 판별."""
    # 1) 임시 디렉토리에 파일 저장 (원본 파일명 유지)
    tmp_dir = tempfile.mkdtemp()
    saved: dict[str, dict] = {}  # tmp_path → {filename, size}
    for file in files:
        safe_name = file.filename or "unknown"
        tmp_path = os.path.join(tmp_dir, safe_name)
        content = await file.read()
        with open(tmp_path, "wb") as f:
            f.write(content)
        saved[tmp_path] = {"filename": safe_name, "size_bytes": len(content)}

    try:
        # 2) 번들링
        groups = bundle_files(list(saved.keys()))

        # 3) 각 그룹의 primary_file에 대해 유형 판별 + 메타데이터 추출
        bundle_results = []
        for group in groups:
            primary = group.primary_file
            info = saved.get(primary, {"filename": Path(primary).name, "size_bytes": 0})
            result = detect_category(primary)

            bundled_info = []
            for bf in group.bundled_files:
                bi = saved.get(bf, {"filename": Path(bf).name, "size_bytes": 0})
                bundled_info.append(bi)

            # 메타데이터 추출
            extracted = extract_metadata(
                primary,
                result.category,
                bundled_files=group.bundled_files if group.bundled_files else None,
            )

            bundle_results.append({
                "filename": info["filename"],
                "size_bytes": info["size_bytes"],
                "detected_category": result.category,
                "confidence": result.confidence,
                "warning": result.warning,
                "group_type": group.group_type,
                "bundled_files": [b["filename"] for b in bundled_info],
                "extracted_metadata": extracted,
            })

        return {"results": bundle_results, "total": len(bundle_results)}
    finally:
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.get("/test", response_class=HTMLResponse)
async def test_page():
    """파일 유형 판별 테스트 페이지."""
    return """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>SAMS — 파일 유형 판별 테스트</title>
<style>
  :root{--bg:#0C0E14;--s1:#13161F;--s2:#1A1E2A;--bd:#2C3044;--ac:#4A72FF;--t1:#E4E7F0;--t2:#94A0B8;--t3:#5C6478;--ok:#3DD68C;--warn:#F0B42A;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Noto Sans KR',sans-serif;background:var(--bg);color:var(--t1);min-height:100vh;padding:40px 20px;}
  .wrap{max-width:800px;margin:0 auto;}
  h1{font-size:20px;font-weight:700;margin-bottom:6px;}
  .sub{font-size:12px;color:var(--t3);margin-bottom:24px;}
  .dropzone{border:2px dashed var(--bd);border-radius:12px;padding:48px 20px;text-align:center;cursor:pointer;transition:.2s;margin-bottom:20px;}
  .dropzone:hover,.dropzone.over{border-color:var(--ac);background:rgba(74,114,255,.03);}
  .dropzone p{font-size:14px;color:var(--t2);margin-bottom:8px;}
  .dropzone small{font-size:11px;color:var(--t3);}
  input[type=file]{display:none;}
  .results{margin-top:16px;}
  .result-item{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--s1);border:1px solid var(--bd);border-radius:8px;margin-bottom:6px;}
  .result-icon{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}
  .result-body{flex:1;min-width:0;}
  .result-name{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .result-meta{font-size:10px;color:var(--t3);margin-top:2px;}
  .result-cat{padding:4px 10px;border-radius:5px;font-size:11px;font-weight:600;flex-shrink:0;}
  .result-warn{font-size:10px;color:var(--warn);margin-top:4px;}
  .loading{text-align:center;padding:20px;color:var(--t3);font-size:12px;}
  .summary{padding:12px 16px;background:var(--s2);border-radius:8px;margin-bottom:12px;font-size:12px;color:var(--t2);}
  .summary b{color:var(--t1);}
  .meta-toggle{font-size:10px;color:var(--ac);cursor:pointer;margin-left:8px;text-decoration:underline;}
  .meta-panel{display:none;margin-top:8px;padding:10px 12px;background:var(--s2);border:1px solid var(--bd);border-radius:6px;font-size:11px;font-family:'Fira Code',monospace;line-height:1.6;}
  .meta-panel.open{display:block;}
  .meta-key{color:var(--ac);font-weight:600;}
  .meta-val{color:var(--t1);}
  .meta-src{font-size:9px;color:var(--t3);margin-left:4px;}
</style>
</head>
<body>
<div class="wrap">
  <h1>SAMS 자동 채움 파이프라인 테스트</h1>
  <p class="sub">파일을 드래그하거나 클릭하여 업로드하면 0단계(그룹핑) + 1단계(유형 판별) + 2단계(메타데이터 추출) 결과를 확인합니다.</p>

  <div class="dropzone" id="dropzone">
    <p>파일을 여기에 드래그하세요</p>
    <small>또는 클릭하여 선택 (여러 파일 가능)</small>
  </div>
  <input type="file" id="fileInput" multiple>

  <div id="loading" class="loading" style="display:none;">분석 중...</div>
  <div id="summary" class="summary" style="display:none;"></div>
  <div id="results" class="results"></div>
</div>

<script>
const CATS = {
  pointcloud:{icon:"\\u29BF",color:"#E05555",label:"포인트 클라우드"},
  "3d_model":{icon:"\\u25B3",color:"#6AAF50",label:"3D 모델"},
  "3d_tiles":{icon:"\\u25A6",color:"#50AAAF",label:"3D Tiles"},
  orthoimage:{icon:"\\u25A8",color:"#9055C8",label:"정사영상"},
  image:{icon:"\\u25A3",color:"#35A5E0",label:"원본 이미지"},
  panorama:{icon:"\\u25C9",color:"#E87830",label:"파노라마"},
  video:{icon:"\\u25B6",color:"#E04040",label:"동영상"},
  document:{icon:"\\u25A4",color:"#8899AA",label:"문헌정보"},
  unknown:{icon:"?",color:"#5C6478",label:"판별 불가"},
};

function formatSize(b){
  if(b<1024)return b+" B";
  if(b<1048576)return (b/1024).toFixed(1)+" KB";
  if(b<1073741824)return (b/1048576).toFixed(1)+" MB";
  return (b/1073741824).toFixed(1)+" GB";
}

const dz=document.getElementById("dropzone");
const fi=document.getElementById("fileInput");
const resDiv=document.getElementById("results");
const loadDiv=document.getElementById("loading");
const sumDiv=document.getElementById("summary");

dz.addEventListener("click",()=>fi.click());
dz.addEventListener("dragover",e=>{e.preventDefault();dz.classList.add("over");});
dz.addEventListener("dragleave",()=>dz.classList.remove("over"));
dz.addEventListener("drop",e=>{e.preventDefault();dz.classList.remove("over");upload(e.dataTransfer.files);});
fi.addEventListener("change",()=>upload(fi.files));

async function upload(files){
  if(!files.length)return;
  loadDiv.style.display="block";
  resDiv.innerHTML="";
  sumDiv.style.display="none";

  const fd=new FormData();
  for(const f of files) fd.append("files",f);

  try{
    const r=await fetch("/api/test/detect-batch",{method:"POST",body:fd});
    const data=await r.json();
    loadDiv.style.display="none";

    // summary
    const counts={};
    const gtypes={single:0,"3d_model_bundle":0,image_set:0,"3d_tiles":0};
    data.results.forEach(r=>{counts[r.detected_category]=(counts[r.detected_category]||0)+1;gtypes[r.group_type]=(gtypes[r.group_type]||0)+1;});
    const parts=Object.entries(counts).map(([k,v])=>{
      const c=CATS[k]||CATS.unknown;
      return `<span style="color:${c.color}">${c.icon} ${c.label}: <b>${v}</b></span>`;
    }).join("&nbsp;&nbsp;");
    const bundles=data.results.filter(r=>r.group_type!=="single").length;
    const bundleInfo=bundles>0?` &nbsp;|&nbsp; 번들: <b>${bundles}</b>건`:"";
    sumDiv.innerHTML=`전체 <b>${data.total}</b> Item${bundleInfo} &nbsp;|&nbsp; ${parts}`;
    sumDiv.style.display="block";

    // items
    const GT={single:"단독","3d_model_bundle":"3D모델 번들",image_set:"이미지 세트","3d_tiles":"3D Tiles"};
    const GC={single:"var(--t3)","3d_model_bundle":"#6AAF50",image_set:"#35A5E0","3d_tiles":"#50AAAF"};
    data.results.forEach((r,idx)=>{
      const c=CATS[r.detected_category]||CATS.unknown;
      const warn=r.warning?`<div class="result-warn">\\u26A0 ${r.warning}</div>`:"";
      const gtLabel=GT[r.group_type]||r.group_type;
      const gtColor=GC[r.group_type]||"var(--t3)";
      const bundled=r.bundled_files&&r.bundled_files.length>0
        ?`<div style="margin-top:4px;font-size:10px;color:var(--t2);">\\u2514 동반 파일: ${r.bundled_files.join(", ")}</div>`
        :"";
      const gtBadge=r.group_type!=="single"
        ?`<span style="padding:2px 6px;border-radius:3px;font-size:9px;background:${gtColor}18;color:${gtColor};margin-left:6px;">${gtLabel}</span>`
        :"";
      const metaId=`meta-${idx}`;
      const meta=r.extracted_metadata||{};
      const metaKeys=Object.keys(meta).filter(k=>!k.startsWith('_'));
      const metaCount=metaKeys.length;
      const metaHtml=metaKeys.map(k=>{
        let v=meta[k];
        if(typeof v==='object'&&v!==null)v=JSON.stringify(v);
        return `<div><span class="meta-key">${k}</span>: <span class="meta-val">${v===null?'<em style="color:var(--t3)">null</em>':v}</span></div>`;
      }).join('');
      const srcInfo=meta._epsg_source?` · EPSG source: ${meta._epsg_source}`:'';
      resDiv.innerHTML+=`
        <div class="result-item" style="flex-wrap:wrap;">
          <div class="result-icon" style="background:${c.color}18;color:${c.color}">${c.icon}</div>
          <div class="result-body">
            <div class="result-name">${r.filename}${gtBadge}
              ${metaCount>0?`<span class="meta-toggle" onclick="document.getElementById('${metaId}').classList.toggle('open')">\\u25B6 메타데이터 (${metaCount})</span>`:''}
            </div>
            <div class="result-meta">${formatSize(r.size_bytes)} · confidence: ${(r.confidence*100).toFixed(0)}%${srcInfo}</div>
            ${warn}${bundled}
            <div id="${metaId}" class="meta-panel">${metaHtml||'<em style="color:var(--t3)">추출된 메타데이터 없음</em>'}</div>
          </div>
          <div class="result-cat" style="background:${c.color}18;color:${c.color}">${c.label}</div>
        </div>`;
    });
  }catch(e){
    loadDiv.style.display="none";
    resDiv.innerHTML=`<div style="color:#F06060;padding:20px;text-align:center;">오류: ${e.message}</div>`;
  }
}
</script>
</body>
</html>"""
