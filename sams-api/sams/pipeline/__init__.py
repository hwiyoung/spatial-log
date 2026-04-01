"""
SAMS 메타데이터 자동 채움 파이프라인

이것이 SAMS의 핵심 차별점이다. 다른 모든 기능보다 이것이 먼저.
상세 명세: docs/autofill_pipeline_spec.md

모듈 구성:
- detect.py   : 1단계 - 파일 유형 자동 판별 (확장자 + 매직바이트)
- extract.py  : 2단계 - 유형별 메타데이터 추출 (laspy, rasterio, trimesh, ffprobe, Pillow, PyPDF)
- inherit.py  : 3단계 - Collection 기본값 상속 + 이전 입력값 자동완성
- suggest.py  : 4단계 - 관계(links) 자동 제안 (파일명 매칭, 유형 계보)
- thumbnail.py: 5단계 - 썸네일 자동 생성 (비동기, Worker에서 실행)

실행 흐름:
  analyze(files, collection_id) -> manifest (자동 채움 완료 상태)

핵심 원칙:
  - 어떤 단계가 실패해도 등록은 진행 가능 (graceful degradation)
  - 1~4단계는 동기 (수 초 이내), 5단계만 비동기
"""
