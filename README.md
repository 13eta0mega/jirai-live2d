# Jirai 2D Avatar (원본 래스터 보존 런타임)

제공된 `jirai_*.png`를 그대로 기준으로 감정 16종, 호흡, 랜덤 눈깜빡임, 수동 입 슬라이더, 테스트 립싱크 파형, 감정 전환 cross-fade를 검증하는 Web Canvas 런타임이다.

## 실행

`node tools/serve.mjs`는 **프로젝트 폴더 안에서** 실행해야 한다. PowerShell의 현재 위치가 `C:\Users\13eta`라면 먼저 아래처럼 이동한다.

```powershell
Set-Location -LiteralPath "C:\Users\13eta\Documents\Codex\2026-08-20\live-2d-16-tts-tts-svg-2"
node .\tools\serve.mjs
```

또는 압축을 푼 폴더의 `start-jirai.cmd`를 더블클릭해도 된다. 그 다음 브라우저에서 `http://127.0.0.1:4173/`을 연다. `file://` 직접 열기는 브라우저의 JSON fetch 제한 때문에 fallback preset만 사용할 수 있다.

검증 명령:

```powershell
node --check src/avatar/controller.js
node tools/test_config.mjs
```

## 구성

- `assets/source/`: 수정하지 않은 원본 PNG
- `assets/aligned/`: 분석·정렬 비교 시트
- `assets/parts/`: 원본에서 보수적으로 잘라낸 참고 파츠
- `config/`: 레이어, 파라미터, 16개 감정 preset
- `src/avatar/`: controller와 debug viewer
- `docs/`: Cubism 수작업 checkpoint와 QA

실제 Cubism Editor 파일은 사람이 mesh/underpaint/physics를 확인해야 하므로, 가짜 `.cmo3/.moc3/.model3.json`은 만들지 않았다.

