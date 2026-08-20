# Jirai 2D Avatar — Articulated WebGL Rig v0.3.0-alpha.3

Cubism 없이 WebGL에서 동작하는 실험 2D puppet 런타임이다. `release/v0.2.1-raster`는 기존 Canvas 기반 안정 기준선으로 유지한다.

## v0.3.0-alpha.3 — articulated arm + emotion face QA

사용자 실행 녹화에서 확인된 “메시만 흔들리고 팔은 움직이지 않음”, 감정과 표정 불일치, 립싱크 입 파츠 고정 좌표/겹침 문제를 기준으로 렌더 구조를 다시 분리했다.

- **실제 팔 레이어 회전**: `stand`, `jump`, `peace` flattened PNG에서 좌/우 팔을 런타임 mask로 분리하고 shoulder pivot 기준 rigid rotation을 적용한다. `neutral → excited`는 양팔 world angle이 60° 이상 변해야 회귀 테스트를 통과한다.
- **팔 texture hand-off**: source가 바뀌어도 from/to arm layer가 같은 world angle을 유지한 채 짧은 midpoint hand-off를 수행한다. 긴 full-character dissolve를 피하기 위해 body texture hand-off window도 중앙 구간으로 좁혔다.
- **shoulder seam cover**: 팔 제거/회전 경계에 source shoulder patch를 다시 합성해 투명 구멍과 관절 seam을 줄인다.
- **감정별 얼굴 rig**: 16개 감정 각각 eye mode, eye scale, brow angle, mouth scale/shift를 따로 갖는다. `surprised`는 raised-arm `jump`, `scared`는 `uruuru` 계열로 semantic source를 수정했다.
- **감정별 viseme anchor**: A/I/U/E/O/CLOSED 입 모양이 감정별 mouth anchor와 safe bounds를 사용한다. transparent padding을 런타임 trim해 파츠 자체의 여백 때문에 입이 튀는 현상을 줄인다.
- **이중 눈/입 방지**: 원본 source의 눈·눈썹·입을 source 피부색 기반 feathered underpaint로 먼저 지운 뒤 overlay를 한 번만 렌더링한다.
- **표정 채널 보간**: 눈썹 → 눈 → 입 → 볼 순으로 서로 다른 timing curve를 사용하며 source 변경 중앙에는 blink bridge를 넣어 얼굴이 순간 교체되는 느낌을 줄인다. 감정의 `eyeOpen`을 blink로 오인해 open/closed 눈이 겹치던 경로도 제거했다.
- **엄격 QA UI**: 웹의 `엄격 전환/립싱크 QA`가 전환 시나리오 후 16개 감정 × 6개 viseme을 순회한다.

## 자동 검수

```powershell
npm run check
npm test
```

`tools/test_articulated_rig.mjs`는 다음을 실패 조건으로 둔다.

- `neutral → excited` 좌/우 팔 각도 변화와 120-frame 연속성
- arm texture hand-off 전후 동일 world angle 유지
- 장시간 full-character dissolve 재발
- 16개 감정의 명시적 eye mode/face anchor
- 16개 감정 × A/I/U/E/O/CLOSED mouth safe bounds
- 같은 source 감정들이 하나의 고정 mouth rect를 공유하는 회귀
- source-changing face transition의 blink bridge
- overlay padding trim, feathered underpaint, shoulder seam layer의 구조적 존재

실행:

```powershell
node .\tools\serve.mjs
```

브라우저에서 `http://127.0.0.1:4173/`을 연다. GitHub Pages 배포본에서는 `Show mesh`, `Show parameters`, `엄격 전환/립싱크 QA`를 함께 사용한다.

## 남는 구조적 한계

현재 원본은 완전한 layered PSD/ArtMesh가 아니라 flattened pose PNG이다. `stand`, `jump`, `peace`는 팔을 런타임 분리해 실제 shoulder rotation을 수행하지만 `uruuru`, `haku`, `gorogoro`는 가려진 팔/몸 픽셀이 없어 source hand-off와 proxy pose를 함께 사용한다. Cubism 수준의 팔꿈치/손목/머리카락 독립 운동까지 가려면 원본을 `UpperArm/LowerArm/Hand`, `Face`, `Eye`, `Mouth`, `Hair` 등으로 분리하는 단계가 필요하다.