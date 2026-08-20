# 대안 런타임

현재 구현은 Web Canvas 기반 래스터 cutout이다. 이 방식은 원본 PNG와 캐릭터성을 유지하고, 감정 전환·호흡·blink·입 슬라이더를 즉시 검증하기 위한 선택이다.

## Spine 2D

전신 포즈 전환을 더 많이 섞어야 하면 Spine의 bone/mesh/skin으로 `stand/jump/peace/uruuru/gorogoro/haku`를 attachment로 옮긴다. 기존 source를 그대로 사용할 수 있지만 별도 Spine 라이선스와 export가 필요하다.

## Cubism

얼굴 미세 표현과 Live2D SDK 호환이 우선이면 `docs/cubism_manual_steps.md`대로 수작업 ArtMesh를 완성한다. 이때 자동 crop은 참고용이고, underpaint/mesh 품질을 사람이 승인해야 한다.

## 커스텀 WebGL/Pixi

브라우저 전용이라면 현재 Canvas Controller의 draw layer를 Pixi mesh로 교체할 수 있다. `AvatarController` API와 emotion config는 그대로 유지한다.

