"""
Spatial Converter API Server
3D 데이터 변환 서비스 (E57→PLY, PC→COPC, Mesh→3D Tiles)
"""

import os
import asyncio
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
import structlog
import httpx

from converter import SpatialConverter, ConversionType, ConversionStatus

# 로거 설정
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ]
)
logger = structlog.get_logger()

# 환경변수
STORAGE_PATH = os.getenv("STORAGE_PATH", "/var/lib/storage")
SUPABASE_URL = os.getenv("SUPABASE_URL", "http://kong:8000")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# 변환기 인스턴스
converter = SpatialConverter(storage_path=STORAGE_PATH)

# 진행 중인 변환 작업 추적
active_conversions: dict[str, ConversionStatus] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 수명주기 관리"""
    logger.info("spatial_converter_starting", storage_path=STORAGE_PATH)
    yield
    logger.info("spatial_converter_stopping")


app = FastAPI(
    title="Spatial Converter API",
    description="3D 데이터 변환 서비스 (E57→PLY, PC→COPC, Mesh→3D Tiles)",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === Request/Response Models ===

class ConversionRequest(BaseModel):
    """변환 요청"""
    file_id: str = Field(..., description="파일 ID")
    source_path: str = Field(..., description="원본 파일 Storage 경로")
    conversion_type: ConversionType = Field(..., description="변환 타입")
    options: Optional[dict] = Field(default=None, description="변환 옵션")


class ConversionResponse(BaseModel):
    """변환 응답"""
    job_id: str
    file_id: str
    status: str
    message: str


class ConversionStatusResponse(BaseModel):
    """변환 상태 응답"""
    job_id: str
    file_id: str
    status: str
    progress: int
    output_path: Optional[str] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    """헬스체크 응답"""
    status: str
    version: str
    pdal_version: str


# === API Endpoints ===

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """헬스체크 엔드포인트"""
    import subprocess
    try:
        result = subprocess.run(["pdal", "--version"], capture_output=True, text=True)
        pdal_version = result.stdout.split()[2] if result.returncode == 0 else "unknown"
    except Exception:
        pdal_version = "not installed"

    return HealthResponse(
        status="healthy",
        version="1.0.0",
        pdal_version=pdal_version
    )


@app.post("/convert", response_model=ConversionResponse)
async def start_conversion(
    request: ConversionRequest,
    background_tasks: BackgroundTasks
):
    """변환 작업 시작"""
    job_id = f"conv_{request.file_id}_{request.conversion_type.value}"

    # 이미 진행 중인 작업 확인
    if job_id in active_conversions:
        existing = active_conversions[job_id]
        if existing.status in ["pending", "converting"]:
            return ConversionResponse(
                job_id=job_id,
                file_id=request.file_id,
                status=existing.status,
                message="변환 작업이 이미 진행 중입니다."
            )

    # 원본 파일 존재 확인 (Supabase는 디렉토리 안에 UUID 파일로 저장)
    source_dir = Path(STORAGE_PATH) / "spatial-files" / request.source_path
    source_full_path = None
    original_format = None
    original_name = None

    if source_dir.is_dir():
        # 디렉토리 안의 첫 번째 파일 찾기 (UUID 이름의 실제 파일)
        files = list(source_dir.iterdir())
        if files:
            source_full_path = files[0]
        # 디렉토리 이름에서 원본 확장자 추출 (예: "file.obj" → "obj")
        dir_name = source_dir.name
        if '.' in dir_name:
            original_format = dir_name.rsplit('.', 1)[-1].lower()
            # 원본 파일명 추출 (Supabase 형식: "timestamp________filename.ext")
            if '________' in dir_name:
                original_name = dir_name.split('________', 1)[-1]
            else:
                original_name = dir_name
    elif source_dir.is_file():
        # 직접 파일인 경우
        source_full_path = source_dir
        original_format = source_dir.suffix.lstrip('.').lower()
        original_name = source_dir.name

    if not source_full_path or not source_full_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"원본 파일을 찾을 수 없습니다: {request.source_path}"
        )

    logger.info(
        "source_file_found",
        source_path=str(source_full_path),
        original_format=original_format
    )

    # 초기 상태 설정
    active_conversions[job_id] = ConversionStatus(
        job_id=job_id,
        file_id=request.file_id,
        status="pending",
        progress=0
    )

    # 옵션에 원본 정보 추가 (요청에 없는 경우에만)
    options = request.options or {}
    if original_format and "original_format" not in options:
        options["original_format"] = original_format
    if original_name and "original_name" not in options:
        options["original_name"] = original_name

    # 백그라운드 작업 시작
    background_tasks.add_task(
        run_conversion,
        job_id=job_id,
        file_id=request.file_id,
        source_path=str(source_full_path),
        conversion_type=request.conversion_type,
        options=options
    )

    logger.info(
        "conversion_started",
        job_id=job_id,
        file_id=request.file_id,
        conversion_type=request.conversion_type.value
    )

    return ConversionResponse(
        job_id=job_id,
        file_id=request.file_id,
        status="pending",
        message="변환 작업이 시작되었습니다."
    )


@app.get("/status/{job_id}", response_model=ConversionStatusResponse)
async def get_conversion_status(job_id: str):
    """변환 상태 조회"""
    if job_id not in active_conversions:
        raise HTTPException(
            status_code=404,
            detail=f"변환 작업을 찾을 수 없습니다: {job_id}"
        )

    status = active_conversions[job_id]
    return ConversionStatusResponse(
        job_id=status.job_id,
        file_id=status.file_id,
        status=status.status,
        progress=status.progress,
        output_path=status.output_path,
        error=status.error
    )


@app.get("/jobs")
async def list_jobs():
    """모든 변환 작업 목록"""
    return {
        "jobs": [
            {
                "job_id": s.job_id,
                "file_id": s.file_id,
                "status": s.status,
                "progress": s.progress
            }
            for s in active_conversions.values()
        ]
    }


@app.get("/output/{file_path:path}")
async def download_converted_file(file_path: str):
    """변환된 파일 다운로드 (하위 디렉토리 지원)"""
    output_path = Path("/app/output") / file_path

    # 보안: output 디렉토리 밖으로 경로 조작 방지
    try:
        output_path.resolve().relative_to(Path("/app/output").resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="잘못된 경로입니다")

    if not output_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"파일을 찾을 수 없습니다: {file_path}"
        )

    # 파일 확장자에 따른 MIME 타입 설정
    ext = output_path.suffix.lower()
    media_types = {
        ".ply": "application/octet-stream",
        ".las": "application/octet-stream",
        ".laz": "application/octet-stream",
        ".glb": "model/gltf-binary",
        ".gltf": "model/gltf+json",
        ".json": "application/json",
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=str(output_path),
        media_type=media_type,
        filename=output_path.name
    )


# === Background Task ===

async def run_conversion(
    job_id: str,
    file_id: str,
    source_path: str,
    conversion_type: ConversionType,
    options: Optional[dict]
):
    """백그라운드 변환 작업 실행"""
    try:
        # 상태 업데이트: 변환 중
        active_conversions[job_id].status = "converting"
        active_conversions[job_id].progress = 10

        # DB 상태 업데이트 (선택적)
        await update_file_conversion_status(file_id, "converting", 10)

        # 변환 실행
        result = await asyncio.to_thread(
            converter.convert,
            source_path=source_path,
            conversion_type=conversion_type,
            options=options or {},
            progress_callback=lambda p: update_progress(job_id, file_id, p)
        )

        if result.success:
            # 성공
            active_conversions[job_id].status = "ready"
            active_conversions[job_id].progress = 100
            active_conversions[job_id].output_path = result.output_path

            await update_file_conversion_status(file_id, "ready", 100, result.output_path)

            logger.info(
                "conversion_completed",
                job_id=job_id,
                file_id=file_id,
                output_path=result.output_path
            )
        else:
            # 실패
            active_conversions[job_id].status = "failed"
            active_conversions[job_id].error = result.error

            await update_file_conversion_status(file_id, "failed", 0, error=result.error)

            logger.error(
                "conversion_failed",
                job_id=job_id,
                file_id=file_id,
                error=result.error
            )

    except Exception as e:
        active_conversions[job_id].status = "failed"
        active_conversions[job_id].error = str(e)

        await update_file_conversion_status(file_id, "failed", 0, error=str(e))

        logger.exception(
            "conversion_error",
            job_id=job_id,
            file_id=file_id
        )


def update_progress(job_id: str, file_id: str, progress: int):
    """진행률 업데이트"""
    if job_id in active_conversions:
        active_conversions[job_id].progress = progress
    # 비동기 DB 업데이트는 생략 (빈번한 업데이트 방지)


async def update_file_conversion_status(
    file_id: str,
    status: str,
    progress: int,
    output_path: Optional[str] = None,
    error: Optional[str] = None
):
    """Supabase DB 파일 변환 상태 업데이트"""
    if not SUPABASE_SERVICE_KEY:
        logger.warning("supabase_service_key_not_set", file_id=file_id)
        return

    try:
        async with httpx.AsyncClient() as client:
            update_data = {
                "conversion_status": status,
                "conversion_progress": progress,
            }
            if output_path:
                update_data["converted_path"] = output_path
            if error:
                update_data["conversion_error"] = error

            response = await client.patch(
                f"{SUPABASE_URL}/rest/v1/files?id=eq.{file_id}",
                json=update_data,
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                }
            )

            if response.status_code >= 400:
                logger.warning(
                    "db_update_failed",
                    file_id=file_id,
                    status_code=response.status_code
                )
    except Exception as e:
        logger.warning("db_update_error", file_id=file_id, error=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8200,
        reload=os.getenv("DEV_MODE", "false").lower() == "true"
    )
