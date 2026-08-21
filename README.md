# Jirai 2D Avatar — Hybrid Articulated WebGL Rig v0.4.0-alpha.1

Cubism 없이 WebGL에서 동작하는 2D puppet 실험 런타임이다. `release/v0.2.1-raster`는 Canvas 안정 기준선이고 `release/v0.3.0-alpha.3`는 이전 articulated 기준선이다.

## v0.4.0-alpha.1

이번 alpha는 최종 감정 포즈의 그림 품질과 전환 중 실제 관절 동작을 분리한다.

- **9개 검증 generated endpoint**: neutral, happy, excited, angry, embarrassed, surprised, scared, teasing, love는 생성 원화를 최종 포즈 endpoint로 사용한다.
- **7개 articulated fallback**: pleading, relaxed, sick, annoyed, sad, smug, confused는 검증된 v0.3 articulated face/arm 경로를 유지한다. 전송 검증에 실패한 sad 생성 자산은 정식 tree에서 제외했다.
- **실제 중간동작**: 감정 전환 중앙 구간은 WebGL articulated arm/body renderer가 담당한다. endpoint 사이를 단순 dissolve하지 않는다.
- **감정별 립싱크**: 16개 감정 모두 A/I/U/E/O/CLOSED mouth anchor를 감정/소스에 맞게 계산한다. generated endpoint에서는 립싱크가 활성화될 때만 원래 입을 feathered cover로 가리고 viseme을 렌더링한다.
- **안전한 Pages asset pack**: generated endpoint 이미지는 작은 AVIF를 base64 UTF-8 파일로 저장하고 브라우저에서 data URL로 복원한다. GitHub Pages에서 LFS 없이 정적 호스팅된다.
- **QA gate**: publish workflow는 `npm run check`와 `npm test`가 모두 성공해야만 해당 commit을 `gh-pages`로 미러링한다.

## 실행 및 검수

```powershell
npm run check
npm test
node .\tools\serve.mjs
```

브라우저에서 `http://127.0.0.1:4173/`을 열거나 GitHub Pages에서 `엄격 전환/립싱크 QA`, `Show mesh`, `Show parameters`를 사용한다.

## 구조적 한계

generated endpoint는 고품질 최종 포즈를 제공하지만 독립 PSD/ArtMesh 원본은 아니다. 중앙 articulated 구간은 기존 flattened source에서 분리한 arm layer를 사용하므로 Cubism 수준의 완전한 occlusion 복원과 모든 머리카락/의상 레이어의 독립 변형은 아직 제한된다.
