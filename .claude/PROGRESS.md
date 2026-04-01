# 작업 진행 상황

## 운영-개발 환경 동기화 - 2026-02-20

### 요구사항
운영 DB에 git 외부에서 직접 적용된 변경사항을 정리하고, 개발-운영 환경을 동일한 상태로 맞춘다.

발견된 불일치 항목 (6개):
1. files 테이블 5개 컬럼 (status, asset_type, description, url, body) — 운영 적용됨, 개발 누락
2. releases 테이블 3개 컬럼 (password_hash, expires_at, view_count) — 운영 적용됨, 개발 누락
3. files/folders RLS (uid=user_id → role=authenticated) — 운영만 적용, git 미추적
4. storage.objects RLS — 개발 uid=owner, 운영 role=authenticated, schema.sql은 role=authenticated
5. scene_entries CHECK — 개발 spatial/visual/document/note (코드와 일치), 운영 asset/memo (불일치)
6. files status/asset_type 타입 — 운영 VARCHAR(20), 개발 TEXT (migration 003 기준 TEXT)

### 진행 체크리스트

#### Phase A: 계획
- [x] A1. 계획 수립
- [x] A2. 계획 검토 (소급: 논리적 문제 없음)
- [x] A3. 과도 설계 검토 (소급: 과도 설계 아님)
- [x] GATE: 사용자 승인

#### Phase B: 구현
- [x] B1. 구현
- [x] B2. 목적 부합 검토 (소급: 6개 차이점 해소, 목적 부합)
- [x] B3. 버그/보안 검토 (소급: 4개 이슈 발견 → 수정 완료)
- [x] B4. 수정사항 재검토 (소급: TSC 통과, schema.sql 에러 없음)

#### Phase C: 코드 품질
- [x] C1. 파일/함수 분리 (소급: 분리 불필요)
- [x] C2. 코드 통합/재사용 검토 (소급: 문제 없음)
- [x] C3. 사이드이펙트 확인 (소급: DB 양쪽 일치, 앱 영향 없음)
- [x] C4. 불필요 코드 정리 (소급: 제거할 코드 없음)
- [x] C5. 코드 품질 검토 (소급: 양호)
- [x] GATE: 변경사항 보고

### 회귀 기록
- 소급 검토: B1 완료 및 커밋(7cce96b) 후 A2~C5 단계를 건너뛴 것을 발견. 소급 수행.
- B3→B1 회귀: B3 검토에서 schema.sql 누락 4건 발견, 추가 수정 필요

### 발견된 이슈 및 결정사항
- [B3] schema.sql files.status/asset_type에 NOT NULL 누락 → 수정 완료
- [B3] schema.sql scenes CREATE TABLE에 zone_label/summary 컬럼 누락 → 수정 완료
- [B3] schema.sql scene_entries CREATE TABLE에 url 컬럼 누락 → 수정 완료
- [B3] schema.sql RLS 주석이 구식 (자신의 데이터 → 팀 공유) → 수정 완료

---

## Storage RLS 팀 공유 정책 통일 - 2026-02-21

### 요구사항
files/folders 테이블은 팀 공유(authenticated 전체 접근)인데, storage.objects는 사용자별 격리(005_security_hardening)로 불일치.
→ 파일 목록은 보이지만 다운로드/가시화가 차단되는 문제 발생. 팀 공유 모델로 통일.

### 작업 규모: 소규모 (파일 2개) → Phase B만 적용

#### Phase B: 구현
- [x] B1. 구현
  - 007_storage_team_shared.sql 생성 (Storage RLS READ/DELETE → 팀 공유, INSERT → 사용자 폴더 유지)
  - schema.sql Storage 정책 동기화 (정책 이름 + INSERT 폴더 제한 반영)
  - 개발 DB 적용 완료
- [x] B2. 목적 부합 검토: DB↔Storage 불일치 해소, 팀 공유 모델에 부합
- [x] B3. 버그/보안 검토: 멱등성 보완 (새 정책 이름도 DROP IF EXISTS 추가)
- [x] B4. 수정사항 재검토: B3 추가분 영향 없음, schema.sql↔007 정책 일치 확인

### 발견된 이슈
- storage.objects 소유자가 supabase_storage_admin → postgres 슈퍼유저로 한 문장씩 실행해야 함
- heredoc 방식 전달 시 SET ROLE 세션 문제 발생 → 개별 docker exec로 해결
- 운영 DB 적용 대기 중
