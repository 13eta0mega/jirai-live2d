# Jirai 2D Avatar — WebGL Mesh Rig Alpha

이 브랜치는 `release/v0.2.1-raster`의 안정적인 Canvas 기반 런타임을 보존한 상태에서, Cubism 없이 자체 2D mesh puppet 엔진으로 이동하기 위한 실험 브랜치다.

## Branch strategy

- `release/v0.2.1-raster`: 기존 PNG/crop 기반 안정 버전. 회귀 기준선으로 유지한다.
- `feature/webgl-mesh-rig`: WebGL mesh deformation + secondary physics 실험. 현재 브랜치다.

## v0.3.0-alpha.1

- 원본 투명 PNG를 기본 24×28 grid로 tessellation한다.
- 머리/상체/좌우 외곽/하체 영역에 서로 다른 influence mask를 적용한다.
- `ParamAngleX/Y/Z`, `ParamBodyAngleX/Z`, `ParamBreath`, `ParamMouthOpenY`, `ParamMouthForm`, `ParamCheek`를 실제 vertex deformation에 사용한다.
- 좌우 머리카락, 치마, body lag에 damped spring secondary motion을 적용한다.
- 기존 eye/mouth crop은 별도 WebGL textured quad로 렌더링해 blink와 A/I/U/E/O viseme을 유지한다.
- 감정 preset의 source/bodyMotion/pose를 mesh transform과 물리에 연결한다.
- WebGL 초기화 실패 시 기존 Canvas controller로 자동 fallback한다.
- mesh wireframe debug 표시와 순수 deformation/physics 회귀 테스트를 추가한다.

## 왜 이 구조인가

현재 원본은 완전히 분리된 PSD/ArtMesh가 아니므로 한 번에 완전한 puppet으로 바꾸는 것은 불가능하다. 대신 렌더러와 parameter/physics 계층을 먼저 mesh 기반으로 전환하면, 이후 `Hair_Back`, `TwinTail_L/R`, `Face`, `Eye_L/R`, `Mouth`, `Torso`, `Arm_L/R`, `Skirt` 등의 분리 레이어가 생겼을 때 각 레이어를 별도 mesh/texture로 추가할 수 있다. 립싱크, 감정 state, spring solver는 그대로 재사용한다.

## 실행 및 검사

```powershell
node .\tools\serve.mjs
npm run check
npm test
```

브라우저에서 `http://127.0.0.1:4173/`을 연다. `Show mesh`로 실제 변형 grid를 확인할 수 있다.

## 다음 품질 단계

1. 얼굴/앞머리/뒷머리/트윈테일/몸통/팔/치마를 투명 레이어로 분리한다.
2. 레이어별 grid density와 pivot/influence map을 별도로 정의한다.
3. 얼굴에는 눈썹/눈/입 독립 mesh와 perspective correction을 적용한다.
4. 팔과 상체는 2~3 bone weighted mesh로 전환한다.
5. 머리카락과 치마는 chain spring 또는 Verlet constraint로 확장한다.
6. 필요 시 webcam/head tracking 출력을 현재 parameter bus에 연결한다.

이 단계까지 가면 Cubism 없이도 현재 flattened PNG 방식보다 훨씬 높은 수준의 실시간 2D puppet을 만들 수 있다.
