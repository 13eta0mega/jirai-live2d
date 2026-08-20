# Jirai 원본 분석

이 프로젝트는 `C:\Users\13eta\Downloads\Mobile Devices`에서 복사한 6개의 RGBA PNG를 기준으로 한다. 원본은 `assets/source/`에 복사되어 있으며 읽기 전용으로 취급한다. SVG 자동 트레이싱, AI 재생성, 다른 화풍의 재해석은 사용하지 않았다.

## 파일·알파 분석

| 파일 | 크기 | alpha bbox (x1,y1,x2,y2) | bbox 크기 | 비고 |
|---|---:|---|---:|---|
| `jirai_stand.png` | 259×270 | (39,11,218,252) | 179×241 | 기본 정면/의상/다리 기준 |
| `jirai_jump.png` | 300×273 | (35,14,278,248) | 243×234 | 양팔을 벌린 점프/큰 웃음 |
| `jirai_peace.png` | 259×270 | (32,17,225,255) | 193×238 | 윙크·전방 손 |
| `jirai_uruuru.png` | 270×246 | (41,18,226,222) | 185×204 | 초롱초롱 눈·손 모으기 |
| `jirai_gorogoro.png` | 270×246 | (7,22,254,205) | 247×183 | 누운 편안한 자세 |
| `jirai_haku.png` | 250×246 | (27,13,210,229) | 183×216 | 크게 열린 입·무지개 이펙트 |

정확한 SHA-256, alpha coverage, 중심점은 자동 산출된 [`qa/source_analysis.json`](../qa/source_analysis.json)에 기록했다. 비교용 산출물은 [`assets/aligned/reference_sheet.png`](../assets/aligned/reference_sheet.png)와 [`assets/aligned/aligned_comparison.png`](../assets/aligned/aligned_comparison.png)이다. 두 이미지는 작업 참고용이며 원본을 대체하지 않는다.

## 기준 좌표·랜드마크

`jirai_stand.png`를 공통 좌표계의 기준으로 사용한다. 머리·얼굴 중심은 alpha bbox의 상단과 중앙을 기준으로 잡고, 눈·입·가슴 하트는 표정 파츠를 추출할 때의 수동 crop box로 관리한다. crop 좌표와 소스 파일은 [`assets/parts/parts_manifest.json`](../assets/parts/parts_manifest.json)에 기록했다.

주요 공통 특징은 검은 단발과 분홍 포인트, 양갈래 머리, 흰 토끼 머리핀, 검정 의상과 가슴 하트, 레이스·스타킹 격자무늬다. 이 특징은 모든 상태의 정체성 기준으로 유지한다.

## 재사용·복원 판단

- 그대로 재사용: 머리/헤어핀/귀/의상/신발/스타킹의 대부분, `stand`의 기본 실루엣, `jump`의 양팔과 큰 웃음, `peace`의 윙크 손, `uruuru`의 초롱초롱 눈, `gorogoro`의 누운 실루엣, `haku`의 무지개 효과.
- 파츠 스왑이 필요한 영역: 눈(기본·웃는 눈·초롱초롱·윙크), 입(CLOSED/SMALL/A/I/U/E/O/SMILE/SICK-WIDE), 완전히 다른 팔·다리 포즈, 누운 자세, 무지개 이펙트.
- deformation으로 가능한 영역: 작은 얼굴 기울기, 눈썹 높이/각도, 볼 붉힘, 머리·몸의 미세한 흔들림, 양갈래 지연, 호흡, 입 모양의 작은 변화.
- 수작업 underpaint가 필요한 영역: 앞머리 뒤 이마, 얼굴 옆 머리카락 뒤, 팔이 몸통에서 떨어질 때의 어깨·소매, 치마 아래 허벅지, 다리 교차부, 양갈래 뿌리, 눈꺼풀 주변, 크게 열린 입 내부.

자동 추출된 파츠는 안전한 참고 crop이며 최종 Cubism ArtMesh가 아니다. 눈·입 mask는 사람이 경계를 정리해야 하고, 몸·팔·다리 파츠는 움직임 방향의 overscan/underpaint를 추가해야 한다.

## 방식 선택

현재 산출물은 원본 PNG를 보존하면서 감정 전환·blink·breath·lip-sync를 검증할 수 있는 Web Canvas 래스터 cutout 런타임이다. 완전한 `.cmo3/.moc3/.model3.json`은 Cubism Editor에서 직접 mesh/deformer를 확인해야 하므로 생성하지 않았다. 실제 배포용 Cubism 모델로 이어갈 수 있도록 리그 파라미터, 레이어 구조, 수작업 체크포인트를 별도 문서로 제공한다. 전신 포즈 스왑이 많은 이 소스에는 이 단계적 방식이 캐릭터성을 가장 안전하게 보존한다.

