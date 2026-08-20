# QA 체크리스트

## 자동 검사

- [ ] 원본 6개가 `assets/source/`에 있고 SHA-256이 `qa/source_analysis.json`과 일치한다.
- [ ] 모든 PNG가 RGBA이며 alpha bbox가 비어 있지 않다.
- [ ] SVG·`.cmo3`·`.moc3`·`.model3.json`을 가짜로 생성하지 않았다.
- [ ] 16개 emotion ID가 `config/emotion_presets.json`과 UI에 모두 존재한다.
- [ ] `npm run check`와 `npm run test`가 통과한다.

## 수동 브라우저 검사

- [ ] neutral에서 3–7초 사이 랜덤 blink가 발생한다.
- [ ] breath가 3.2–4.5초 주기로 작게 반복된다.
- [ ] mouth slider 0/0.25/0.5/0.75/1에서 입이 열린다.
- [ ] Auto lip-sync test가 실제 TTS 없이 입 개방을 움직인다.
- [ ] 감정 전환 시 두 포즈의 opacity와 위치/회전이 1프레임 hard swap 없이 보간된다.
- [ ] relaxed/sick 전환이 별도 transition을 사용한다.
- [ ] 감정 중에도 blink/breath/lip-sync ownership이 충돌하지 않는다.
- [ ] 모든 감정에서 캐릭터의 분홍 포인트, 토끼핀, 하트, 스타킹 격자무늬가 유지된다.

## Cubism 수동 승인

- [ ] 눈·입·스타킹·레이스·하트 mesh에 찢김/늘어짐이 없다.
- [ ] underpaint가 드러날 때 빈 틈이 없다.
- [ ] 실제 Cubism export를 완료한 경우에만 `assets/live2d/`에 파일을 추가한다.

