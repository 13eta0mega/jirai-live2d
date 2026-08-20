# Jirai 2D Avatar v0.2.1 (원본 래스터 보존 런타임)

`jirai_*.png` 원본과 보수적으로 추출한 파츠를 사용하는 Web Canvas 기반 래스터 리그 런타임이다. 실제 Live2D Cubism `.moc3/.model3.json` 모델을 가장하지 않으며, 현재 자산 범위에서 실시간 캐릭터 반응성을 최대한 높이는 방향으로 구성한다.

## v0.2.1 재검수 수정

- 마이크 권한 승인 뒤 AudioContext 초기화가 실패해도 MediaStream과 AudioContext를 정리한다.
- microphone / external / test 전환 시 이전 RMS, adaptive noise floor, viseme 상태가 다음 모드에 남지 않도록 초기화한다.
- reset은 감정뿐 아니라 마이크, 외부 오디오, 테스트 립싱크, 입 상태, blink timer까지 수동 중립 상태로 되돌린다.
- 눈/입/effect crop 하나가 누락돼도 source PNG 런타임 전체가 초기화 실패하지 않는다.
- ResizeObserver가 없는 환경에서는 window resize 이벤트로 폴백한다.
- 디버그 DOM 갱신을 약 12.5 Hz로 제한해 Canvas 렌더 루프와 오디오 분석 간 간섭을 줄였다.
- A/I/U/E/O 분류, 무음 수렴, controller reset, 외부 오디오 모드, 마이크 초기화 실패 cleanup 회귀 테스트를 추가했다.

## 실행

```powershell
node .\tools\serve.mjs
```

브라우저에서 `http://127.0.0.1:4173/`을 연다. 마이크 립싱크는 브라우저의 마이크 권한 허용이 필요하다.

검증 명령:

```powershell
npm run check
npm test
```

## Runtime API

- `setEmotion(id, { duration, intensity })`
- `setMouthOpen(value)`
- `setViseme("A" | "I" | "U" | "E" | "O" | "CLOSED", weight)`
- `startMicrophoneLipSync()` / `stopMicrophoneLipSync()`
- `setAudioFeatures({ rms, low, mid, high })`
- `setBlinkEnabled()` / `setBreathEnabled()`

## 한계

현재 자산은 완전한 ArtMesh/Deformer가 아닌 단일 PNG + 제한된 crop 파츠이므로 머리카락/팔/몸통이 독립적으로 변형되는 2D mesh puppet 수준의 물리/워프에는 구조적 한계가 있다. 특히 `gorogoro`처럼 얼굴이 별도 파츠로 분리되지 않은 flattened source는 다른 포즈보다 표정/립싱크 자유도가 낮다.

Cubism을 사용하지 않더라도 이 한계는 레이어 분리 + mesh deformation 단계로 넘어가면 해결할 수 있다. 다음 단계 후보로는 layered PSD를 입력으로 하는 WebGL mesh rig, Rive/Spine, Inochi2D 같은 방식이 있다.
