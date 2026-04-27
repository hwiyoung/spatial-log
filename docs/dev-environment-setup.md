# 개발 전 필수 세팅

새 작업 폴더를 만들었거나 기존 폴더를 개발용으로 쓰기 전에 아래 순서대로 실행한다. 운영 원칙과 이유는 [dev-workflow.md](./dev-workflow.md)를 본다.

## 1. 폴더 역할 정하기

먼저 이 폴더의 역할을 하나로 정한다.

```text
project-dev-me             개인 feature 개발용
project-dev-teammate       팀원 feature 개발용
project-shared-runtime     develop 통합 테스트 실행용
```

## 2. Clone

필요한 폴더만 clone한다. 일반 `git clone`은 repository를 받아오고 기본 브랜치를 checkout한다. feature 브랜치는 clone 단계에서 만들지 않는다.

```bash
git clone https://github.com/hwiyoung/spatial-log.git project-dev-me
git clone https://github.com/hwiyoung/spatial-log.git project-dev-teammate
git clone https://github.com/hwiyoung/spatial-log.git project-shared-runtime
```

작업할 폴더로 이동한다.

```bash
cd project-dev-me
```

## 3. Remote 확인

```bash
git remote -v
```

`origin`이 공식 repository를 가리키는지 확인한다.

```text
https://github.com/hwiyoung/spatial-log.git
```

## 4. Git 사용자 설정

각 폴더에서 commit 작성자를 local config로 고정한다. `--global`을 붙이지 않으면 현재 repository 폴더에만 적용된다.

```bash
git config user.name "Your Name"
git config user.email "your-email@example.com"
```

확인한다.

```bash
git config user.name
git config user.email
```

## 5. 브랜치 맞추기

개인 개발 폴더는 clone 후 `develop`을 최신화한 뒤 feature 브랜치를 새로 만든다.

```bash
git switch develop
git pull --ff-only origin develop
git switch -c feature/yourname-task-name
```

이미 작업 중인 feature 브랜치가 있다면 새로 만들지 않고 그 브랜치로 이동한다.

```bash
git switch feature/yourname-task-name
git pull --ff-only
```

공용 실행 폴더는 `develop`만 사용한다.

```bash
git switch develop
git pull --ff-only origin develop
```

## 6. .env 만들기

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

## 7. shared-runtime .env 설정

`project-shared-runtime/.env`는 아래처럼 설정한다.

```dotenv
COMPOSE_PROJECT_NAME=spatial_log_shared
SAMS_DATA_ROOT=/media/innopam/InnoPAM-8TB/sams-data

POSTGRES_HOST_PORT=7432
STAC_API_HOST_PORT=8080
SAMS_API_HOST_PORT=8000
MINIO_API_HOST_PORT=9000
MINIO_CONSOLE_HOST_PORT=9001
REDIS_HOST_PORT=6379
FRONTEND_HOST_PORT=3000
NGINX_HOST_PORT=7800
```

`DB_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`는 실제 개발용 값으로 바꾼다.

## 8. 개인 개발 폴더 .env 설정

개인 개발 폴더에서는 공용 실행 폴더와 값이 겹치지 않게 설정한다.

예시:

```dotenv
COMPOSE_PROJECT_NAME=spatial_log_hwiyoung_temp
SAMS_DATA_ROOT=/media/innopam/InnoPAM-8TB/sams-data-hwiyoung-temp

POSTGRES_HOST_PORT=17432
STAC_API_HOST_PORT=19080
SAMS_API_HOST_PORT=18000
MINIO_API_HOST_PORT=19100
MINIO_CONSOLE_HOST_PORT=19200
REDIS_HOST_PORT=16379
FRONTEND_HOST_PORT=13000
NGINX_HOST_PORT=17800
```

팀원 폴더는 다른 project name, data root, port를 사용한다.

예시:

```dotenv
COMPOSE_PROJECT_NAME=spatial_log_teammate_temp
SAMS_DATA_ROOT=/media/innopam/InnoPAM-8TB/sams-data-teammate-temp

POSTGRES_HOST_PORT=27432
STAC_API_HOST_PORT=29080
SAMS_API_HOST_PORT=28000
MINIO_API_HOST_PORT=29100
MINIO_CONSOLE_HOST_PORT=29200
REDIS_HOST_PORT=26379
FRONTEND_HOST_PORT=23000
NGINX_HOST_PORT=27800
```

## 9. Compose 설정 검증

컨테이너를 올리기 전에 compose 설정을 확인한다.

```bash
docker compose config --quiet
```

실제 적용된 포트와 데이터 경로를 보고 싶으면 다음을 실행한다.

```bash
docker compose config
```

## 10. 공용 실행 폴더 컨테이너 실행

`project-shared-runtime`에서만 실행한다.

```bash
./scripts/run-shared-dev.sh
```

Windows PowerShell:

```powershell
.\scripts\run-shared-dev.ps1
```

## 11. 개인 임시 컨테이너 실행

개인 feature 브랜치를 컨테이너로 확인해야 할 때만 실행한다.

```bash
./scripts/run-local-temp.sh
```

Windows PowerShell:

```powershell
.\scripts\run-local-temp.ps1
```

## 12. 개인 임시 컨테이너 종료

테스트가 끝나면 바로 내린다.

```bash
./scripts/down-local-temp.sh
```

Windows PowerShell:

```powershell
.\scripts\down-local-temp.ps1
```

## 13. 최종 확인

개발 시작 전에 아래 결과를 확인한다.

```bash
git branch --show-current
git status --short
git config user.name
git config user.email
docker compose config --quiet
```

shared-runtime은 `develop`이어야 한다. 개인 개발 폴더는 `feature/*` 또는 `fix/*`여야 한다.

## 금지

아래 명령은 세팅 과정에서 실행하지 않는다.

```bash
docker compose down -v
docker volume rm
docker system prune --volumes
git push origin --delete <branch>
```
