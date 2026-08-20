# 래스터 자산 편집 로그

## 2026-08-20

- 원본 6개 PNG를 `assets/source/`로 복사했다. 원본 바이트는 변경하지 않았다.
- `tools/analyze_sources.py`로 RGBA 모드, 크기, alpha bbox, 중심, SHA-256을 기록했다.
- `assets/aligned/reference_sheet.png`와 `assets/aligned/aligned_comparison.png`는 분석용 파생 이미지다.
- `tools/export_parts.py`는 원본의 작은 crop과 색 기반 alpha mask만 만들었다. 새 캐릭터 그림·SVG·AI 생성은 사용하지 않았다.
- 자동 crop 중 눈·입은 경계 오검출 가능성이 있으므로 최종 사용 전 사람이 mask와 underpaint를 확인해야 한다.

## 수작업 필요 목록

1. 앞머리/얼굴 가장자리의 underpaint 확장
2. 팔·소매·어깨가 분리될 때 드러나는 피부/옷 영역 복원
3. 치마 아래 허벅지와 다리 교차부 복원
4. 양갈래 머리 뿌리와 눈꺼풀 주변의 overscan
5. 눈·입 ArtMesh 경계와 스타킹 격자 수동 검수
6. Cubism에서 각 expression/motion 키폼과 physics를 직접 조정

이 목록을 완료하기 전에는 자동 산출물을 완성된 `.moc3` 모델로 간주하지 않는다.

