# Jirai 2D Avatar v0.2.0 (원본 래스터 보존 런타임)

`jirai_*.png` 원본과 보수적으로 추출한 파츠를 사용하는 Web Canvas 기반 래스터 리그 런타임이다. 실제 Live2D Cubism `.moc3/.model3.json` 모델을 가장하지 않으며, 현재 자산 범위에서 실시간 캐릭터 반응성을 최대한 높이는 방향으로 구성한다.

## v0.2.0 주요 개선

- **실시간 마이크 립싱크**: Web Audio API로 RMS와 저/중/고역 에너지를 분석하고 A/I/U/E/O 계열 viseme을 선택한다.
- **립싱크 안정화**: adaptive noise floor, noise gate, attack/release smoothing, viseme hold를 적용해 입 떨림과 무음 오동작을 줄였다.
- **외부 TTS 연동 API**: `setAudioFeatures({ rms, low, mid, high })` 또는 `setViseme()`으로 외부 음성 파이프라인에서 직접 구동할 수 있다.
- **감정 전환 보강**: 전환 중 source image뿐 아니라 expression parameter도 함께 보간하고, 전환 중 새 감정 요청 시 미해결 Promise가 남지 않도록 수정했다.
- **감정별 body motion**: happy bob, jump, pleading idle, angry tense, scared shiver, startle, shy shift 등 preset의 `bodyMotion`을 실제 렌더링에 반영한다.
- **표정 렌더링 보강**: 눈 감김/특수 눈 파츠, mouth viseme cross-fade, 감정 mouth form을 적용한다.
- **시선/머리 반응**: 캔버스 포인터 위치를 저역통과 필터로 따라가며 `ParamAngleX/Y`, eye ball 파라미터와 전체 포즈에 반영한다.
- **감정 effect 활성화**: preset의 `sparkle`, `tears`, `rainbow`를 렌더링한다.

## 실행

```powershell
node .\tools\serve.mjs
```

브라우저에서 `http://127.0.0.1:4173/`을 연다. 마이크 립싱크는 브라우저의 마이크 권한 허용이 필요하다. `file://` 직접 열기는 JSON fetch 및 미디어 권한 제약 때문에 권장하지 않는다.

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
- `setAudioFeatures({ rms, low, mid, high })` — TTS/오디오 analyser 연동용
- `setBlinkEnabled()` / `setBreathEnabled()`

## 구성

- `assets/source/`: 수정하지 않은 원본 PNG
- `assets/aligned/`: 분석·정렬 비교 시트
- `assets/parts/`: 원본에서 보수적으로 잘라낸 참고 파츠
- `config/`: 레이어, 파라미터, 16개 감정 preset
- `src/avatar/`: controller, lip-sync analyser, debug viewer
- `docs/`: Cubism 수작업 checkpoint와 QA

## 한계

현재 자산은 완전한 ArtMesh/Deformer가 아닌 단일 PNG + 제한된 crop 파츠이므로, 머리카락/팔/몸통이 독립적으로 변형되는 **진짜 Cubism Live2D** 수준의 물리/워프는 구현할 수 없다. 그 단계가 필요하면 `config/layer_manifest.json`의 `manualArtMeshRequired` 항목을 기준으로 Cubism Editor에서 mesh/underpaint/deformer/physics를 제작한 뒤 이 런타임 대신 Cubism Web SDK로 전환해야 한다.
