# Jirai 리깅 명세

## 업데이트 순서와 소유권

```text
Base Pose → Body Motion → Expression → Eye Blink → Lip Sync → Breath/Secondary → Render
```

감정 expression은 `ParamMouthOpenY`를 소유하지 않는다. 최종 입 개방은 `ParamMouthOpenY`가 립싱크 입력을 받도록 한다. 눈 expression은 기본 개방도·웃는 눈·윙크를 설정하지만, blink 레이어가 마지막에 `ParamEyeLOpen/ParamEyeROpen`을 곱한다.

표준/사용자 파라미터의 범위와 기본값은 [`config/rig_parameters.json`](../config/rig_parameters.json)에 고정했다.

## 얼굴

- Angle X/Y/Z 범위는 각각 -15..15, -10..10, -10..10으로 좁게 시작한다.
- 눈은 원본 haku/stand/peace/uruuru에서 보수적으로 추출한 참고 파츠를 120–180ms cross-fade한다.
- 눈썹, 볼, 시선은 expression 값으로 보간한다.
- mouth viseme은 `MouthOpenY + MouthForm` 조합을 사용하며, 현재 런타임은 원본 crop을 클리핑해 검증한다.

## 몸·포즈

`stand`를 중립 기준으로 삼고, `jump/peace/uruuru/gorogoro/haku`는 큰 포즈용 source attachment다. 전환 시 250–900ms 동안 위치·회전·스케일·opacity를 함께 보간한다. 손만 먼저 튀거나 팔이 몸통에서 분리되지 않도록 target pose를 전체 sprite에 적용한다.

## 호흡·보조 움직임

`ParamBreath`는 3.2–4.5초의 느린 sine envelope을 사용한다. 몸통 Y, body angle Y, 양갈래 머리에 작은 지연을 주고, 스티커형 원본 비율을 해치지 않도록 폭을 제한한다. `relaxed`는 breathScale 0.35, `sick`은 0.5로 낮춘다.

## 감정

16개 ID와 source/motion/effect/blink/breath/lip-sync 정책은 [`config/emotion_presets.json`](../config/emotion_presets.json)에 있다. `excited`, `surprised`, `sick` 같은 one-shot은 종료 구간을 거친 뒤 다음 감정으로 넘어간다. `relaxed`는 누운 pose transition을 별도로 사용한다.

## Cubism 이식 시 권장 Deformer

```text
ROOT
├─ Body_Deformer
│  ├─ Torso
│  ├─ Dress_Skirt
│  └─ Arm/Leg groups
├─ Head_Deformer
│  ├─ Face
│  ├─ Eye/Brow/Mouth groups
│  └─ Hair_Front
└─ Hair_Physics
   ├─ TwinTail_L
   └─ TwinTail_R
```

자동 mesh 생성 뒤 눈선, 입 테두리, 스타킹 격자, 하트, 손가락, 레이스가 찌그러지지 않는지 수동 확인한다.

