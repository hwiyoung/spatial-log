import { useState, useMemo } from "react";

/* ═══════════════════════════════════════════════════════
   SAMS — Spatial Asset Management System
   통합 데모 (Explorer + Detail + Project + Upload)
   모든 페이지가 네비게이션으로 연결됩니다
   ═══════════════════════════════════════════════════════ */

// ── Shared Data ──
const CATS = {
  pointcloud:{label:"PC",full:"포인트 클라우드",icon:"⦿",color:"#E05555"},
  "3d_model":{label:"3D",full:"3D 모델",icon:"△",color:"#6AAF50"},
  orthoimage:{label:"정사",full:"정사영상",icon:"▨",color:"#9055C8"},
  image:{label:"이미지",full:"원본 이미지",icon:"▣",color:"#35A5E0"},
  panorama:{label:"파노",full:"파노라마",icon:"◉",color:"#E87830"},
  video:{label:"영상",full:"동영상",icon:"▶",color:"#E04040"},
  document:{label:"문서",full:"문헌정보",icon:"▤",color:"#8899AA"},
};

const COLLS = [
  {id:"bulguksa-2024",title:"2024 불국사 정밀실측",site:"경주 불국사",client:"문화재청",pm:"홍길동",start:"2024-03",end:"2024-06",epsg:5186,status:"active",
    expected:[{cat:"pointcloud",count:3,desc:"다보탑,석가탑,대웅전"},{cat:"3d_model",count:2,desc:"다보탑,석가탑"},{cat:"orthoimage",count:1,desc:"전체"},{cat:"image",count:2,desc:"다보탑,석가탑 세트"},{cat:"panorama",count:3,desc:"대웅전,다보탑,석가탑"},{cat:"video",count:1,desc:"드론"},{cat:"document",count:3,desc:"보고서,일지,허가서"}]},
  {id:"haeinsa-2024",title:"2024 해인사 장경판전",site:"합천 해인사",client:"문화재청",pm:"김과장",start:"2024-06",end:"2024-09",epsg:5186,status:"active",expected:[{cat:"pointcloud",count:2},{cat:"3d_model",count:1}]},
  {id:"bulguksa-2023",title:"2023 불국사 모니터링",site:"경주 불국사",client:"경주시",pm:"박대리",start:"2023-05",end:"2023-08",epsg:5186,status:"completed",expected:[{cat:"pointcloud",count:1}]},
];

const ITEMS = [
  {id:"bg-dt-pc-24",title:"다보탑 LiDAR 스캔",cat:"pointcloud",coll:"bulguksa-2024",site:"경주 불국사",target:"다보탑",date:"2024-03-12",size:"2.1GB",epsg:5186,status:"published",mx:55,my:40,
    auto:{"pc:count":"15,230,482","pc:density":"248 pts/m²","pc:encoding":"LAZ","pc:las_version":"1.4","pc:has_rgb":"true"},
    manual:{"pc:type":"lidar","pc:scanner":"Leica RTC360","pc:stations":"12","pc:error":"0.003m"},
    desc:"다보탑 전면부 및 측면부 LiDAR 스캔. 12개 스테이션, 정합 완료.",
    links:[{rel:"related",tid:"bg-dt-3d-24"},{rel:"related",tid:"bg-dt-img-24"},{rel:"describedby",tid:"bg-report-24"},{rel:"prev",tid:"bg-dt-pc-23"}]},
  {id:"bg-sg-pc-24",title:"석가탑 LiDAR 스캔",cat:"pointcloud",coll:"bulguksa-2024",site:"경주 불국사",target:"석가탑",date:"2024-03-12",size:"1.9GB",epsg:5186,status:"published",mx:45,my:43,
    auto:{"pc:count":"12,150,000","pc:density":"195 pts/m²","pc:encoding":"LAZ"},manual:{"pc:type":"lidar","pc:scanner":"Leica RTC360"},desc:"석가탑 스캔",links:[]},
  {id:"bg-dj-pc-24",title:"대웅전 LiDAR 스캔",cat:"pointcloud",coll:"bulguksa-2024",site:"경주 불국사",target:"대웅전",date:"2024-03-12",size:"4.3GB",epsg:5186,status:"published",mx:48,my:58,
    auto:{"pc:count":"28,400,000","pc:density":"310 pts/m²","pc:encoding":"LAZ"},manual:{"pc:type":"lidar","pc:scanner":"Leica RTC360"},desc:"대웅전 스캔",links:[]},
  {id:"bg-dt-3d-24",title:"다보탑 포토그래메트리 모델",cat:"3d_model",coll:"bulguksa-2024",site:"경주 불국사",target:"다보탑",date:"2024-03-15",size:"856MB",epsg:5186,status:"published",mx:57,my:38,
    auto:{"vertex":"1,250,000","face":"2,500,000","texture":"4장 4096×4096","has_normals":"true"},manual:{"method":"photogrammetry","software":"Metashape 2.0"},desc:"다보탑 포토그래메트리 모델",links:[{rel:"derived_from",tid:"bg-dt-pc-24"}]},
  {id:"bg-sg-3d-24",title:"석가탑 3D 모델 (Draft)",cat:"3d_model",coll:"bulguksa-2024",site:"경주 불국사",target:"석가탑",date:"2024-03-15",size:"720MB",epsg:5186,status:"draft",mx:43,my:45,
    auto:{"vertex":"980,000","face":"1,960,000"},manual:{},desc:"석가탑 모델 — 좌표계 미확인",links:[]},
  {id:"bg-ortho-24",title:"불국사 드론 정사영상",cat:"orthoimage",coll:"bulguksa-2024",site:"경주 불국사",target:"전체",date:"2024-03-12",size:"3.2GB",epsg:5186,status:"published",mx:50,my:48,
    auto:{"gsd":"0.05 m/px","shape":"20000×25000","bands":"R,G,B,NIR","bit_depth":"8"},manual:{},desc:"드론 정사영상",links:[]},
  {id:"bg-dt-img-24",title:"다보탑 촬영 원본 (450장)",cat:"image",coll:"bulguksa-2024",site:"경주 불국사",target:"다보탑",date:"2024-03-12",size:"18.7GB",epsg:5186,status:"published",mx:56,my:42,
    auto:{"camera":"Sony A7R IV","resolution":"9504×6336","count":"450장","gps":"있음"},manual:{"capture_type":"ground"},desc:"다보탑 촬영 원본",links:[]},
  {id:"bg-sg-img-24",title:"석가탑 촬영 원본 (380장)",cat:"image",coll:"bulguksa-2024",site:"경주 불국사",target:"석가탑",date:"2024-03-12",size:"15.2GB",epsg:5186,status:"published",mx:44,my:41,
    auto:{"camera":"Sony A7R IV","count":"380장"},manual:{"capture_type":"ground"},desc:"석가탑 촬영 원본",links:[]},
  {id:"bg-dj-pano-24",title:"대웅전 내부 파노라마",cat:"panorama",coll:"bulguksa-2024",site:"경주 불국사",target:"대웅전",date:"2024-03-13",size:"45MB",epsg:5186,status:"published",mx:49,my:56,
    auto:{"resolution":"11000×5500","type":"equirectangular"},manual:{"is_indoor":"true"},desc:"대웅전 내부 360°",links:[]},
  {id:"bg-video-24",title:"불국사 드론 영상",cat:"video",coll:"bulguksa-2024",site:"경주 불국사",target:"전체",date:"2024-03-12",size:"1.82GB",epsg:5186,status:"published",mx:51,my:50,
    auto:{"duration":"5분 26초","codec":"H.264","resolution":"4K","fps":"30"},manual:{"capture_type":"drone_flight"},desc:"드론 촬영 영상",links:[]},
  {id:"bg-report-24",title:"정밀실측 보고서",cat:"document",coll:"bulguksa-2024",site:"경주 불국사",target:"전체",date:"2024-04-15",size:"24.5MB",epsg:4326,status:"published",mx:47,my:52,
    auto:{"format":"PDF","pages":"156"},manual:{"doc_type":"survey_report","language":"ko"},desc:"2024 정밀실측 보고서",links:[]},
  {id:"bg-journal-24",title:"현장 조사 일지",cat:"document",coll:"bulguksa-2024",site:"경주 불국사",target:"전체",date:"2024-04-10",size:"2.1MB",epsg:4326,status:"published",mx:52,my:53,
    auto:{"format":"XLSX"},manual:{"doc_type":"meeting_minutes","language":"ko"},desc:"조사 일지",links:[]},
  {id:"bg-dt-pc-23",title:"다보탑 LiDAR 스캔 (2023)",cat:"pointcloud",coll:"bulguksa-2023",site:"경주 불국사",target:"다보탑",date:"2023-05-20",size:"1.8GB",epsg:5186,status:"published",mx:54,my:41,
    auto:{"pc:count":"11,800,000","pc:density":"180 pts/m²"},manual:{"pc:scanner":"FARO Focus"},desc:"2023년 다보탑 스캔",links:[{rel:"next",tid:"bg-dt-pc-24"}]},
  {id:"ha-pc-24",title:"장경판전 LiDAR 스캔",cat:"pointcloud",coll:"haeinsa-2024",site:"합천 해인사",target:"장경판전",date:"2024-06-10",size:"5.1GB",epsg:5186,status:"published",mx:25,my:38,
    auto:{"pc:count":"32,000,000","pc:density":"280 pts/m²"},manual:{"pc:scanner":"Leica RTC360"},desc:"장경판전 스캔",links:[]},
  {id:"ha-3d-24",title:"장경판전 3D 모델",cat:"3d_model",coll:"haeinsa-2024",site:"합천 해인사",target:"장경판전",date:"2024-06-18",size:"1.2GB",epsg:5186,status:"published",mx:27,my:36,
    auto:{"vertex":"3,200,000","face":"6,400,000"},manual:{"method":"photogrammetry"},desc:"장경판전 모델",links:[{rel:"derived_from",tid:"ha-pc-24"}]},
];

const STCOLORS = {active:{bg:"rgba(74,114,255,.1)",c:"#6B9FFF",l:"진행중"},completed:{bg:"rgba(61,214,140,.1)",c:"#3DD68C",l:"완료"},archived:{bg:"rgba(136,153,170,.1)",c:"#8899AA",l:"보관"}};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
:root{--bg:#0C0E14;--s1:#13161F;--s2:#1A1E2A;--s3:#242836;--bd:#2C3044;--bf:#4A72FF;--t1:#E4E7F0;--t2:#94A0B8;--t3:#5C6478;--ac:#4A72FF;--ok:#3DD68C;--warn:#F0B42A;--err:#F06060;--autoB:#141D2E;--autoBd:#1C3055;}
*{box-sizing:border-box;margin:0;padding:0;}
body,#root{font-family:'Noto Sans KR',sans-serif;background:var(--bg);color:var(--t1);height:100vh;overflow:hidden;}
.nav{height:46px;background:var(--s1);border-bottom:1px solid var(--bd);display:flex;align-items:center;padding:0 16px;gap:4px;flex-shrink:0;}
.nav-brand{font-size:13px;font-weight:700;letter-spacing:-.3px;margin-right:20px;cursor:pointer;}.nav-brand span{color:var(--ac);font-weight:400;}
.ni{padding:5px 14px;border-radius:5px;font-size:11px;font-weight:500;color:var(--t3);cursor:pointer;transition:.12s;}
.ni:hover{color:var(--t2);background:var(--s2);}.ni.on{color:var(--ac);background:rgba(74,114,255,.1);}
.lay{display:flex;height:calc(100vh - 46px);}
.sb{width:250px;background:var(--s1);border-right:1px solid var(--bd);display:flex;flex-direction:column;flex-shrink:0;overflow-y:auto;}
.sb::-webkit-scrollbar{width:3px;}.sb::-webkit-scrollbar-thumb{background:var(--s3);border-radius:2px;}
.main-col{flex:1;display:flex;flex-direction:column;min-width:0;}
.scroll-y{overflow-y:auto;flex:1;}.scroll-y::-webkit-scrollbar{width:4px;}.scroll-y::-webkit-scrollbar-thumb{background:var(--s3);border-radius:2px;}

/* Common */
.sec{padding:12px 14px;border-bottom:1px solid var(--bd);}
.sec-t{font-size:10px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;}
.chip{display:inline-flex;align-items:center;gap:3px;padding:3px 7px;border-radius:4px;font-size:10px;cursor:pointer;transition:.12s;border:1px solid transparent;color:var(--t3);}
.chip:hover{background:var(--s3);}.chip.on{border-color:currentColor;font-weight:500;}
.btn{padding:7px 16px;border-radius:6px;font-size:11px;font-weight:500;cursor:pointer;border:none;transition:.15s;font-family:'Noto Sans KR',sans-serif;}
.btn-p{background:var(--ac);color:#fff;}.btn-p:hover{background:#3B60E0;}
.btn-s{background:var(--s3);color:var(--t2);border:1px solid var(--bd);}
.btn-ok{background:var(--ok);color:#0C0E14;}
.mono{font-family:'DM Mono',monospace;}
.row{display:flex;gap:8px;align-items:center;}

/* Search */
.srch{position:relative;}
.srch input{width:100%;padding:7px 10px 7px 28px;background:var(--s2);border:1px solid var(--bd);border-radius:6px;color:var(--t1);font-size:11px;font-family:'Noto Sans KR',sans-serif;outline:none;}
.srch input:focus{border-color:var(--bf);}.srch input::placeholder{color:var(--t3);}
.srch-i{position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--t3);}

/* Map */
.map{flex:1;background:var(--s2);position:relative;overflow:hidden;min-height:0;}
.map-grid{position:absolute;inset:0;opacity:.04;background-image:linear-gradient(var(--bd) 1px,transparent 1px),linear-gradient(90deg,var(--bd) 1px,transparent 1px);background-size:50px 50px;}
.map-mk{position:absolute;cursor:pointer;transition:.15s;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:9px;z-index:1;width:20px;height:20px;}
.map-mk:hover{transform:scale(1.3);z-index:5;}
.map-mk.sel{transform:scale(1.4);z-index:5;box-shadow:0 0 0 3px var(--ac);}
.map-tip{position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:var(--s1);border:1px solid var(--bd);border-radius:5px;padding:5px 8px;font-size:9px;white-space:nowrap;pointer-events:none;z-index:20;box-shadow:0 4px 12px rgba(0,0,0,.4);}
.map-info{position:absolute;bottom:8px;left:8px;background:rgba(19,22,31,.85);border:1px solid var(--bd);border-radius:6px;padding:5px 10px;font-size:9px;color:var(--t2);display:flex;gap:8px;}

/* Results */
.res-area{height:220px;background:var(--s1);border-top:1px solid var(--bd);flex-shrink:0;display:flex;flex-direction:column;}
.res-hdr{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;border-bottom:1px solid var(--bd);font-size:11px;font-weight:600;color:var(--t2);}
.res-scroll{flex:1;overflow-y:auto;}.res-scroll::-webkit-scrollbar{width:3px;}.res-scroll::-webkit-scrollbar-thumb{background:var(--s3);border-radius:2px;}
.res-row{display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;transition:.08s;border-bottom:1px solid rgba(44,48,68,.2);}
.res-row:hover{background:rgba(74,114,255,.03);}.res-row.on{background:rgba(74,114,255,.07);border-left:2px solid var(--ac);}
.res-icon{width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;}
.res-body{flex:1;min-width:0;}
.res-title{font-size:11px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.res-meta{font-size:9px;color:var(--t3);margin-top:1px;}
.res-tag{padding:2px 5px;border-radius:3px;font-size:8px;font-weight:500;}

/* Preview Panel */
.pv{width:340px;background:var(--s1);border-left:1px solid var(--bd);overflow-y:auto;flex-shrink:0;animation:slideR .15s ease-out;}
@keyframes slideR{from{transform:translateX(16px);opacity:0}to{transform:translateX(0);opacity:1}}
.pv::-webkit-scrollbar{width:3px;}.pv::-webkit-scrollbar-thumb{background:var(--s3);border-radius:2px;}
.pv-hdr{padding:14px;border-bottom:1px solid var(--bd);position:relative;}
.pv-close{position:absolute;right:10px;top:10px;width:24px;height:24px;border-radius:5px;border:1px solid var(--bd);background:var(--s2);color:var(--t3);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;}
.pv-type{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:500;margin-bottom:6px;}
.pv-title{font-size:15px;font-weight:700;letter-spacing:-.2px;margin-bottom:3px;}
.pv-sub{font-size:10px;color:var(--t3);}
.pv-sec{padding:10px 14px;border-bottom:1px solid var(--bd);}
.pv-sec-t{font-size:9px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;}
.pv-row{display:flex;justify-content:space-between;padding:3px 0;font-size:11px;}
.pv-k{color:var(--t2);}.pv-v{color:var(--t1);font-family:'DM Mono',monospace;font-size:10px;}
.pv-link{display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--s2);border-radius:5px;font-size:10px;cursor:pointer;transition:.1s;margin-bottom:4px;}
.pv-link:hover{background:var(--s3);}
.pv-rel{padding:1px 5px;border-radius:3px;font-size:8px;font-weight:600;}
.pv-actions{padding:12px 14px;display:flex;flex-direction:column;gap:5px;}

/* Detail Full Page */
.detail-page{padding:20px 24px 60px;max-width:1100px;margin:0 auto;}
.dp-back{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:5px;font-size:11px;color:var(--t2);cursor:pointer;border:1px solid var(--bd);transition:.12s;margin-bottom:12px;}
.dp-back:hover{background:var(--s2);color:var(--t1);}
.dp-hero{display:flex;gap:20px;margin-bottom:20px;}
.dp-thumb{width:160px;height:120px;border-radius:10px;background:var(--s2);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;font-size:40px;flex-shrink:0;}
.dp-info{flex:1;}
.dp-htitle{font-size:22px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px;}
.dp-hdesc{font-size:12px;color:var(--t2);line-height:1.5;margin-bottom:8px;}
.dp-tags{display:flex;gap:5px;flex-wrap:wrap;}
.dp-tag{padding:3px 8px;border-radius:4px;font-size:10px;background:var(--s2);border:1px solid var(--bd);color:var(--t2);}
.dp-tag b{color:var(--t1);font-weight:500;}
.dp-tabs{display:flex;gap:2px;border-bottom:1px solid var(--bd);margin-bottom:16px;}
.dp-tab{padding:8px 16px;font-size:11px;font-weight:500;color:var(--t3);cursor:pointer;transition:.12s;border-bottom:2px solid transparent;margin-bottom:-1px;}
.dp-tab:hover{color:var(--t2);}.dp-tab.on{color:var(--ac);border-bottom-color:var(--ac);}
.dp-card{background:var(--s1);border:1px solid var(--bd);border-radius:9px;padding:14px;margin-bottom:12px;}
.dp-card-t{font-size:10px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px;display:flex;align-items:center;gap:5px;}
.dp-card-t .dot{width:5px;height:5px;border-radius:50%;}
.dp-mrow{display:flex;justify-content:space-between;padding:4px 0;font-size:11px;border-bottom:1px solid rgba(44,48,68,.25);}
.dp-mrow:last-child{border:none;}
.dp-mk{color:var(--t2);}.dp-mv{font-family:'DM Mono',monospace;font-size:10px;}
.dp-mgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.dp-auto{background:var(--autoB);border-color:var(--autoBd);}

/* Project */
.prj-card{padding:16px;background:var(--s1);border:1px solid var(--bd);border-radius:10px;margin-bottom:14px;}
.prj-title{font-size:18px;font-weight:700;margin-bottom:5px;}
.prj-tags{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;}
.prj-tg{padding:3px 8px;border-radius:4px;font-size:10px;background:var(--s2);border:1px solid var(--bd);color:var(--t2);}
.prj-tg b{color:var(--t1);font-weight:500;}
.prj-bar{display:flex;align-items:center;gap:10px;}
.prj-barfill{flex:1;height:5px;border-radius:3px;background:var(--s3);overflow:hidden;}
.prj-barfill>div{height:100%;border-radius:3px;background:var(--ac);transition:.3s;}
.p-tabs{display:flex;gap:2px;border-bottom:1px solid var(--bd);margin-bottom:0;background:var(--s1);border-radius:8px 8px 0 0;padding:3px 3px 0;}
.p-tab{padding:8px 14px;font-size:11px;font-weight:500;color:var(--t3);cursor:pointer;transition:.12s;border-bottom:2px solid transparent;margin-bottom:-1px;border-radius:5px 5px 0 0;}
.p-tab:hover{color:var(--t2);background:var(--s2);}.p-tab.on{color:var(--ac);border-bottom-color:var(--ac);background:var(--s2);}
.p-tab-badge{display:inline-flex;min-width:16px;height:16px;border-radius:8px;font-size:8px;font-weight:700;align-items:center;justify-content:center;margin-left:4px;padding:0 4px;}
.p-body{background:var(--s1);border:1px solid var(--bd);border-top:none;border-radius:0 0 8px 8px;padding:16px;min-height:250px;}
.st{width:100%;border-collapse:collapse;font-size:11px;}
.st th{text-align:left;padding:8px 10px;font-size:9px;font-weight:600;color:var(--t3);border-bottom:1px solid var(--bd);}
.st td{padding:8px 10px;border-bottom:1px solid rgba(44,48,68,.25);}
.st-bar{width:50px;height:4px;border-radius:2px;background:var(--s3);overflow:hidden;display:inline-block;vertical-align:middle;}
.st-bar>div{height:100%;border-radius:2px;}
.ci-sb{padding:10px 14px;cursor:pointer;transition:.1s;border-left:3px solid transparent;}
.ci-sb:hover{background:var(--s2);}.ci-sb.on{background:rgba(74,114,255,.05);border-left-color:var(--ac);}
.ci-sb-t{font-size:11px;font-weight:500;margin-bottom:2px;}
.ci-sb-m{font-size:9px;color:var(--t3);display:flex;gap:6px;align-items:center;}
.ci-sb-st{padding:1px 5px;border-radius:3px;font-size:8px;font-weight:600;}
.ci-sb-bar{height:2px;border-radius:1px;background:var(--s3);margin-top:4px;overflow:hidden;}
.ci-sb-bar>div{height:100%;border-radius:1px;background:var(--ac);transition:.3s;}

/* Upload */
.up-tabs{display:flex;gap:4px;margin-bottom:16px;}
.up-tab{padding:8px 20px;border-radius:7px;font-size:12px;font-weight:500;cursor:pointer;transition:.12s;border:1px solid var(--bd);color:var(--t3);background:var(--s1);}
.up-tab.on{background:var(--ac);color:#fff;border-color:var(--ac);}
.up-card{background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:18px;margin-bottom:14px;}
.up-card-t{font-size:13px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:6px;}
.dz{border:2px dashed var(--bd);border-radius:10px;padding:36px 16px;text-align:center;cursor:pointer;transition:.2s;}
.dz:hover{border-color:var(--ac);background:rgba(74,114,255,.03);}
.up-steps{display:flex;gap:3px;margin-bottom:16px;background:var(--s2);border-radius:8px;padding:4px;}
.up-step{flex:1;padding:7px 10px;border-radius:5px;font-size:11px;color:var(--t3);text-align:center;cursor:pointer;transition:.12s;}
.up-step.on{background:var(--s3);color:var(--t1);font-weight:500;}
.up-step.done{color:var(--ok);}
.up-field{margin-bottom:10px;}
.up-field label{display:block;font-size:10px;color:var(--t2);margin-bottom:3px;font-weight:500;}
.up-field input,.up-field select,.up-field textarea{width:100%;padding:7px 10px;background:var(--s2);border:1px solid var(--bd);border-radius:6px;color:var(--t1);font-size:11px;font-family:'Noto Sans KR',sans-serif;outline:none;}
.up-field input:focus,.up-field select:focus{border-color:var(--bf);}
.up-field textarea{min-height:50px;resize:vertical;}
.up-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.up-auto{background:var(--autoB);border:1px solid var(--autoBd);border-radius:8px;padding:12px;}
.up-auto-hdr{font-size:10px;font-weight:600;color:#7CB3FF;margin-bottom:8px;}
.up-auto-row{display:flex;justify-content:space-between;padding:3px 0;font-size:10px;border-bottom:1px solid rgba(28,48,85,.4);}
.up-auto-row:last-child{border:none;}
.up-auto-k{color:var(--t2);}.up-auto-v{color:#7CB3FF;font-family:'DM Mono',monospace;font-size:9px;}

/* Spatial map in project */
.smap{width:100%;height:280px;background:var(--s2);border-radius:8px;border:1px solid var(--bd);position:relative;overflow:hidden;}
.smap-layers{display:flex;gap:3px;flex-wrap:wrap;margin-bottom:8px;}

/* Draft card */
.drf{padding:12px;background:var(--s2);border:1px solid var(--bd);border-radius:8px;margin-bottom:6px;}
.drf:hover{border-color:var(--warn);}
.drf-t{font-size:12px;font-weight:500;margin-bottom:3px;}
.drf-m{font-size:9px;color:var(--t3);margin-bottom:6px;}
.drf-reason{font-size:10px;color:var(--warn);background:rgba(240,180,42,.05);padding:5px 8px;border-radius:5px;margin-bottom:6px;}

/* Modal */
.modal-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(3px);z-index:100;display:flex;align-items:center;justify-content:center;}
.modal{background:var(--s1);border:1px solid var(--bd);border-radius:12px;width:560px;max-height:80vh;overflow-y:auto;padding:20px;box-shadow:0 16px 48px rgba(0,0,0,.5);}
.modal::-webkit-scrollbar{width:3px;}.modal::-webkit-scrollbar-thumb{background:var(--s3);border-radius:2px;}
.modal-t{font-size:16px;font-weight:700;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;}
.modal-x{width:28px;height:28px;border-radius:6px;border:1px solid var(--bd);background:var(--s2);color:var(--t3);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;}
.mf{margin-bottom:10px;}.mf label{display:block;font-size:10px;color:var(--t2);margin-bottom:3px;font-weight:500;}
.mf input,.mf select,.mf textarea{width:100%;padding:8px 10px;background:var(--s2);border:1px solid var(--bd);border-radius:6px;color:var(--t1);font-size:11px;font-family:'Noto Sans KR',sans-serif;outline:none;}
.mf input:focus,.mf select:focus{border-color:var(--bf);}
.mf textarea{min-height:40px;resize:vertical;}
.mf-r2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.mf-exp{margin-top:6px;background:var(--s2);border-radius:6px;padding:8px;border:1px solid var(--bd);}
.mf-exp-row{display:grid;grid-template-columns:90px 45px 1fr;gap:5px;align-items:center;padding:3px 0;font-size:10px;}
.mf-exp-in{padding:4px 6px;background:var(--bg);border:1px solid var(--bd);border-radius:4px;color:var(--t1);font-size:10px;text-align:center;width:40px;font-family:'DM Mono',monospace;outline:none;}
.mf-exp-desc{padding:4px 6px;background:var(--bg);border:1px solid var(--bd);border-radius:4px;color:var(--t1);font-size:10px;outline:none;width:100%;}
.modal-foot{display:flex;justify-content:flex-end;gap:6px;margin-top:14px;padding-top:12px;border-top:1px solid var(--bd);}

/* Timeline */
.tl{display:flex;align-items:center;padding:6px 0;}
.tl-line{flex:1;height:2px;background:var(--bd);}.tl-line.on{background:var(--ac);}
.tl-node{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;padding:3px 6px;}
.tl-dot{width:12px;height:12px;border-radius:50%;border:2px solid var(--bd);background:var(--s2);}
.tl-dot.cur{border-color:var(--ac);background:var(--ac);box-shadow:0 0 0 3px rgba(74,114,255,.2);}
.tl-dot.past{border-color:var(--t3);background:var(--t3);}
.tl-lbl{font-size:9px;color:var(--t3);font-family:'DM Mono',monospace;}.tl-lbl.cur{color:var(--ac);font-weight:600;}
`;

const REL_C = {derived_from:{bg:"rgba(74,114,255,.1)",c:"#6B9FFF",l:"원본"},related:{bg:"rgba(61,214,140,.1)",c:"#3DD68C",l:"관련"},prev:{bg:"rgba(240,180,42,.1)",c:"#F0B42A",l:"이전"},next:{bg:"rgba(240,180,42,.1)",c:"#F0B42A",l:"다음"},describedby:{bg:"rgba(136,153,170,.1)",c:"#8899AA",l:"문서"},describes:{bg:"rgba(136,153,170,.1)",c:"#8899AA",l:"대상"}};

// ── Helper Components (extracted from IIFEs) ──

function MapPopup({items, target, onClose}) {
  const ax = items.reduce((s,i)=>s+i.mx,0)/items.length;
  const ay = items.reduce((s,i)=>s+i.my,0)/items.length;
  return (
    <div style={{position:"absolute",left:`${ax+4}%`,top:`${ay-4}%`,background:"var(--s1)",border:"1px solid var(--bd)",borderRadius:7,padding:"8px 12px",fontSize:10,zIndex:10,boxShadow:"0 4px 16px rgba(0,0,0,.4)",minWidth:150}}>
      <div style={{fontWeight:600,marginBottom:4}}>{target}</div>
      {Object.keys(CATS).map(k=>{const ct=CATS[k];const n=items.filter(i=>i.cat===k).length;return(
        <div key={k} style={{display:"flex",alignItems:"center",gap:4,padding:"1px 0"}}>
          <span style={{color:ct.color,fontSize:10}}>{ct.icon}</span>
          <span style={{flex:1}}>{ct.full}</span>
          <span style={{color:n>0?"var(--ok)":"var(--t3)",fontWeight:n>0?600:400,fontFamily:"'DM Mono',monospace"}}>{n>0?`✅${n}`:"—"}</span>
        </div>
      );})}
      <div style={{fontSize:8,color:"var(--t3)",marginTop:4,cursor:"pointer"}} onClick={onClose}>닫기</div>
    </div>
  );
}

function PreviewPanel({item, onClose, onDetail, onSetItem, onGoProject, getRelated, getTimeline}) {
  const c = CATS[item.cat];
  const rels = getRelated(item);
  const tl = getTimeline(item);
  return (
    <div className="pv">
      <div className="pv-hdr"><button className="pv-close" onClick={onClose}>✕</button>
        <div style={{fontSize:8,color:"var(--t3)",marginBottom:4,letterSpacing:".4px",textTransform:"uppercase"}}>미리보기</div>
        <div className="pv-type" style={{background:`${c.color}12`,color:c.color}}>{c.icon} {c.full}</div>
        <div className="pv-title">{item.title}</div>
        <div className="pv-sub">{item.site} · {item.target}</div>
      </div>
      <div className="pv-sec"><div className="pv-sec-t">핵심 정보</div>
        <div className="pv-row"><span className="pv-k">취득일</span><span className="pv-v">{item.date}</span></div>
        <div className="pv-row"><span className="pv-k">크기</span><span className="pv-v">{item.size}</span></div>
        <div className="pv-row"><span className="pv-k">좌표계</span><span className="pv-v">EPSG:{item.epsg}</span></div>
      </div>
      <div className="pv-sec"><div className="pv-sec-t">주요 메타데이터</div>
        {Object.entries(item.auto).slice(0,4).map(([k,v])=><div key={k} className="pv-row"><span className="pv-k">{k}</span><span className="pv-v">{v}</span></div>)}
        {Object.keys(item.auto).length>4&&<div style={{fontSize:9,color:"var(--t3)",textAlign:"right"}}>+{Object.keys(item.auto).length-4}개 → 상세 보기</div>}
      </div>
      {tl.length>1&&<div className="pv-sec"><div className="pv-sec-t">시계열</div>
        <div style={{display:"flex",alignItems:"center",gap:0}}>{tl.map((t,i)=><span key={t.id} style={{display:"flex",alignItems:"center"}}>{i>0&&<span style={{color:"var(--t3)",fontSize:10,padding:"0 2px"}}>→</span>}<span style={{padding:"3px 7px",borderRadius:4,fontSize:10,cursor:"pointer",background:t.id===item.id?"rgba(74,114,255,.12)":"transparent",color:t.id===item.id?"var(--ac)":"var(--t3)",fontWeight:t.id===item.id?600:400}} onClick={()=>{if(t.id!==item.id){onSetItem(t);}}}>{t.date.slice(0,7)}</span></span>)}</div>
      </div>}
      {rels.length>0&&<div className="pv-sec"><div className="pv-sec-t">관련 데이터 ({rels.length})</div>
        {rels.map((r,i)=>{const rc=CATS[r.item.cat];const rl=REL_C[r.rel];return(
          <div key={i} className="pv-link" onClick={()=>onSetItem(r.item)}>
            <span className="pv-rel" style={{background:rl.bg,color:rl.c}}>{rl.l}</span>
            <span style={{color:rc.color,fontSize:11}}>{rc.icon}</span>
            <span style={{flex:1,fontSize:10}}>{r.item.title}</span>
            <span style={{color:"var(--t3)"}}>→</span>
          </div>
        );})}
      </div>}
      <div className="pv-actions">
        <button className="btn btn-p" style={{width:"100%",textAlign:"center",padding:9,fontSize:12}} onClick={onDetail}>상세 보기 →</button>
        <div className="row" style={{gap:5}}>
          <button className="btn btn-s" style={{flex:1,textAlign:"center",fontSize:10}}>다운로드</button>
          <button className="btn btn-s" style={{flex:1,textAlign:"center",fontSize:10}} onClick={onGoProject}>프로젝트</button>
        </div>
        <div style={{fontSize:8,color:"var(--t3)",textAlign:"center"}}>관계 그래프·시계열 비교·편집은 상세 보기에서</div>
      </div>
    </div>
  );
}

function TimelineTab({tl, detailItem, c, openDetail}) {
  const nodes = tl.length>1 ? tl : [detailItem];
  return (
    <div className="dp-card">
      <div className="dp-card-t">시계열 — {detailItem.target} {c.full}</div>
      <div className="tl">{nodes.map((t,i)=><span key={t.id} style={{display:"contents"}}>
        {i>0&&<div className={`tl-line ${t.id===detailItem.id?"on":""}`}/>}
        <div className="tl-node" onClick={()=>{if(t.id!==detailItem.id)openDetail(t);}}>
          <div className={`tl-dot ${t.id===detailItem.id?"cur":"past"}`}/>
          <div className={`tl-lbl ${t.id===detailItem.id?"cur":""}`}>{t.date.slice(0,7)}</div>
        </div>
      </span>)}</div>
      {tl.length>1&&<div style={{display:"grid",gridTemplateColumns:`repeat(${nodes.length},1fr)`,gap:8,marginTop:12}}>
        {nodes.map(t=><div key={t.id} style={{padding:10,background:t.id===detailItem.id?"rgba(74,114,255,.05)":"var(--s2)",border:`1px solid ${t.id===detailItem.id?"var(--ac)":"var(--bd)"}`,borderRadius:8}}>
          <div style={{fontSize:12,fontWeight:600,color:t.id===detailItem.id?"var(--ac)":"var(--t1)",marginBottom:4}}>{t.date.slice(0,7)}</div>
          {Object.entries(t.auto).slice(0,3).map(([k,v])=><div key={k} style={{fontSize:9,color:"var(--t3)"}}>{k}: {v}</div>)}
          {t.id===detailItem.id&&<div style={{fontSize:9,color:"var(--ac)",fontWeight:500,marginTop:3}}>현재</div>}
        </div>)}
      </div>}
      {tl.length<=1&&<div style={{fontSize:10,color:"var(--t3)",textAlign:"center",padding:16}}>이 대상의 다른 시점 데이터가 아직 없습니다</div>}
    </div>
  );
}

export default function SAMS() {
  const [page, setPage] = useState("explorer"); // explorer, detail, project, upload
  const [keyword, setKeyword] = useState("");
  const [catFilter, setCatFilter] = useState(new Set(Object.keys(CATS)));
  const [collFilter, setCollFilter] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [selItem, setSelItem] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [detailTab, setDetailTab] = useState("meta");
  const [editMode, setEditMode] = useState(false);

  // Project state
  const [selColl, setSelColl] = useState("bulguksa-2024");
  const [pTab, setPTab] = useState("status");
  const [showModal, setShowModal] = useState(false);
  const [layers, setLayers] = useState(new Set(Object.keys(CATS)));
  const [mapPop, setMapPop] = useState(null);

  // Upload state
  const [upMode, setUpMode] = useState("bulk");
  const [upStep, setUpStep] = useState(0);
  const [upUploaded, setUpUploaded] = useState(false);
  const [upAnalyzed, setUpAnalyzed] = useState(false);

  const toggleCat = k => { const n=new Set(catFilter); n.has(k)?n.delete(k):n.add(k); setCatFilter(n); };
  const toggleLayer = k => { const n=new Set(layers); n.has(k)?n.delete(k):n.add(k); setLayers(n); };

  const filtered = useMemo(()=>ITEMS.filter(i=>{
    if(!catFilter.has(i.cat)) return false;
    if(collFilter && i.coll!==collFilter) return false;
    if(keyword){const kw=keyword.toLowerCase();if(!(i.title.toLowerCase().includes(kw)||i.site.toLowerCase().includes(kw)||i.target.toLowerCase().includes(kw)))return false;}
    return true;
  }),[keyword,catFilter,collFilter]);

  const openPreview = item => { setSelItem(item); setShowPreview(true); };
  const closePreview = () => { setShowPreview(false); setSelItem(null); };
  const openDetail = item => { setDetailItem(item); setDetailTab("meta"); setEditMode(false); setPage("detail"); };
  const backToExplorer = () => { setPage("explorer"); };

  const coll = COLLS.find(c=>c.id===selColl);
  const collItems = id => ITEMS.filter(i=>i.coll===id);
  const getRelated = item => item.links?.map(l=>({...l,item:ITEMS.find(i=>i.id===l.tid)})).filter(l=>l.item) || [];
  const getTimeline = item => {
    if(!item) return [];
    const same = ITEMS.filter(i=>i.target===item.target&&i.cat===item.cat).sort((a,b)=>a.date.localeCompare(b.date));
    return same.length>1 ? same : [];
  };

  // ═══ EXPLORER ═══
  const ExplorerPage = () => (
    <div className="lay">
      <div className="sb">
        <div className="sec">
          <div className="srch"><span className="srch-i">🔍</span>
            <input placeholder="사이트, 대상, 키워드..." value={keyword} onChange={e=>setKeyword(e.target.value)}/>
          </div>
        </div>
        <div className="sec">
          <div className="sec-t">데이터 유형</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
            {Object.entries(CATS).map(([k,c])=>(
              <span key={k} className={`chip ${catFilter.has(k)?"on":""}`} style={{color:catFilter.has(k)?c.color:undefined}} onClick={()=>toggleCat(k)}>
                <span style={{fontSize:11}}>{c.icon}</span>{c.full}
              </span>
            ))}
          </div>
        </div>
        <div className="sec">
          <div className="sec-t">프로젝트</div>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            <div style={{padding:"4px 8px",borderRadius:4,fontSize:10,color:!collFilter?"var(--ac)":"var(--t3)",cursor:"pointer"}} onClick={()=>setCollFilter(null)}>전체 ({ITEMS.length})</div>
            {COLLS.map(c=><div key={c.id} style={{padding:"4px 8px",borderRadius:4,fontSize:10,color:collFilter===c.id?"var(--ac)":"var(--t3)",cursor:"pointer",background:collFilter===c.id?"rgba(74,114,255,.06)":"transparent"}} onClick={()=>setCollFilter(collFilter===c.id?null:c.id)}>{c.title} ({collItems(c.id).length})</div>)}
          </div>
        </div>
        <div style={{padding:"8px 14px",marginTop:"auto",fontSize:10,color:"var(--t2)",borderTop:"1px solid var(--bd)"}}>검색 결과: <b style={{color:"var(--ac)"}} className="mono">{filtered.length}</b>건</div>
      </div>

      <div className="main-col">
        <div className="map">
          <div className="map-grid"/>
          <div style={{position:"absolute",left:"48%",top:"52%",fontSize:10,color:"rgba(255,255,255,.06)",fontWeight:700}}>경주</div>
          <div style={{position:"absolute",left:"18%",top:"30%",fontSize:10,color:"rgba(255,255,255,.06)",fontWeight:700}}>합천</div>
          {filtered.map(item=>{const c=CATS[item.cat];const hl=hoverId===item.id;const sl=selItem?.id===item.id;
            return <div key={item.id} className={`map-mk ${sl?"sel":""}`} style={{left:`${item.mx}%`,top:`${item.my}%`,background:`${c.color}20`,border:`2px solid ${c.color}`,color:c.color,transform:hl?"scale(1.3)":undefined,zIndex:hl?5:1}}
              onMouseEnter={()=>setHoverId(item.id)} onMouseLeave={()=>setHoverId(null)} onClick={()=>openPreview(item)}>
              {c.icon}
              {hl&&!sl&&<div className="map-tip"><div style={{fontWeight:500,color:"var(--t1)"}}>{item.title}</div><div style={{color:"var(--t3)",marginTop:1}}>{item.date}·{item.size}</div></div>}
            </div>;
          })}
          <div className="map-info">
            <span>표시: <b style={{color:"var(--t1)"}}>{filtered.length}</b></span>
            {Object.entries(CATS).map(([k,c])=>{const n=filtered.filter(i=>i.cat===k).length;return n>0?<span key={k} style={{color:c.color}}>{c.icon}{n}</span>:null;})}
          </div>
        </div>
        <div className="res-area">
          <div className="res-hdr"><span>검색 결과 ({filtered.length})</span></div>
          <div className="res-scroll">
            {filtered.map(item=>{const c=CATS[item.cat];return(
              <div key={item.id} className={`res-row ${selItem?.id===item.id?"on":""}`} onMouseEnter={()=>setHoverId(item.id)} onMouseLeave={()=>setHoverId(null)} onClick={()=>openPreview(item)}>
                <div className="res-icon" style={{background:`${c.color}12`,color:c.color}}>{c.icon}</div>
                <div className="res-body"><div className="res-title">{item.title}</div><div className="res-meta">{item.date} · {item.size} · {item.target}</div></div>
                <span className="res-tag" style={{background:`${c.color}12`,color:c.color}}>{c.full}</span>
              </div>
            );})}
            {filtered.length===0&&<div style={{padding:30,textAlign:"center",color:"var(--t3)",fontSize:12}}>검색 결과 없음</div>}
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      {showPreview&&selItem&&<PreviewPanel item={selItem} onClose={closePreview} onDetail={()=>openDetail(selItem)} onSetItem={setSelItem} onGoProject={()=>{setSelColl(selItem.coll);setPage("project");}} getRelated={getRelated} getTimeline={getTimeline}/>}
    </div>
  );

  // ═══ DETAIL ═══
  const DetailPage = () => {
    if(!detailItem) return null;
    const c=CATS[detailItem.cat]; const rels=getRelated(detailItem); const tl=getTimeline(detailItem);
    return (
      <div className="scroll-y">
        <div className="detail-page">
          <div className="dp-back" onClick={backToExplorer}>← Explorer로 돌아가기</div>
          <div className="dp-hero">
            <div className="dp-thumb" style={{color:c.color,opacity:.5}}>{c.icon}</div>
            <div className="dp-info">
              <div className="pv-type" style={{background:`${c.color}12`,color:c.color,marginBottom:6}}>{c.icon} {c.full}</div>
              <div className="dp-htitle">{detailItem.title}</div>
              <div className="dp-hdesc">{detailItem.desc}</div>
              <div className="dp-tags">
                <span className="dp-tag">📍 <b>{detailItem.site}</b> · {detailItem.target}</span>
                <span className="dp-tag">📅 <b>{detailItem.date}</b></span>
                <span className="dp-tag">📐 <b>EPSG:{detailItem.epsg}</b></span>
                <span className="dp-tag" style={{background:detailItem.status==="published"?"rgba(61,214,140,.08)":"rgba(240,180,42,.08)",color:detailItem.status==="published"?"var(--ok)":"var(--warn)",fontWeight:600,borderColor:detailItem.status==="published"?"rgba(61,214,140,.2)":"rgba(240,180,42,.2)"}}>{detailItem.status==="published"?"✅ Published":"⚠ Draft"}</span>
              </div>
            </div>
          </div>

          {editMode&&<div style={{padding:10,background:"rgba(240,180,42,.06)",border:"1px solid rgba(240,180,42,.15)",borderRadius:8,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:11,color:"var(--warn)"}}>📝 편집 모드</span>
            <div><button className="btn btn-s" style={{marginRight:4,fontSize:10}} onClick={()=>setEditMode(false)}>취소</button><button className="btn btn-ok" style={{fontSize:10}} onClick={()=>setEditMode(false)}>저장</button></div>
          </div>}

          <div className="dp-tabs">
            {[{id:"meta",l:"📋 메타데이터"},{id:"files",l:"📁 파일"},{id:"relations",l:`🔗 연관관계 (${rels.length})`},{id:"timeline",l:"⏱ 시계열"}].map(t=>
              <div key={t.id} className={`dp-tab ${detailTab===t.id?"on":""}`} onClick={()=>setDetailTab(t.id)}>{t.l}</div>
            )}
            {!editMode&&<div className="dp-tab" style={{marginLeft:"auto"}} onClick={()=>setEditMode(true)}>✏️ 편집</div>}
          </div>

          {detailTab==="meta"&&!editMode&&(
            <div className="dp-mgrid">
              <div className="dp-card"><div className="dp-card-t"><span className="dot" style={{background:"var(--ac)"}}/>기본 정보</div>
                {[["Item ID",detailItem.id],["유형",`${c.icon} ${c.full}`],["취득일",detailItem.date],["사이트",detailItem.site],["대상",detailItem.target],["좌표계",`EPSG:${detailItem.epsg}`],["Collection",COLLS.find(cl=>cl.id===detailItem.coll)?.title]].map(([k,v])=>
                  <div key={k} className="dp-mrow"><span className="dp-mk">{k}</span><span className="dp-mv">{v}</span></div>
                )}
              </div>
              <div className="dp-card"><div className="dp-card-t"><span className="dot" style={{background:"var(--ok)"}}/>공간 정보</div>
                <div className="dp-mrow"><span className="dp-mk">좌표계</span><span className="dp-mv">EPSG:{detailItem.epsg}</span></div>
                <div style={{marginTop:8,background:"var(--s2)",borderRadius:6,height:80,display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid var(--bd)"}}><span style={{fontSize:10,color:"var(--t3)"}}>🗺 위치 미니맵</span></div>
              </div>
              <div className="dp-card dp-auto"><div className="dp-card-t"><span className="dot" style={{background:"#7CB3FF"}}/>자동 추출 <span style={{fontSize:8,color:"#7CB3FF",marginLeft:"auto"}}>구역A</span></div>
                {Object.entries(detailItem.auto).map(([k,v])=><div key={k} className="dp-mrow"><span className="dp-mk">{k}</span><span className="dp-mv" style={{color:"#7CB3FF"}}>{v}</span></div>)}
              </div>
              <div className="dp-card"><div className="dp-card-t"><span className="dot" style={{background:"var(--warn)"}}/>사용자 입력 <span style={{fontSize:8,color:"var(--t3)",marginLeft:"auto"}}>구역B/C</span></div>
                {Object.entries(detailItem.manual).map(([k,v])=><div key={k} className="dp-mrow"><span className="dp-mk">{k}</span><span className="dp-mv">{v||"—"}</span></div>)}
                {Object.keys(detailItem.manual).length===0&&<div style={{fontSize:10,color:"var(--t3)",textAlign:"center",padding:12}}>입력된 항목 없음</div>}
              </div>
            </div>
          )}
          {detailTab==="meta"&&editMode&&(
            <div style={{maxWidth:600}}>
              <div className="dp-card"><div className="dp-card-t">기본 정보 편집</div>
                <div className="up-row2"><div className="up-field"><label>사이트</label><input defaultValue={detailItem.site}/></div><div className="up-field"><label>대상</label><input defaultValue={detailItem.target}/></div></div>
                <div className="up-row2"><div className="up-field"><label>좌표계</label><select defaultValue={detailItem.epsg}><option value="5186">EPSG:5186</option><option value="4326">EPSG:4326</option></select></div><div className="up-field"><label>취득일</label><input defaultValue={detailItem.date}/></div></div>
                <div className="up-field"><label>설명</label><textarea defaultValue={detailItem.desc}/></div>
              </div>
              {detailItem.status==="draft"&&<div style={{padding:10,background:"rgba(61,214,140,.05)",border:"1px solid rgba(61,214,140,.15)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{fontSize:11,color:"var(--ok)"}}>필수 항목 채우면 Published 전환 가능</span><button className="btn btn-ok" style={{fontSize:10}}>Published로 전환</button></div>}
            </div>
          )}
          {detailTab==="files"&&(
            <div className="dp-card">
              <div className="dp-card-t">파일</div>
              {[{k:"data",t:"원본",s:detailItem.size,r:"data"},{k:"thumbnail",t:"썸네일",s:"245KB",r:"thumbnail"}].map(a=>
                <div key={a.k} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:"var(--s2)",borderRadius:6,marginBottom:4}}>
                  <span style={{fontSize:14}}>{a.r==="thumbnail"?"🖼":"💾"}</span>
                  <div style={{flex:1}}><div style={{fontSize:11,fontWeight:500}}>{a.t}</div><div style={{fontSize:9,color:"var(--t3)"}} className="mono">s3://sams/.../{detailItem.id} · {a.s}</div></div>
                  <span style={{padding:"2px 5px",borderRadius:3,fontSize:8,background:"var(--s3)",color:"var(--t2)"}}>{a.r}</span>
                  <button className="btn btn-p" style={{fontSize:10,padding:"4px 10px"}}>다운로드</button>
                </div>
              )}
            </div>
          )}
          {detailTab==="relations"&&(
            <>
              <div className="dp-card" style={{textAlign:"center",padding:20,minHeight:200,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
                  {rels.map((r,i)=>{const rc=CATS[r.item.cat];const rl=REL_C[r.rel];return(
                    <span key={i} style={{display:"flex",alignItems:"center",gap:0}}>
                      <span style={{padding:"6px 10px",background:`${rc.color}10`,border:`1px solid ${rc.color}30`,borderRadius:7,fontSize:9,color:rc.color,cursor:"pointer",textAlign:"center",maxWidth:110}} onClick={()=>openDetail(r.item)}>
                        <div style={{fontSize:14}}>{rc.icon}</div>{r.item.title.length>18?r.item.title.slice(0,18)+"…":r.item.title}
                      </span>
                      <span style={{padding:"1px 5px",fontSize:7,color:rl.c,whiteSpace:"nowrap"}}>─{rl.l}─▶</span>
                    </span>
                  );})}
                  <span style={{padding:"8px 14px",background:"rgba(74,114,255,.1)",border:"2px solid var(--ac)",borderRadius:8,fontSize:11,color:"var(--ac)",fontWeight:600,textAlign:"center"}}>
                    <div style={{fontSize:16}}>{c.icon}</div>현재
                  </span>
                </div>
                {rels.length===0&&<div style={{color:"var(--t3)",fontSize:11}}>연관관계 없음</div>}
              </div>
              {rels.length>0&&<div className="dp-card"><div className="dp-card-t">연결 목록</div>
                {rels.map((r,i)=>{const rc=CATS[r.item.cat];const rl=REL_C[r.rel];return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"var(--s2)",borderRadius:6,marginBottom:4,cursor:"pointer"}} onClick={()=>openDetail(r.item)}>
                    <span style={{padding:"2px 6px",borderRadius:3,fontSize:8,fontWeight:600,background:rl.bg,color:rl.c}}>{rl.l}</span>
                    <span style={{color:rc.color,fontSize:12}}>{rc.icon}</span>
                    <span style={{flex:1,fontSize:11}}>{r.item.title}</span><span style={{color:"var(--t3)"}}>→</span>
                  </div>
                );})}
              </div>}
            </>
          )}
          {detailTab==="timeline"&&<TimelineTab tl={tl} detailItem={detailItem} c={c} openDetail={openDetail}/>}
        </div>
      </div>
    );
  };

  // ═══ PROJECT ═══
  const ProjectPage = () => {
    const ci=collItems(selColl);
    const stats=coll?.expected?.map(e=>({...e,reg:ci.filter(i=>i.cat===e.cat).length}))||[];
    const totExp=stats.reduce((s,e)=>s+e.count,0);
    const pct=totExp>0?Math.round((ci.length/totExp)*100):0;
    const drafts=ci.filter(i=>i.status==="draft");
    const mapI=ci.filter(i=>layers.has(i.cat));
    return(
      <div className="lay">
        <div className="sb">
          <div style={{padding:"10px 14px",borderBottom:"1px solid var(--bd)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:12,fontWeight:600}}>프로젝트</span>
            <button className="btn btn-p" style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setShowModal(true)}>+ 새 프로젝트</button>
          </div>
          {COLLS.map(c=>{const it=collItems(c.id);const tot=c.expected?.reduce((s,e)=>s+e.count,0)||0;const p=tot>0?it.length/tot:0;const sc=STCOLORS[c.status];
            return <div key={c.id} className={`ci-sb ${selColl===c.id?"on":""}`} onClick={()=>{setSelColl(c.id);setPTab("status");setMapPop(null);}}>
              <div className="ci-sb-t">{c.title}</div>
              <div className="ci-sb-m"><span className="ci-sb-st" style={{background:sc.bg,color:sc.c}}>{sc.l}</span><span>{c.site}</span><span className="mono">{it.length}/{tot}</span></div>
              <div className="ci-sb-bar"><div style={{width:`${p*100}%`,background:p>=1?"var(--ok)":"var(--ac)"}}/></div>
            </div>;
          })}
        </div>
        <div className="scroll-y" style={{padding:"16px 20px 40px"}}>
          {coll&&<>
            <div className="prj-card">
              <div className="prj-title">{coll.title}</div>
              <div className="prj-tags">
                <span className="prj-tg">🏛 <b>{coll.client}</b></span><span className="prj-tg">👤 <b>{coll.pm}</b></span>
                <span className="prj-tg">📅 <b>{coll.start}~{coll.end}</b></span><span className="prj-tg">📐 <b>EPSG:{coll.epsg}</b></span>
                <span className="prj-tg" style={{background:STCOLORS[coll.status].bg,color:STCOLORS[coll.status].c,fontWeight:600,borderColor:`${STCOLORS[coll.status].c}30`}}>{STCOLORS[coll.status].l}</span>
              </div>
              <div className="prj-bar"><span style={{fontSize:10,color:"var(--t3)"}}>등록</span><div className="prj-barfill"><div style={{width:`${pct}%`}}/></div><span className="mono" style={{fontSize:11,color:"var(--t2)"}}>{ci.length}/{totExp} ({pct}%)</span></div>
            </div>

            <div className="p-tabs">
              <div className={`p-tab ${pTab==="status"?"on":""}`} onClick={()=>setPTab("status")}>📊 현황</div>
              <div className={`p-tab ${pTab==="spatial"?"on":""}`} onClick={()=>setPTab("spatial")}>🗺 공간</div>
              <div className={`p-tab ${pTab==="draft"?"on":""}`} onClick={()=>setPTab("draft")}>⚠ Draft{drafts.length>0&&<span className="p-tab-badge" style={{background:"rgba(240,180,42,.12)",color:"var(--warn)"}}>{drafts.length}</span>}</div>
              <div className={`p-tab ${pTab==="all"?"on":""}`} onClick={()=>setPTab("all")}>📋 전체 ({ci.length})</div>
            </div>
            <div className="p-body">
              {pTab==="status"&&<>
                <table className="st"><thead><tr><th>유형</th><th>예상</th><th>등록</th><th>진행</th><th>상태</th></tr></thead><tbody>
                  {stats.map(s=>{const ct=CATS[s.cat];const p2=s.count>0?s.reg/s.count:0;return(
                    <tr key={s.cat}><td><span style={{color:ct.color,marginRight:4}}>{ct.icon}</span>{ct.full}</td>
                      <td className="mono">{s.count}</td><td className="mono">{s.reg}</td>
                      <td><span className="st-bar"><div style={{width:`${p2*100}%`,background:s.reg>=s.count?"var(--ok)":"var(--warn)"}}/></span></td>
                      <td style={{color:s.reg>=s.count?"var(--ok)":"var(--warn)",fontSize:10,fontWeight:500}}>{s.reg>=s.count?"✅ 완료":`⚠ ${s.count-s.reg}건`}</td>
                    </tr>
                  );})}
                </tbody></table>
                {stats.some(s=>s.reg<s.count)&&<div style={{marginTop:12,padding:10,background:"rgba(240,180,42,.04)",border:"1px solid rgba(240,180,42,.12)",borderRadius:7}}>
                  <div style={{fontSize:10,fontWeight:600,color:"var(--warn)",marginBottom:4}}>⚠ 미등록</div>
                  {stats.filter(s=>s.reg<s.count).map(s=>{const ct=CATS[s.cat]; return <div key={s.cat} style={{fontSize:10,color:"var(--t2)",padding:"2px 0"}}>{ct.icon} {ct.full} {s.count-s.reg}건</div>;})}
                </div>}
              </>}
              {pTab==="spatial"&&<>
                <div className="smap-layers">{Object.entries(CATS).map(([k,ct])=><span key={k} className={`chip ${layers.has(k)?"on":""}`} style={{color:layers.has(k)?ct.color:undefined}} onClick={()=>toggleLayer(k)}>{ct.icon} {ct.full} ({ci.filter(i=>i.cat===k).length})</span>)}</div>
                <div className="smap"><div className="map-grid"/>
                  {layers.has("orthoimage")&&ci.some(i=>i.cat==="orthoimage")&&<div style={{position:"absolute",left:"25%",top:"20%",width:"50%",height:"60%",border:`2px solid ${CATS.orthoimage.color}`,borderRadius:4,opacity:.2}}/>}
                  {mapI.map(item=>{const ct=CATS[item.cat]; return <div key={item.id} className="map-mk" style={{left:`${item.mx}%`,top:`${item.my}%`,background:`${ct.color}20`,border:`2px solid ${ct.color}`,color:ct.color}} onClick={()=>setMapPop(mapPop===item.target?null:item.target)}>{ct.icon}</div>;})}
                  {mapPop&&ci.filter(i=>i.target===mapPop).length>0&&<MapPopup items={ci.filter(i=>i.target===mapPop)} target={mapPop} onClose={()=>setMapPop(null)}/>}
                </div>
              </>}
              {pTab==="draft"&&<>
                {drafts.length>0?drafts.map(item=>{const ct=CATS[item.cat];return(
                  <div key={item.id} className="drf"><div className="drf-t"><span style={{color:ct.color}}>{ct.icon}</span> {item.title}</div>
                    <div className="drf-m">{item.date} · {item.size}</div>
                    <div className="drf-reason">미완성: 좌표계 미확인</div>
                    <div style={{display:"flex",gap:5}}><button className="btn btn-p" style={{fontSize:10,padding:"5px 12px"}} onClick={()=>{setDetailItem(item);setEditMode(true);setPage("detail");}}>편집하여 완성 →</button><button className="btn btn-s" style={{fontSize:10,padding:"5px 12px"}}>삭제</button></div>
                  </div>
                );}):(<div style={{padding:30,textAlign:"center",color:"var(--t3)",fontSize:11}}>✅ Draft 없음</div>)}
              </>}
              {pTab==="all"&&<>
                <table className="st"><thead><tr><th style={{width:24}}></th><th>유형</th><th>Item</th><th>대상</th><th>날짜</th><th>크기</th></tr></thead><tbody>
                  {ci.map(item=>{const ct=CATS[item.cat];return(
                    <tr key={item.id} style={{cursor:"pointer"}} onClick={()=>openDetail(item)}>
                      <td><span style={{width:7,height:7,borderRadius:"50%",display:"inline-block",background:item.status==="published"?"var(--ok)":"var(--warn)"}}/></td>
                      <td><span style={{color:ct.color}}>{ct.icon}</span></td>
                      <td><div style={{fontWeight:500,fontSize:11}}>{item.title}</div><div style={{fontSize:8,color:"var(--t3)"}} className="mono">{item.id}</div></td>
                      <td style={{color:"var(--t2)",fontSize:10}}>{item.target}</td>
                      <td className="mono" style={{fontSize:10}}>{item.date}</td>
                      <td className="mono" style={{fontSize:10,color:"var(--t2)"}}>{item.size}</td>
                    </tr>
                  );})}
                </tbody></table>
              </>}
            </div>
          </>}
        </div>
      </div>
    );
  };

  // ═══ UPLOAD ═══
  const UploadPage = () => (
    <div className="scroll-y" style={{padding:"20px 24px 60px"}}>
      <div style={{maxWidth:900,margin:"0 auto"}}>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:4}}>데이터 업로드</h2>
        <p style={{fontSize:11,color:"var(--t2)",marginBottom:16}}>공간 데이터를 업로드하고 STAC 메타데이터를 등록합니다</p>
        <div className="up-tabs">
          <div className={`up-tab ${upMode==="bulk"?"on":""}`} onClick={()=>{setUpMode("bulk");setUpStep(0);setUpUploaded(false);setUpAnalyzed(false);}}>벌크 업로드</div>
          <div className={`up-tab ${upMode==="single"?"on":""}`} onClick={()=>{setUpMode("single");setUpStep(0);setUpUploaded(false);}}>단건 업로드</div>
        </div>

        {upMode==="bulk"&&<>
          <div className="up-steps">
            {["폴더 업로드 + 분석","매니페스트 편집","검토 및 등록"].map((s,i)=>
              <div key={i} className={`up-step ${i===upStep?"on":""} ${i<upStep?"done":""}`} onClick={()=>i<=upStep&&setUpStep(i)}>{i<upStep?"✓":i+1}. {s}</div>
            )}
          </div>
          {upStep===0&&<>
            <div className="up-card">
              <div className="up-card-t">📂 조사 데이터 폴더</div>
              <div className="up-field"><label>소속 프로젝트 *</label>
                <select><option value="">선택...</option>{COLLS.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select>
              </div>
              {!upUploaded?<div className="dz" onClick={()=>{setUpUploaded(true);setTimeout(()=>setUpAnalyzed(true),1200);}}>
                <div style={{fontSize:30,color:"var(--t3)",marginBottom:6}}>📁</div>
                <div style={{fontSize:12,color:"var(--t2)"}}>폴더를 드래그 또는 클릭</div>
              </div>:
              <div style={{padding:12,background:"var(--s2)",borderRadius:8,border:"1px solid var(--bd)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:18}}>📂</span>
                  <div><div className="mono" style={{fontSize:12,fontWeight:500}}>bulguksa-2024-upload/</div><div style={{fontSize:10,color:"var(--t2)"}}>12개 파일 · 43.4 GB</div></div>
                </div>
                {!upAnalyzed?<div style={{fontSize:10,color:"#7CB3FF",marginTop:6}}>⚡ 분석 중...</div>:
                <div style={{fontSize:10,color:"var(--ok)",marginTop:6}}>✅ 분석 완료 — 8개 데이터셋 인식</div>}
              </div>}
            </div>
            {upAnalyzed&&<div style={{textAlign:"right"}}><button className="btn btn-p" onClick={()=>setUpStep(1)}>매니페스트 편집 →</button></div>}
          </>}
          {upStep===1&&<>
            <div className="up-card">
              <div className="up-card-t">📝 매니페스트 편집 <span style={{fontSize:10,color:"var(--t2)",fontWeight:400}}>— 빈 칸만 채우세요</span></div>
              <div style={{display:"flex",gap:6,marginBottom:10}}>
                <button className="btn btn-s" style={{fontSize:9}}>📥 Excel 다운로드</button>
                <button className="btn btn-s" style={{fontSize:9}}>📤 Excel 업로드</button>
              </div>
              <div style={{overflowX:"auto"}}>
                <table className="st" style={{fontSize:10,minWidth:600}}>
                  <thead><tr><th>파일</th><th>유형</th><th>사이트 *</th><th>설명 *</th><th>좌표계</th></tr></thead>
                  <tbody>
                    {[{f:"dabotap_scan.laz",c:"pointcloud",s:"다보탑"},{f:"seokgatap_scan.laz",c:"pointcloud",s:"석가탑"},{f:"dabotap.obj",c:"3d_model",s:"다보탑"},{f:"bulguksa_ortho.tif",c:"orthoimage",s:"전체"},{f:"drone_flight.mp4",c:"video",s:"전체"},{f:"survey_report.pdf",c:"document",s:"전체"}].map((r,i)=>{const ct=CATS[r.c];return(
                      <tr key={i}><td className="mono" style={{fontSize:9}}>{r.f}</td>
                        <td><span style={{color:ct.color,fontSize:10}}>{ct.icon} {ct.label}</span></td>
                        <td><input style={{padding:"4px 6px",fontSize:9,width:80}} defaultValue={r.s}/></td>
                        <td><input style={{padding:"4px 6px",fontSize:9,width:120}} placeholder="설명 입력"/></td>
                        <td><select style={{padding:"4px 6px",fontSize:9,width:70}}><option>5186</option><option>4326</option></select></td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}><button className="btn btn-s" onClick={()=>setUpStep(0)}>← 이전</button><button className="btn btn-p" onClick={()=>setUpStep(2)}>검토 →</button></div>
          </>}
          {upStep===2&&<>
            <div className="up-card">
              <div className="up-card-t">📋 등록 검토</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                <div style={{background:"var(--s2)",borderRadius:7,padding:10,textAlign:"center"}}><div className="mono" style={{fontSize:22,fontWeight:700}}>6</div><div style={{fontSize:9,color:"var(--t2)"}}>Item</div></div>
                <div style={{background:"var(--s2)",borderRadius:7,padding:10,textAlign:"center"}}><div className="mono" style={{fontSize:22,fontWeight:700}}>5</div><div style={{fontSize:9,color:"var(--t2)"}}>유형</div></div>
                <div style={{background:"var(--s2)",borderRadius:7,padding:10,textAlign:"center"}}><div className="mono" style={{fontSize:18,fontWeight:700}}>43.4GB</div><div style={{fontSize:9,color:"var(--t2)"}}>크기</div></div>
              </div>
              <div style={{display:"flex",gap:8}}><div style={{flex:1,padding:10,borderRadius:7,border:"2px solid var(--ok)",background:"rgba(61,214,140,.04)",cursor:"pointer"}}><div style={{fontSize:11,fontWeight:600,color:"var(--ok)"}}>✅ Published</div><div style={{fontSize:9,color:"var(--t2)"}}>바로 검색 가능</div></div>
                <div style={{flex:1,padding:10,borderRadius:7,border:"1px solid var(--bd)",cursor:"pointer"}}><div style={{fontSize:11,fontWeight:500,color:"var(--t2)"}}>📝 Draft</div><div style={{fontSize:9,color:"var(--t3)"}}>나중에 보완</div></div></div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}><button className="btn btn-s" onClick={()=>setUpStep(1)}>← 이전</button><button className="btn btn-ok" style={{fontSize:12}}>✅ 일괄 등록</button></div>
          </>}
        </>}

        {upMode==="single"&&<>
          <div className="up-steps">
            {["파일 업로드","메타데이터 입력","연관관계 설정","검토 및 제출"].map((s,i)=>
              <div key={i} className={`up-step ${i===upStep?"on":""} ${i<upStep?"done":""}`} onClick={()=>i<=upStep&&setUpStep(i)}>{i<upStep?"✓":i+1}. {s}</div>
            )}
          </div>
          {upStep===0&&<div className="up-card">
            <div className="up-card-t">📁 파일 선택</div>
            <div className="up-field"><label>소속 프로젝트 *</label><select><option value="">선택...</option>{COLLS.map(c=><option key={c.id} value={c.id}>{c.title} (EPSG:{c.epsg})</option>)}</select></div>
            {!upUploaded?<div className="dz" onClick={()=>setUpUploaded(true)}><div style={{fontSize:30,color:"var(--t3)",marginBottom:6}}>📄</div><div style={{fontSize:12,color:"var(--t2)"}}>파일을 드래그 또는 클릭</div></div>
            :<div style={{padding:10,background:"var(--s2)",borderRadius:7,border:"1px solid var(--ok)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{color:"var(--ok)"}}>✅</span><span className="mono" style={{fontSize:11}}>dabotap_scan.laz</span><span style={{fontSize:10,color:"var(--t2)"}}>2.14 GB</span></div>
              <div style={{marginTop:6,display:"flex",gap:4,flexWrap:"wrap"}}>{Object.entries(CATS).map(([k,ct])=><span key={k} style={{padding:"3px 8px",borderRadius:5,fontSize:9,border:`1px solid ${k==="pointcloud"?"var(--ac)":"var(--bd)"}`,color:k==="pointcloud"?"var(--ac)":"var(--t3)",cursor:"pointer",background:k==="pointcloud"?"rgba(74,114,255,.06)":"transparent"}}>{ct.icon} {ct.full}{k==="pointcloud"?" ✓":""}</span>)}</div>
            </div>}
            {upUploaded&&<div style={{textAlign:"right",marginTop:10}}><button className="btn btn-p" onClick={()=>setUpStep(1)}>다음 →</button></div>}
          </div>}
          {upStep===1&&<div className="up-card">
            <div className="up-card-t">📋 메타데이터 입력</div>
            <div className="up-auto"><div className="up-auto-hdr">⚡ 자동 추출 (구역 A)</div>
              {[["pc:count","15,230,482"],["pc:encoding","LAZ"],["pc:density","248 pts/m²"],["pc:has_rgb","true"]].map(([k,v])=><div key={k} className="up-auto-row"><span className="up-auto-k">{k}</span><span className="up-auto-v">{v}</span></div>)}
            </div>
            <div style={{marginTop:10}}><div style={{fontSize:11,fontWeight:600,color:"var(--t2)",marginBottom:6}}>필수 입력 (구역 B)</div>
              <div className="up-row2"><div className="up-field"><label>프로젝트명</label><input defaultValue="2024 경주 불국사 정밀실측" style={{background:"var(--autoB)",borderColor:"var(--autoBd)"}}/></div><div className="up-field"><label>대상 사이트</label><input defaultValue="경주 불국사" style={{background:"var(--autoB)",borderColor:"var(--autoBd)"}}/></div></div>
              <div className="up-row2"><div className="up-field"><label>좌표계 *</label><select><option>EPSG:5186</option><option>EPSG:4326</option></select></div><div className="up-field"><label>취득일</label><input placeholder="YYYY-MM-DD"/></div></div>
              <div className="up-field"><label>설명</label><textarea placeholder="데이터 설명"/></div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:10}}><button className="btn btn-s" onClick={()=>setUpStep(0)}>← 이전</button><button className="btn btn-p" onClick={()=>setUpStep(2)}>다음 →</button></div>
          </div>}
          {upStep===2&&<div className="up-card">
            <div className="up-card-t">🔗 연관관계 설정</div>
            <div style={{padding:16,background:"var(--s2)",borderRadius:7,textAlign:"center",color:"var(--t3)",fontSize:11}}>기존 Item을 검색하여 derived_from, related 등의 관계를 설정합니다</div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:10}}><button className="btn btn-s" onClick={()=>setUpStep(1)}>← 이전</button><button className="btn btn-p" onClick={()=>setUpStep(3)}>다음 →</button></div>
          </div>}
          {upStep===3&&<div className="up-card">
            <div className="up-card-t">📋 검토 및 제출</div>
            <div style={{fontSize:11,color:"var(--t2)",marginBottom:10}}>모든 정보를 확인하고 등록합니다</div>
            <div style={{display:"flex",justifyContent:"space-between"}}><button className="btn btn-s" onClick={()=>setUpStep(2)}>← 이전</button><button className="btn btn-ok">✅ 등록</button></div>
          </div>}
        </>}
      </div>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <div style={{height:"100vh",display:"flex",flexDirection:"column"}}>
        <div className="nav">
          <div className="nav-brand" onClick={()=>setPage("explorer")}>SAMS <span>v1.0</span></div>
          <div className={`ni ${page==="explorer"?"on":""}`} onClick={()=>setPage("explorer")}>Explorer</div>
          <div className={`ni ${page==="project"?"on":""}`} onClick={()=>setPage("project")}>Project</div>
          <div className={`ni ${page==="upload"?"on":""}`} onClick={()=>{setPage("upload");setUpStep(0);setUpUploaded(false);setUpAnalyzed(false);}}>Upload</div>
          <div style={{flex:1}}/>
          <div style={{fontSize:10,color:"var(--t3)"}}>{ITEMS.length}건 · {COLLS.length}개 프로젝트</div>
        </div>

        {page==="explorer"&&<ExplorerPage/>}
        {page==="detail"&&<DetailPage/>}
        {page==="project"&&<ProjectPage/>}
        {page==="upload"&&<UploadPage/>}

        {showModal&&<div className="modal-ov" onClick={()=>setShowModal(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
          <div className="modal-t">새 프로젝트 생성<button className="modal-x" onClick={()=>setShowModal(false)}>✕</button></div>
          <div className="mf-r2"><div className="mf"><label>프로젝트명 *</label><input placeholder="예: 2024 경주 불국사 정밀실측"/></div><div className="mf"><label>사이트 *</label><input placeholder="예: 경주 불국사"/></div></div>
          <div className="mf"><label>설명 *</label><textarea placeholder="프로젝트 목적과 범위"/></div>
          <div className="mf-r2"><div className="mf"><label>발주처</label><input placeholder="문화재청"/></div><div className="mf"><label>PM</label><input placeholder="홍길동"/></div></div>
          <div className="mf-r2"><div className="mf"><label>시작일</label><input placeholder="YYYY-MM-DD"/></div><div className="mf"><label>종료일</label><input placeholder="YYYY-MM-DD"/></div></div>
          <div className="mf"><label>기본 좌표계</label><select><option value="">선택...</option><option>EPSG:5186</option><option>EPSG:4326</option></select></div>
          <div style={{fontSize:11,fontWeight:600,color:"var(--t2)",marginTop:8,marginBottom:4}}>예상 산출물 (선택)</div>
          <div className="mf-exp">{Object.entries(CATS).map(([k,ct])=><div key={k} className="mf-exp-row"><span style={{color:ct.color,display:"flex",alignItems:"center",gap:3}}>{ct.icon} {ct.full}</span><input className="mf-exp-in" placeholder="0"/><input className="mf-exp-desc" placeholder="설명"/></div>)}</div>
          <div style={{fontSize:9,color:"var(--t3)",marginTop:3}}>※ 정확하지 않아도 됩니다. 나중에 수정 가능.</div>
          <div className="modal-foot"><button className="btn btn-s" onClick={()=>setShowModal(false)}>취소</button><button className="btn btn-p" onClick={()=>setShowModal(false)}>프로젝트 생성</button></div>
        </div></div>}
      </div>
    </>
  );
}
