# ADR: 3D 관계뷰 렌더러 — deck.gl 채택 (map-grounded 유지)
Status: Accepted (supersedes ADR-3d-gis-map-grounded-renderer 일부)

Context: 관계뷰 렌더러가 3개 병렬(map-grounded=MapLibre+three / three /
pseudo, ~1,800줄). v1 핵심은 map-grounded 관계뷰. three custom layer 직접
유지 vs 목적-제작 라이브러리.

Decision: 관계뷰를 deck.gl(@deck.gl/mapbox MapboxOverlay, interleaved) 위에
구현. ArcLayer=관계선, IconLayer=글리프 노드, TextLayer=라벨. 기존 CARTO dark
MapLibre 지도 위에 얹음. three·pseudo 렌더러 폐기.

Consequences:
+ 관계선/마커/3D 카메라/picking 기성품 → 코드 대폭 감소, 2D 지도 재사용.
+ 렌더러 3중 병렬 부채 해소.
- net-new 구현(기존 three 관계뷰 폐기) — 보안/실데이터 P0 이후 착수.
- ArcLayer 점선 미지원 → 6종은 색/높이/굵기로 구분(필요시 PathStyleExtension).
- interleaved는 maplibre-gl>3 필요(현 버전 충족 확인 요).