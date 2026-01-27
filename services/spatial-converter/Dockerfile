# Spatial Converter Service
# PDAL + py3dtiles 기반 3D 데이터 변환 서비스

FROM ubuntu:22.04

# 비대화형 설치 모드
ENV DEBIAN_FRONTEND=noninteractive

# 시스템 패키지 설치
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    # PDAL 및 의존성 (E57 플러그인 포함)
    pdal \
    libpdal-dev \
    libpdal-plugins \
    # 빌드 도구
    build-essential \
    cmake \
    git \
    # 기타 유틸리티
    curl \
    wget \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Node.js 18 LTS 설치 (obj2gltf는 최신 JS 문법 필요)
RUN mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_18.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# gltfpack 설치 (메쉬 최적화 및 GLB 변환용)
RUN cd /tmp && \
    git clone --depth 1 https://github.com/zeux/meshoptimizer.git && \
    cd meshoptimizer && \
    mkdir build && cd build && \
    cmake .. -DMESHOPT_BUILD_GLTFPACK=ON && \
    make -j$(nproc) && \
    cp gltfpack /usr/local/bin/ && \
    cd / && rm -rf /tmp/meshoptimizer

# obj2gltf 설치 (OBJ → GLTF/GLB 변환용)
# gltf-transform 설치 (텍스처 압축용 - WebP/KTX2)
# sharp 설치 (이미지 리사이징용)
RUN npm install -g obj2gltf @gltf-transform/cli sharp

# Python 가상환경 생성
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# 작업 디렉토리
WORKDIR /app

# Python 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY . .

# 변환된 파일 저장 디렉토리
RUN mkdir -p /app/output /app/temp

# 환경변수
ENV STORAGE_PATH=/var/lib/storage
ENV OUTPUT_PATH=/app/output
ENV TEMP_PATH=/app/temp
ENV PYTHONUNBUFFERED=1

# API 서버 포트
EXPOSE 8200

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8200/health || exit 1

# 서버 시작
CMD ["python", "server.py"]
