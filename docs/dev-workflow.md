# 2인 1PC 개발 워크플로우

이 문서는 한 대의 개발 PC에서 두 명이 하나의 공식 repository를 collaborator 방식으로 함께 개발하는 운영 기준이다. 현재 목표는 production 배포가 아니라 `develop` 기준의 공용 통합 테스트 서버를 안정적으로 운영하는 것이다.

새 폴더를 만들고 개발 전 필수 설정만 빠르게 실행하려면 [dev-environment-setup.md](./dev-environment-setup.md)를 먼저 따른다.

## 브랜치 운영 원칙

| 브랜치 | 목적 | 규칙 |
| --- | --- | --- |
| `main` | 안정판 보관용 | 직접 개발하지 않는다. `develop` 검증 후 PR로만 반영한다. |
| `develop` | 통합 테스트용 | 직접 개발하지 않는다. feature/fix PR만 병합한다. |
| `feature/<name>-<task>` | 개인 기능 개발용 | 각 개발자가 자기 작업 단위별로 생성한다. |
| `fix/<issue>` | `develop` 통합 오류 수정용 | 통합 테스트 실패나 긴급 수정 사항을 고친다. |

기본 흐름은 `feature/* -> develop PR -> 통합 테스트 -> develop -> main PR`이다. 통합 테스트 중 발견된 오류는 `fix/*` 브랜치에서 수정하고 다시 `develop`으로 PR한다.

## 로컬 작업공간 구조

한 PC 안에서 아래처럼 repository clone을 분리한다.

```text
project-dev-me/             # 내 feature 개발용
project-dev-teammate/       # 팀원 feature 개발용
project-shared-runtime/     # develop 통합 테스트 실행용
```

`project-shared-runtime` 또는 `project-shared-develop`은 원칙적으로 코드 수정 금지 폴더다. 이 폴더는 `develop`을 pull한 뒤 `docker compose up -d --build`로 현재 통합 상태가 실행되는지 확인하는 데만 사용한다.

개인 feature 브랜치에서 컨테이너 테스트가 꼭 필요한 경우 각자 dev 폴더에서 임시 컨테이너를 띄우고, 테스트가 끝나면 `docker compose down`으로 컨테이너와 네트워크를 내린다. `docker compose down -v`는 DB와 MinIO 데이터를 삭제할 수 있으므로 자동으로 실행하지 않는다.

## 현재 Docker 구조

현재 compose stack은 다음 서비스를 실행한다.

| 서비스 | 내부 포트 | 기본 호스트 포트 |
| --- | ---: | ---: |
| PostgreSQL/PostGIS `db` | 5432 | 7432 |
| STAC API `stac-api` | 8080 | 8080 |
| SAMS API `sams-api` | 8000 | 8000 |
| MinIO API `minio` | 9000 | 9000 |
| MinIO Console `minio` | 9001 | 9001 |
| Redis `redis` | 6379 | 6379 |
| Frontend `frontend` | 3000 | 3000 |
| Nginx `nginx` | 80 | 7800 |

`docker-compose.yml`은 `container_name`을 지정하지 않는다. 따라서 `.env`의 `COMPOSE_PROJECT_NAME`이 다르면 컨테이너 이름과 네트워크 이름은 분리된다.

동시에 여러 stack을 띄우려면 컨테이너 이름뿐 아니라 호스트 포트와 bind mount 데이터 경로도 분리해야 한다. 이를 위해 compose는 다음 환경변수를 지원한다.

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

실제 비밀번호와 토큰은 `.env`에만 둔다. `.env`는 `.gitignore`에 포함되어 있으므로 commit하지 않는다. 공유용 예시는 `.env.example`을 사용한다.

## 최초 Clone 절차

공식 repository를 각 작업 폴더에 clone한다.

```bash
git clone https://github.com/hwiyoung/spatial-log.git project-dev-me
git clone https://github.com/hwiyoung/spatial-log.git project-dev-teammate
git clone https://github.com/hwiyoung/spatial-log.git project-shared-runtime
```

각 폴더에서 remote가 공식 repository인지 확인한다.

```bash
git remote -v
git fetch origin
```

공용 실행 폴더는 `develop`만 사용한다.

```bash
cd project-shared-runtime
git switch develop
cp .env.example .env
```

공용 `.env`에서는 예를 들어 다음 값을 사용한다.

```dotenv
COMPOSE_PROJECT_NAME=spatial_log_shared
SAMS_DATA_ROOT=/media/innopam/InnoPAM-8TB/sams-data
```

## Feature 브랜치 생성

개인 dev 폴더에서 항상 최신 `develop`을 기준으로 feature 브랜치를 만든다.

```bash
cd project-dev-me
git switch develop
git pull --ff-only origin develop
git switch -c feature/hwiyoung-upload-validation
```

팀원도 같은 방식으로 자기 이름과 작업명을 넣는다.

```bash
git switch -c feature/smcho-map-layer
```

## Feature 작업 후 Push 및 PR

작업 후 로컬 검사를 수행하고 push한다.

```bash
git status
git add <changed-files>
git commit -m "feat: add upload validation"
git push -u origin feature/hwiyoung-upload-validation
```

GitHub에서 `feature/hwiyoung-upload-validation -> develop` 방향으로 PR을 만든다. PR 설명에는 변경 목적, 테스트 결과, Docker 실행 여부를 적는다.

## PR 충돌 해결

PR에서 충돌이 발생하면 feature 브랜치에서 해결한다. `develop`에서 직접 고치지 않는다.

merge 방식:

```bash
git switch feature/hwiyoung-upload-validation
git fetch origin
git merge origin/develop
# conflict 수정
git add <resolved-files>
git commit
git push
```

rebase 방식:

```bash
git switch feature/hwiyoung-upload-validation
git fetch origin
git rebase origin/develop
# conflict 수정
git add <resolved-files>
git rebase --continue
git push --force-with-lease
```

공동 작업 중인 feature 브랜치가 아니라면 rebase를 사용할 수 있다. 이미 다른 사람이 같은 feature 브랜치를 기반으로 작업 중이면 merge 방식이 더 안전하다.

## Develop 통합 테스트 실행

feature PR이 `develop`에 merge되면 shared-runtime 폴더에서 최신화 후 재기동한다.

```bash
cd project-shared-runtime
git switch develop
git pull --ff-only origin develop
docker compose up -d --build
docker compose ps
```

스크립트를 사용할 수도 있다.

```bash
./scripts/run-shared-dev.sh
```

Windows PowerShell에서는 다음을 사용한다.

```powershell
.\scripts\run-shared-dev.ps1
```

주요 확인 URL은 다음과 같다.

```text
Nginx:     http://localhost:7800
Frontend: http://localhost:3000
SAMS API: http://localhost:8000/health
STAC API: http://localhost:8080/
MinIO UI: http://localhost:9001/
```

## 통합 테스트 실패 시 Fix 브랜치

`develop` 통합 테스트에서 오류가 나면 shared-runtime에서 직접 수정하지 않는다. 개인 dev 폴더에서 `develop` 기준으로 fix 브랜치를 만든다.

```bash
cd project-dev-me
git switch develop
git pull --ff-only origin develop
git switch -c fix/upload-validation-integration
```

수정 후 `fix/upload-validation-integration -> develop` PR을 만들고, merge 후 shared-runtime에서 다시 통합 테스트를 실행한다.

## Develop 안정화 후 Main 반영

`develop`이 충분히 검증되면 GitHub에서 `develop -> main` PR을 만든다. `main`은 안정판 보관용이므로 직접 push하지 않는다.

```text
base: main
compare: develop
```

현재 단계에서는 `main`용 production 배포 구조를 만들지 않는다.

## 공용 컨테이너 사용 주의사항

공용 컨테이너는 `develop` 상태를 대표한다. feature 브랜치 검증용으로 계속 바꾸지 않는다.

`project-shared-runtime`에서는 다음 작업을 금지한다.

- feature 코드 수정
- 실험용 commit 생성
- DB 초기화
- Docker volume 삭제
- 임의의 `docker compose down -v`
- 원격 브랜치 삭제

공용 컨테이너는 한 번에 한 상태만 보여준다. 두 사람이 동시에 서로 다른 feature를 서버에서 확인할 수 없고, 한 사람이 재빌드하는 동안 다른 사람의 확인 흐름이 끊길 수 있다.

## 개인 임시 컨테이너 절차

feature 브랜치를 컨테이너로 꼭 확인해야 하면 개인 dev 폴더에서 임시 실행한다.

```bash
cd project-dev-me
git switch feature/hwiyoung-upload-validation
./scripts/run-local-temp.sh
```

Windows PowerShell:

```powershell
.\scripts\run-local-temp.ps1
```

이 스크립트는 현재 브랜치 이름을 기반으로 임시 `COMPOSE_PROJECT_NAME`, 임시 호스트 포트, 임시 `SAMS_DATA_ROOT`를 잡는다. 출력된 URL로 테스트한다.

테스트 후 반드시 내린다.

```bash
./scripts/down-local-temp.sh
```

Windows PowerShell:

```powershell
.\scripts\down-local-temp.ps1
```

동시에 두 명이 개인 임시 컨테이너를 띄울 때 포트가 겹치면 한쪽에서 offset을 지정한다.

```bash
SPATIAL_LOG_PORT_OFFSET=100 ./scripts/run-local-temp.sh
```

PowerShell:

```powershell
$env:SPATIAL_LOG_PORT_OFFSET = "100"
.\scripts\run-local-temp.ps1
```

임시 컨테이너 종료 스크립트는 컨테이너와 네트워크만 내린다. bind mount 데이터는 `.docker-data/` 아래에 남는다. 데이터까지 지워야 하는 경우에도 자동화하지 말고, 삭제 대상 경로를 눈으로 확인한 뒤 수동으로 처리한다.

임시 컨테이너를 실행한 뒤 다른 브랜치로 이동했다면 종료 스크립트가 같은 project name을 자동 계산하지 못할 수 있다. 이 경우 실행 때 출력된 `COMPOSE_PROJECT_NAME`을 지정하고 종료한다.

```bash
COMPOSE_PROJECT_NAME=spatial_log_innopam_feature_upload_temp ./scripts/down-local-temp.sh
```

## 표준 작업 흐름 10줄 요약

1. 개인 dev 폴더에서 `develop`을 최신화한다.
2. `feature/<name>-<task>` 브랜치를 만든다.
3. feature 브랜치에서만 코드를 수정한다.
4. 필요하면 개인 dev 폴더에서 임시 컨테이너를 실행한다.
5. 테스트 후 개인 임시 컨테이너는 `docker compose down`으로 내린다.
6. feature 브랜치를 push하고 `develop`으로 PR을 만든다.
7. 충돌은 feature 브랜치에서 `origin/develop` merge 또는 rebase로 해결한다.
8. PR merge 후 shared-runtime에서 `develop`을 pull하고 공용 컨테이너를 재빌드한다.
9. 통합 테스트 실패는 `fix/<issue>` 브랜치에서 수정하고 다시 `develop`으로 PR한다.
10. `develop` 검증이 끝나면 `develop -> main` PR로 안정판을 보관한다.
