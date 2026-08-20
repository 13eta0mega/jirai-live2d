# Cubism Editor 수작업 체크포인트

이 저장소에는 실제 Cubism 편집기 파일을 가장한 `.cmo3`, `.moc3`, `.model3.json`을 만들지 않았다. 아래 순서로 작업하면 [`config`](../config)와 [`assets/parts`](../assets/parts)의 기준을 실제 모델로 옮길 수 있다.

1. 원본을 직접 수정하지 말고, underpaint가 포함된 PSD/레이어 세트를 별도로 만든다.
2. `ROOT → Body/Head/Hair/Arms/Legs/Effects` 구조로 레이어를 배치한다.
3. 얼굴·눈·눈썹·입 ArtMesh를 만들고 자동 mesh의 경계를 수동으로 정리한다.
4. `ParamAngleX/Y/Z`, `ParamBodyAngleX/Y/Z`를 좁은 범위로 키폼한다.
5. `ParamEyeLOpen/ROpen`, smile/wink/uruuru 파츠의 opacity를 설정한다.
6. `ParamMouthOpenY`를 CLOSED→A/I/U/E/O까지 키폼하고, `ParamMouthForm`과 분리한다.
7. 눈썹·볼·시선 파라미터를 16개 expression에 연결한다.
8. 양팔/양다리와 `jump`, `peace`, `uruuru`, `gorogoro`, `haku` 포즈를 motion으로 배치한다.
9. 양갈래 머리와 의상에 physics를 넣되 끝 지연을 작게 제한한다.
10. `emotion_presets.json`의 priority/blink/breath/lip-sync 정책을 expression·motion 재생 순서에 반영한다.
11. Auto Eye Blink와 Breath를 켜고 웃는 눈·특수 눈에서 깨짐이 없는지 확인한다.
12. Model3/physics3/pose3/exp3/motion3/texture를 내보낸 뒤 `docs/qa_checklist.md`를 수행한다.

완료된 Cubism 파일은 사용자가 직접 추가할 수 있도록 `assets/live2d/`를 비워 두었다.

