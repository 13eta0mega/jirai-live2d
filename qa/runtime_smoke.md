# Runtime smoke test (2026-08-20)

로컬 `http://127.0.0.1:4173/`에서 확인한 결과:

- DOM에 16개 감정 버튼과 `MouthOpenY` slider가 렌더링됨
- `신남` 버튼 클릭 후 `strong` 상태가 `신남 (excited)`로 바뀌고 `jirai_jump.png` 포즈가 표시됨
- `애원` 버튼에서 `jirai_uruuru.png` 초롱초롱 눈·손 모으기 포즈가 표시됨
- `아픔` 버튼에서 `jirai_haku.png` 무지개 효과가 유지됨
- slider를 0.80으로 조작했을 때 UI `mouthValue`와 `ParamMouthOpenY`가 약 0.79로 반영됨
- Auto lip-sync test를 켠 뒤 180ms/260ms 간격 값이 `0.39 → 0.23`으로 변해 자동 파형이 동작함
- 브라우저 콘솔 error/warning 없음

현재 시각 QA는 래스터 prototype 기준이다. 최종 Cubism ArtMesh 왜곡 검수는 `docs/cubism_manual_steps.md`의 수작업 단계가 남아 있다.

