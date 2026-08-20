# Jirai 2D Avatar — WebGL Mesh Rig v0.3.0-alpha.2

Cubism 없이 WebGL mesh deformation + secondary physics로 동작하는 실험 런타임이다. `release/v0.2.1-raster`는 기존 Canvas 기반 안정 기준선으로 유지한다.

## v0.3.0-alpha.2 — visual/transition QA hotfix

업로드된 실제 실행 녹화를 기준으로 다음 회귀를 수정했다.

- **상하 반전 수정**: DOM 이미지와 같은 top-origin UV를 쓰면서 `UNPACK_FLIP_Y_WEBGL`을 다시 적용하던 이중 반전을 제거했다.
- **눈/입 좌표 수정**: 얼굴 파츠 좌표를 source 중심 좌표로 명시하고 crop manifest의 실제 source box와 회귀 테스트로 고정했다.
- **같은 source 감정 전환**: 캐릭터 전체 cross-fade를 제거하고 expression/pose/body parameter를 프레임마다 직접 보간한다.
- **다른 source 포즈 전환**: 두 이미지를 별도 alpha 레이어로 겹치지 않고 하나의 shared mesh에서 texture hand-off한다. 중간 프레임에는 팔/상체 lift, spread, squash, lean 등의 transition warp가 실제 vertex에 적용된다.
- **중립 → 신남 / 신남 → 중립**: jump transition에서 팔 영역이 중간 프레임을 거쳐 이동하고, body impulse/scale pulse가 함께 적용된다.
- **one-shot motion 연속성**: transition 종료 시 `jump_once`/`startle` 같은 동작 시간이 0으로 재시작하지 않도록 target motion age를 이어간다.
- **QA 가시성**: debug parameter에 transition progress/source mix/motion을 표시하고, `엄격 전환 QA` 시나리오 시간을 늘려 실제 중간 프레임을 확인할 수 있게 했다.

## 검수 기준

`tools/test_mesh_visual_regression.mjs`에서 texture Y-flip 재발, 얼굴 crop 좌표, same-source full-character fade, neutral→excited arm in-between, texture hand-off 연속성, mesh NaN/Infinity를 자동 검증한다.

```powershell
npm run check
npm test
```

실행:

```powershell
node .\tools\serve.mjs
```

브라우저에서 `http://127.0.0.1:4173/`을 연다. GitHub Pages 배포본에서는 `Show mesh`와 `엄격 전환 QA`를 함께 사용하면 transition geometry를 직접 확인할 수 있다.

## 자산 구조상 남는 한계

현재 source는 완전한 layered PSD/ArtMesh가 아니라 flattened pose PNG이므로, 팔/머리카락의 진짜 관절 회전이나 가려진 영역 복원에는 한계가 있다. 이번 버전은 그 범위 안에서 **pure fade가 아닌 실제 mesh in-between**을 제공한다. 다음 품질 단계는 `Hair_Back`, `TwinTail_L/R`, `Face`, `Eye_L/R`, `Mouth`, `Torso`, `Arm_L/R`, `Skirt`를 독립 texture/mesh로 분리하는 것이다.
