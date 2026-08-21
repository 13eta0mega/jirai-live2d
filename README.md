# Jirai 2D Avatar — Hybrid Articulated WebGL Rig v0.4.0-alpha.1

Cubism 없이 WebGL에서 동작하는 2D puppet 실험 런타임이다. `release/v0.2.1-raster`는 Canvas 안정 기준선이며, `release/v0.3.0-alpha.3`는 이전 articulated 기준선이다.

## v0.4.0-alpha.1

이번 버전은 최종 감정 포즈의 그림 품질과 전환 중 실제 관절 동작을 분리해 처리한다.

- **10개 생성 reference endpoint**: neutral, happy, excited, angry, embarrassed, sad, surprised, scared, teasing, love는 별도 생성 원화를 최종 포즈로 사용한다.
- **실제 중간동작 유지**: 감정 전환 중앙 구간은 기존 WebGL articulated arm/body renderer가 담당한다. reference와 articulated pass는 정규화된 opacity hand-off로 섞여 이중 실루엣을 줄인다.
- **감정별 립싱크 좌표**: 생성 reference 10종은 각각 독립 mouth anchor를 사용하며 A/I/U/E/O/CLOSED 위치와 크기를 감정별 얼굴에 맞춘다.
- **원화 입 보존**: 립싱크가 비활성일 때 생성 원화의 입을 그대로 보여준다. 립싱크가 활성화될 때만 feathered skin cover로 원화 입을 가리고 viseme을 그린다.
- **나머지 6개 감정 fallback**: pleading, relaxed, sick, annoyed, smug, confused는 검증된 v0.3 articulated face/arm 경로를 유지한다. 저품질 생성 복제본으로 대체하지 않는다.
- **기존 QA 유지**: 팔 world-angle 연속성, source hand-off, 감정별 eye/brow/mouth bounds, texture Y 방향, NaN/Infinity 검사에 hybrid reference 회귀를 추가했다.

## 검수

```powershell
npm run check
npm test
```

`tools/test_hybrid_reference.mjs`는 16개 감정 × 6 viseme의 mouth anchor와 생성 reference 전환 opacity를 검사한다.

실행:

```powershell
node .\tools\serve.mjs
```

브라우저에서 `http://127.0.0.1:4173/`을 연다. GitHub Pages에서는 `엄격 전환/립싱크 QA`, `Show mesh`, `Show parameters`로 전환 상태를 확인할 수 있다.

## 알려진 한계

생성 reference endpoint는 고품질 최종 포즈를 제공하지만 독립 PSD/ArtMesh 원본은 아니다. 중앙 articulated 구간은 기존 flattened source에서 추출한 arm layer를 사용하므로 Cubism 수준의 완전한 occlusion 복원/머리카락 독립 변형에는 한계가 있다. 이 alpha는 최종 포즈 fidelity와 실제 in-between motion을 우선한 하이브리드 단계다.
