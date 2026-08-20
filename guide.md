# Live2D 캐릭터 제작 가이드 — Codex 작업 지시서

## 0. 문서 목적

이 문서는 아래 6개의 원본 PNG를 기반으로, **원본 캐릭터의 인상과 픽셀/래스터 스타일을 최대한 유지한 Live2D 캐릭터**를 제작하기 위한 작업 지시서다.

최종 목표는 다음과 같다.

- 감정 상태 16종
- 평상시 자연스러운 호흡
- 랜덤 눈깜빡임
- 감정 전환 시 얼굴/팔다리/몸이 순간적으로 튀지 않고 자연스럽게 이동
- 현재 TTS는 구현하지 않음
- 대신 향후 TTS 또는 음성 분석 값을 연결할 수 있도록 **립싱크용 입 파라미터와 입모양**을 구현
- 디버그 UI에서 수동 슬라이더 또는 테스트 파형으로 립싱크를 검증
- 임의의 SVG 벡터화 금지
- 원본과 다른 화풍으로 재해석 금지
- 원본 이미지 자체는 수정하지 않고 읽기 전용으로 보존

---

# 1. 원본 자료

작업 시작 시 다음 파일을 `assets/source/`에 복사하고 원본은 절대 덮어쓰지 않는다.

| 파일 | 원본 크기 | 주요 참고 용도 |
|---|---:|---|
| `jirai_stand.png` | 259×270 | 기본 정면 자세, 기본 얼굴, 의상, 다리 |
| `jirai_jump.png` | 300×273 | 크게 웃는 눈/입, 벌린 팔, 점프/기쁨 |
| `jirai_peace.png` | 259×270 | 윙크, 장난스러운 얼굴, 전방 손/팔 |
| `jirai_uruuru.png` | 270×246 | 초롱초롱한 눈, 울먹임/부탁 표정 |
| `jirai_gorogoro.png` | 270×246 | 누운 자세, 편안한 감은 눈, 측면 몸 |
| `jirai_haku.png` | 250×246 | 크게 벌린 입, 특수 이펙트, 당황/아픔 계열 |

소스 이미지들은 투명 배경 RGBA PNG다.

---

# 2. 절대 지켜야 할 제약

## 2.1 금지 사항

다음은 하지 않는다.

1. PNG를 SVG로 자동 트레이싱하지 않는다.
2. 벡터 일러스트로 다시 그리지 않는다.
3. 캐릭터를 AI 이미지 생성으로 새로 만들지 않는다.
4. 눈, 헤어핀, 머리카락, 의상, 스타킹 패턴, 가슴 하트 등 핵심 특징을 임의로 단순화하지 않는다.
5. 기존 원본의 색을 임의로 바꾸지 않는다.
6. 원본에 없는 장식물을 멋대로 추가하지 않는다.
7. 감정 전환을 단순 PNG 통째 교체만으로 끝내지 않는다.
8. 입을 감정 표현에 고정해서 립싱크가 닫히지 않는 구조로 만들지 않는다.
9. Cubism 편집 파일을 실제로 만들지 못했는데 만들어진 것처럼 가짜 `.cmo3`, `.moc3`, `.model3.json`을 생성하지 않는다.
10. 품질 문제를 숨기지 않는다. 수작업이 필요한 부분은 별도 체크리스트로 명확히 남긴다.

## 2.2 허용 사항

다음은 허용한다.

- 원본 PNG에서 직접 파츠를 잘라내고 정리
- 원본 여러 장을 비교하여 같은 파츠의 가려진 부분을 복원
- 작은 투명 틈을 막기 위한 최소한의 래스터 보정
- 동일한 원본 색과 선 굵기를 유지하는 수작업 페인팅
- 원본 파츠를 Live2D ArtMesh용으로 변형
- 여러 원본에서 얻은 눈/입 모양을 별도 파츠로 보존하여 크로스페이드
- 필요 시 비파괴적 2배 확대본을 작업용으로 만들 수 있으나 원본과 비교 검수할 것

모든 수작업 보정은 `docs/asset_edit_log.md`에 기록한다.

---

# 3. 핵심 판단: Live2D를 어떻게 구성할 것인가

이 캐릭터는 일반적인 1장의 정면 일러스트가 아니라 **서로 다른 포즈의 스티커형 PNG 6장**으로 구성되어 있다.

따라서 모든 상태를 하나의 정면 Live2D 메시에 억지로 밀어 넣는 것보다 아래 구조를 사용한다.

## 권장 구조

**하나의 공통 캐릭터 리그 + 얼굴 표현 + 여러 포즈 모션/보조 파츠**

즉:

- 얼굴 표정: Live2D Parameter 중심
- 눈/입의 극단적인 형태: 원본에서 추출한 대체 파츠를 opacity cross-fade
- 팔/다리/몸의 큰 포즈 변화: Motion으로 처리
- 완전히 다른 자세가 필요한 경우: 동일 모델 안의 추가 ArtMesh/Parts를 사용하되, 전환 시 바로 껐다 켜지 말고 움직임과 opacity를 동시에 보간
- 감정은 `Expression + Motion + Effect`의 프리셋으로 관리

Live2D의 Expression은 얼굴 등 파라미터 조합에 적합하고, 큰 팔다리 포즈 변화는 Motion으로 분리하는 것을 기본 원칙으로 한다.

---

# 4. 작업 단계

## Phase A — 소스 분석 및 정렬

Codex가 먼저 해야 할 일:

1. 6개 PNG를 모두 읽는다.
2. 각 이미지의 alpha bounding box를 계산한다.
3. 얼굴 중심, 눈 중심, 가슴 하트 중심, 골반 중심을 기준 landmark로 기록한다.
4. `jirai_stand.png`를 기본 좌표계로 삼는다.
5. 다른 5개 이미지를 기본 좌표계에 대략 정렬한 비교 이미지를 생성한다.
6. 절대 원본을 덮어쓰지 않는다.

생성물:

```text
assets/
  source/
  aligned/
docs/
  source_analysis.md
```

`source_analysis.md`에는 다음을 기록한다.

- 각 이미지 크기
- 캐릭터 bounding box
- 얼굴 중심
- 공통 파츠
- 이미지마다 다른 파츠
- 가려져 있어서 복원이 필요한 영역
- 그대로 재사용 가능한 영역
- Live2D 변형으로 해결 가능한 영역
- 별도 파츠 스왑이 필요한 영역

---

# 5. 파츠 분해 규칙

최종 Live2D용 PSD 또는 레이어 세트는 최소한 아래 구조를 갖도록 한다.

```text
ROOT
├─ Hair_Back
│  ├─ Hair_Back_Main
│  ├─ TwinTail_L
│  ├─ TwinTail_R
│  ├─ HairClip_L
│  └─ HairClip_R
├─ Body
│  ├─ Neck
│  ├─ Torso
│  ├─ Dress_Front
│  ├─ Dress_Skirt
│  ├─ Collar
│  └─ Chest_Heart
├─ Head
│  ├─ Face
│  ├─ Ear_L
│  ├─ Ear_R
│  ├─ Brow_L
│  ├─ Brow_R
│  ├─ Eye_L_Normal
│  ├─ Eye_R_Normal
│  ├─ Eye_L_Smile
│  ├─ Eye_R_Smile
│  ├─ Eye_L_Uruuru
│  ├─ Eye_R_Uruuru
│  ├─ Eye_L_Wink
│  ├─ Eye_R_Wink
│  ├─ Nose
│  ├─ Mouth_Base
│  ├─ Mouth_A
│  ├─ Mouth_I
│  ├─ Mouth_U
│  ├─ Mouth_E
│  ├─ Mouth_O
│  ├─ Mouth_Smile
│  └─ Mouth_Sick
├─ Hair_Front
│  ├─ Bangs_Main
│  ├─ SideHair_L
│  └─ SideHair_R
├─ Arm_L
│  ├─ Upper
│  ├─ Lower
│  └─ Hand
├─ Arm_R
│  ├─ Upper
│  ├─ Lower
│  └─ Hand
├─ Leg_L
│  ├─ Thigh
│  ├─ Calf
│  ├─ Stocking
│  └─ Shoe
├─ Leg_R
│  ├─ Thigh
│  ├─ Calf
│  ├─ Stocking
│  └─ Shoe
└─ Effects
   ├─ Tears
   ├─ Sparkle
   └─ Rainbow
```

실제 그림에서 분리할 수 없는 파츠는 억지로 잘게 쪼개지 않는다.

특히 스타킹 격자무늬, 신발, 머리핀 등은 원본 디테일을 보존한다.

---

# 6. 가려진 부분 복원 규칙

Live2D 변형 시 기존 그림 뒤에 가려져 있던 픽셀이 드러난다.

따라서 다음 영역은 반드시 overscan/underpaint가 있어야 한다.

- 앞머리 뒤 이마
- 얼굴 옆 머리카락 뒤
- 팔이 몸통에서 떨어질 때 드러나는 어깨
- 소매 안쪽
- 치마 아래 허벅지
- 다리 교차부
- 양갈래 머리의 뿌리
- 눈꺼풀 움직임으로 드러나는 눈 주변 피부
- 입을 크게 벌렸을 때 드러나는 내부 영역

복원 순서:

1. 다른 원본 프레임에서 동일 영역을 찾는다.
2. 있으면 해당 픽셀을 우선 재사용한다.
3. 없으면 주변 색/선/질감을 그대로 따라 수작업 래스터 보정한다.
4. 새 그림을 크게 창작하지 않는다.
5. 수정한 위치를 `asset_edit_log.md`에 기록한다.

---

# 7. Live2D 표준 파라미터

가능하면 Live2D 표준 ID를 사용한다.

필수:

```text
ParamAngleX
ParamAngleY
ParamAngleZ

ParamBodyAngleX
ParamBodyAngleY
ParamBodyAngleZ

ParamEyeLOpen
ParamEyeROpen
ParamEyeLSmile
ParamEyeRSmile
ParamEyeBallX
ParamEyeBallY

ParamBrowLY
ParamBrowRY
ParamBrowLAngle
ParamBrowRAngle
ParamBrowLForm
ParamBrowRForm

ParamMouthOpenY
ParamMouthForm
ParamCheek
ParamBreath
```

팔다리용 사용자 파라미터 예:

```text
ParamArmLA
ParamArmLB
ParamArmRA
ParamArmRB
ParamHandL
ParamHandR

ParamLegLA
ParamLegLB
ParamLegRA
ParamLegRB

ParamTwinTailL
ParamTwinTailR

ParamPoseJump
ParamPoseLay
ParamPoseForwardHands
```

---

# 8. 눈 리그

눈은 최소 다음 상태를 지원한다.

- 기본 열림
- 완전히 감김
- 웃는 눈
- 윙크
- 초롱초롱한 눈
- 크게 뜬 눈

## 눈깜빡임

기본:

```text
ParamEyeLOpen = 0..1
ParamEyeROpen = 0..1
```

평상시에는 자동 눈깜빡임을 활성화한다.

권장 체감:

- 기본 간격: 약 3~7초 사이 랜덤
- 가끔 짧은 2연속 blink 허용
- 웃는 표정에서도 blink가 완전히 죽지 않도록 구성
- `uruuru`처럼 특수 눈 파츠를 사용하는 상태에서도 가능하면 blink 대응 버전을 만든다

표정이 눈의 기본 개방도를 바꾸더라도 눈깜빡임과 충돌하지 않게 설계한다.

`Eye Open` 값을 감정 표현에서 강제로 덮어써서 blink를 막는 방식은 피한다.

---

# 9. 입 및 립싱크

## 9.1 현재 구현 범위

현재는 TTS 연결을 하지 않는다.

대신 런타임에서 다음 인터페이스만 구현한다.

```ts
avatar.setMouthOpen(value: number); // 0.0 ~ 1.0
```

테스트 화면에서 slider로 조절할 수 있어야 한다.

추가로 테스트용 자동 파형:

```ts
avatar.setLipSyncTest(enabled: boolean);
```

활성화하면 sine/random-envelope 값으로 `ParamMouthOpenY`가 움직이게 하여 실제 음성 입력 없이도 립싱크 가능 여부를 검증한다.

## 9.2 향후 TTS 대응

향후 다음 구조로 확장 가능하게 한다.

```ts
type Viseme = "A" | "I" | "U" | "E" | "O" | "CLOSED";

avatar.setViseme(viseme: Viseme, weight?: number);
```

최소 구현은 `ParamMouthOpenY` 하나로 가능하지만,
높은 품질을 위해서는 `ParamMouthOpenY + ParamMouthForm` 조합 또는 별도 모음 입모양을 준비한다.

## 9.3 입 모양

원본에서 최대한 직접 추출한다.

- CLOSED
- SMALL
- A
- I
- U
- E
- O
- SMILE
- SICK/WIDE

중요:

**감정 Expression 자체에서 `ParamMouthOpenY`를 열린 값으로 고정하지 않는다.**

감정이 웃음/슬픔/화남을 표현해야 할 때는 `ParamMouthForm` 또는 입 shape opacity를 사용하고,
`ParamMouthOpenY`는 립싱크가 마지막에 제어할 수 있도록 남겨둔다.

---

# 10. 호흡 Idle

평상시에는 계속 살아 있는 느낌이 나야 한다.

`ParamBreath`를 중심으로 아주 작은 주기 운동을 만든다.

예:

```text
ParamBreath        0.0 -> 1.0 -> 0.0
ParamBodyAngleY    -0.3 -> +0.5 -> -0.3
Chest/Y            아주 미세하게 상하
Shoulder/Y         아주 미세하게 상하
TwinTail           약간 지연되어 흔들림
```

권장 주기:

- 약 3.2~4.5초
- 정확한 반복감이 너무 강하지 않게 약간 변주 가능

과장하지 않는다.

이 캐릭터는 SD/스티커형 비율이므로 움직임 폭이 크면 원본 캐릭터성이 무너진다.

---

# 11. 보조 Idle

기본 호흡 외에 매우 미세하게만 추가한다.

- 머리 좌우 ±1~2도
- 몸통 좌우 ±0.5~1도
- 양갈래 머리 지연 흔들림
- 치마 끝 미세 흔들림
- 시선 작은 이동
- 8~20초에 한 번 정도 미세한 posture variation

절대 화면에서 계속 출렁이는 VTuber형 과한 리그로 만들지 않는다.

원본 스티커 느낌을 유지한다.

---

# 12. 감정 16종

감정 ID는 코드에서 고정한다.

```ts
type EmotionId =
  | "neutral"
  | "happy"
  | "excited"
  | "teasing"
  | "pleading"
  | "relaxed"
  | "sick"
  | "angry"
  | "annoyed"
  | "sad"
  | "surprised"
  | "embarrassed"
  | "scared"
  | "smug"
  | "confused"
  | "love";
```

## 1. neutral

기준 이미지:

`jirai_stand.png`

특징:

- 기본 정면
- 기본 눈
- 작은 기본 입
- 약한 호흡
- 자연스러운 blink

---

## 2. happy

기준:

`jirai_stand.png` + `jirai_jump.png` 얼굴

특징:

- 웃는 눈 또는 살짝 휘어진 눈
- `ParamMouthForm` 양수
- 가벼운 볼 붉힘 가능
- 몸통 약간 위로

---

## 3. excited

기준:

`jirai_jump.png`

특징:

- 양팔 크게 벌림
- 눈 감고 크게 웃음
- 머리카락/양갈래가 위로 따라감
- 몸이 잠깐 위로 튀었다가 안정

큰 동작이므로 Expression이 아니라 Motion을 사용한다.

---

## 4. teasing

기준:

`jirai_peace.png`

특징:

- 한쪽 눈 윙크
- 장난스러운 입
- 손을 앞으로
- 머리 약간 기울임

---

## 5. pleading

기준:

`jirai_uruuru.png`

특징:

- 큰 초롱초롱 눈
- 손을 입 앞에 모음
- 눈물 또는 반짝임
- 몸을 약간 앞으로

---

## 6. relaxed

기준:

`jirai_gorogoro.png`

특징:

- 감은 눈
- 누워 있는 자세
- 움직임 최소화
- 호흡만 아주 작게
- blink는 이 상태에서는 불필요하거나 감은 눈 상태로 처리

---

## 7. sick

기준:

`jirai_haku.png`

특징:

- 크게 벌린 입
- rainbow/effect
- 약간 몸을 앞으로
- 특수 이펙트는 별도 Parts/Effect layer

이 상태에서 실제 음성 립싱크가 필요한 경우,
이펙트 중에는 mouth를 잠그고 종료 후 립싱크 제어권을 반환한다.

---

## 8. angry

기준:

`jirai_stand.png`

새로운 그림을 만들지 말고 기존 파츠의 deformation으로 표현한다.

- 양쪽 눈 약간 좁힘
- 눈썹 안쪽 하강
- `ParamBrowL/R Angle` 분노 방향
- `ParamMouthForm` 음수
- 몸을 1~2도 앞으로
- 작은 좌우 떨림은 선택 사항

---

## 9. annoyed

기준:

`jirai_stand.png`

- 한쪽 눈 약간 좁힘
- 입 삐죽
- 한쪽 눈썹만 약간 위
- 시선 옆으로
- 고개 ±3도

angry보다 약해야 한다.

---

## 10. sad

기준:

`jirai_uruuru.png`와 기본 얼굴 혼합

- 눈 위쪽 약간 처짐
- 눈썹 중앙 상승
- 입 모양 음수
- 몸통 약간 아래
- 필요 시 눈물 opacity를 천천히 올림

---

## 11. surprised

기준:

`jirai_stand.png`

- 눈 크게
- 눈썹 위
- 입 O
- 몸을 뒤로 1~2도
- 150~250ms 정도의 빠른 반응 후 안정

---

## 12. embarrassed

기준:

`jirai_stand.png`

- 볼 붉힘
- 시선 옆
- 작은 미소
- 고개 살짝 숙임
- 손/팔은 기본 포즈 유지

---

## 13. scared

기준:

`jirai_stand.png` + `uruuru` 눈 일부 활용 가능

- 눈 크게
- 눈동자 작게 또는 중앙
- 입 작게 열림
- 몸 뒤로
- 아주 작은 떨림
- 머리카락 떨림은 몸보다 약간 지연

---

## 14. smug

기준:

`jirai_peace.png`

- 윙크 또는 반쯤 감긴 눈
- 작은 미소
- 턱/머리 약간 위
- 몸 약간 옆으로

---

## 15. confused

기준:

`jirai_stand.png`

- 한쪽 눈썹 위
- 다른 눈썹 기본
- 고개 ±5도 기울임
- 입 아주 작게 열림
- 시선 약간 위/옆

---

## 16. love

기준:

`jirai_jump.png` 또는 `jirai_stand.png`

- 웃는 눈
- 볼 붉힘
- 가슴 하트 강조
- 몸 약간 위
- 원본에 없는 하트눈 등 새 디자인은 만들지 않는다
- 필요하면 기존 하트/반짝임만 재활용한다

---

# 13. 감정 전환 방식

가장 중요한 품질 기준이다.

다음 방식은 금지:

```text
emotion A
-> 한 프레임 뒤
emotion B PNG 전체 교체
```

대신 다음 순서를 사용한다.

## 작은 얼굴 감정

```text
현재 expression
-> 250~500ms parameter blend
-> 대상 expression
```

## 팔다리까지 바뀌는 감정

```text
1. 얼굴 표정 먼저 100~200ms 반응
2. 몸/팔/다리 motion 시작
3. 400~900ms 동안 pose blend
4. hair/cloth secondary motion이 약간 늦게 따라감
5. 필요 시 특수 파츠 opacity cross-fade
6. 최종 감정 상태 안정
```

## 원본 파츠 자체가 다른 경우

예: `normal eye` ↔ `uruuru eye`

- 즉시 swap 금지
- 공통 deformation으로 먼저 형태를 가까이 가져감
- 약 120~250ms opacity cross-fade
- 가능하면 blink 순간에 교체를 숨김

예: 팔 파츠가 완전히 다른 경우

- shoulder/upper arm을 먼저 목표 위치로 이동
- 전환 중간에 두 파츠를 짧게 overlap
- opacity를 교차
- 손만 순간 이동하지 않도록 한다

---

# 14. Emotion은 Expression 하나로 만들지 않는다

런타임에서 감정 하나를 다음 구조로 표현한다.

```ts
interface EmotionPreset {
  id: EmotionId;
  expression?: string;
  bodyMotion?: string;
  transitionMotion?: string;
  effects?: string[];
  loop?: boolean;
  priority: number;
  blinkMode?: "auto" | "disabled" | "special";
  breathScale?: number;
  lipSyncEnabled?: boolean;
}
```

예:

```json
{
  "id": "pleading",
  "expression": "pleading",
  "bodyMotion": "pleading_idle",
  "effects": ["tears"],
  "loop": true,
  "priority": 30,
  "blinkMode": "special",
  "breathScale": 0.7,
  "lipSyncEnabled": true
}
```

---

# 15. Expression과 립싱크 충돌 방지

런타임은 parameter ownership을 명확히 분리한다.

권장 개념:

```text
Base Pose
  ↓
Body Motion
  ↓
Expression
  ↓
Eye Blink
  ↓
Lip Sync
  ↓
Breath / Secondary motion
  ↓
Render
```

정확한 적용 순서는 사용하는 Cubism SDK의 권장 update 흐름에 맞추되,
아래 규칙은 반드시 지킨다.

- 감정이 `ParamMouthOpenY`를 독점하지 않는다.
- 립싱크 on 상태에서는 최종 mouth open 값을 립싱크가 제어한다.
- 감정은 `ParamMouthForm`, 눈, 눈썹, 볼, 머리/몸 포즈를 중심으로 표현한다.
- 웃는 눈/좁은 눈 상태에서도 자동 blink가 가능하게 구성한다.

---

# 16. Runtime API

기존 프로젝트에 아바타 런타임이 없다면,
기본 검증용으로 **Web + TypeScript** 데모를 만든다.

기존 프로젝트가 Unity/Native/Cocos 등이라면 기존 플랫폼을 우선한다.

최소 API:

```ts
interface AvatarController {
  setEmotion(id: EmotionId, options?: {
    immediate?: boolean;
    intensity?: number;
  }): Promise<void>;

  setMouthOpen(value: number): void;

  setViseme?(
    viseme: "A" | "I" | "U" | "E" | "O" | "CLOSED",
    weight?: number
  ): void;

  setLipSyncTest(enabled: boolean): void;

  setBlinkEnabled(enabled: boolean): void;

  setBreathEnabled(enabled: boolean): void;

  reset(): Promise<void>;
}
```

---

# 17. Debug 화면

반드시 검증 화면을 만든다.

UI:

```text
[Emotion]
neutral happy excited teasing
pleading relaxed sick angry
annoyed sad surprised embarrassed
scared smug confused love

[Mouth]
0.0 ---------------- 1.0

[ ] Auto lip-sync test
[ ] Auto blink
[ ] Breath
[ ] Show parameters
[ ] Show FPS
[ ] Show ArtMesh bounds
```

추가:

- 감정 A → B 반복 전환 테스트
- 16개 감정 전부 순환 테스트
- mouth slider를 움직이면서 모든 감정에서 입이 정상 작동하는지 확인
- blink가 모든 눈 상태에서 깨지지 않는지 확인

---

# 18. 디렉터리 구조

권장:

```text
project/
├─ guide.md
├─ assets/
│  ├─ source/
│  │  ├─ jirai_stand.png
│  │  ├─ jirai_jump.png
│  │  ├─ jirai_peace.png
│  │  ├─ jirai_uruuru.png
│  │  ├─ jirai_gorogoro.png
│  │  └─ jirai_haku.png
│  ├─ aligned/
│  ├─ parts/
│  │  ├─ face/
│  │  ├─ eyes/
│  │  ├─ mouth/
│  │  ├─ hair/
│  │  ├─ body/
│  │  ├─ arms/
│  │  ├─ legs/
│  │  └─ effects/
│  └─ live2d/
├─ config/
│  ├─ emotion_presets.json
│  ├─ layer_manifest.json
│  └─ rig_parameters.json
├─ src/
│  └─ avatar/
├─ tools/
│  ├─ analyze_sources.*
│  ├─ align_sources.*
│  └─ validate_assets.*
└─ docs/
   ├─ source_analysis.md
   ├─ rigging_spec.md
   ├─ asset_edit_log.md
   ├─ cubism_manual_steps.md
   ├─ qa_checklist.md
   └─ alternative_plan.md
```

---

# 19. Codex가 자동화해야 하는 부분

Codex는 가능한 범위에서 다음을 자동화한다.

1. 소스 파일 검증
2. PNG 크기/alpha 분석
3. alignment 비교 이미지 생성
4. 파츠 manifest 생성
5. 작업용 crop/export
6. 누락 파츠 검사
7. 파일명 규칙 검사
8. 감정 preset JSON 생성
9. 런타임 controller 구현
10. blink/breath/lipsync test 구현
11. 감정 전환 state machine 구현
12. 디버그 UI 구현
13. 자동 테스트
14. 빌드/실행 문서 작성

Codex가 임의로 처리하면 안 되는 부분:

- 캐릭터 화풍 재디자인
- 누락 신체를 크게 창작
- 얼굴 비율 재설계
- Live2D Editor GUI에서 사람이 직접 판단해야 하는 mesh/deformer 품질을 완료한 것처럼 간주

---

# 20. Cubism Editor 수작업 체크포인트

Live2D Editor 파일이 필요하면 `docs/cubism_manual_steps.md`를 만들어 아래를 사람에게 정확히 안내한다.

## 필수 수작업

- 최종 레이어 PSD import
- ArtMesh 생성 및 수동 수정
- Deformer 구조 구성
- 얼굴 X/Y/Z
- 눈 개폐
- 눈웃음
- 눈썹
- 입 개폐/변형
- 몸통
- 팔/다리
- 양갈래 머리 physics
- 의상 physics
- 각 emotion expression
- 각 body motion
- Model3 export
- Moc3/texture export

## 품질 체크

자동 mesh 생성 결과가 다음을 만들면 수동 수정한다.

- 눈 라인이 꺾임
- 입 테두리 찌그러짐
- 스타킹 격자가 늘어짐
- 머리핀 형태가 일그러짐
- 하트가 비대칭으로 찌그러짐
- 손가락이 녹아 붙는 느낌
- 치마 레이스가 심하게 늘어남

---

# 21. 모델링 세부 기준

## 얼굴

이 캐릭터는 얼굴 면적이 작고 머리가 크다.

따라서:

- 얼굴 회전은 과장하지 않는다.
- Angle X/Y는 일반 Live2D 모델보다 좁게 잡아도 된다.
- 극단적인 3/4 얼굴을 만들 필요 없다.
- 원본 정면 SD 캐릭터 느낌 유지가 우선이다.

권장 초기 범위:

```text
ParamAngleX      -15 .. 15
ParamAngleY      -10 .. 10
ParamAngleZ      -10 .. 10

ParamBodyAngleX   -5 .. 5
ParamBodyAngleY   -3 .. 3
ParamBodyAngleZ   -5 .. 5
```

필요하면 모델링 단계에서 조정한다.

## 머리카락

양갈래는 독립 Deformer/Physics 대상으로 한다.

- 뿌리 이동은 작게
- 끝부분 지연은 조금 크게
- 점프 시 위로 튐
- 몸이 멈춘 후 1회 정도 감쇠

## 의상

레이스/스타킹 패턴은 질감이 왜곡되지 않게 ArtMesh vertex를 너무 적게 만들지 않는다.

반대로 과도한 vertex로 이미지가 물렁해 보이지 않게 한다.

---

# 22. 이미지 스왑을 최소화하는 방법

가능하면 다음 순서로 해결한다.

1. Parameter deformation
2. Deformer
3. Mesh warp
4. Opacity blend
5. 마지막 수단으로 Part swap

예:

### normal eye → smile eye

가능하면 눈꺼풀 deformation으로 구현.

불가능하면:
normal/smile 두 파츠를 150ms 정도 crossfade.

### stand arm → jump arm

단순 얼굴 expression이 아니라 body motion.

필요하면:
두 팔 세트를 공존시키고 shoulder motion + opacity crossfade.

### stand → lying

완전히 다른 자세이므로 하나의 연속 mesh deformation으로 억지 구현하지 않는다.

`relaxed`는 별도 pose group을 사용해도 된다.

전환 자체는 500~1000ms의 짧은 transition motion으로 자연스럽게 숨긴다.

---

# 23. 상태 머신

예:

```text
IDLE
 ├─ neutral
 ├─ happy
 ├─ annoyed
 ├─ embarrassed
 ├─ confused
 └─ love

ACTIVE
 ├─ excited
 ├─ teasing
 ├─ pleading
 ├─ angry
 ├─ sad
 ├─ surprised
 ├─ scared
 └─ smug

SPECIAL
 ├─ relaxed
 └─ sick
```

SPECIAL 상태로 들어가거나 나올 때는 전용 transition을 둔다.

예:

```text
neutral -> relaxed
relaxed -> neutral

neutral -> sick
sick -> neutral
```

특히 `relaxed`는 누운 자세이므로 일반 표정처럼 즉시 바꾸지 않는다.

---

# 24. 감정 우선순위

권장:

```text
idle          10
normal expr   20
emotion       30
one-shot      40
special       50
system reset 100
```

새 감정이 들어오면 현재 상태를 무조건 끊지 않는다.

예:

- excited 재생 중 neutral 요청:
  - 현재 jump의 착지 구간까지 진행
  - 그 후 neutral
- sick 중 happy 요청:
  - sick 종료 transition
  - happy 적용

단, `immediate: true`일 때는 짧은 안전 fade 후 강제 전환 가능.

---

# 25. 립싱크 QA

아래 테스트를 자동화한다.

## 테스트 1

각 emotion에서:

```text
MouthOpenY = 0
MouthOpenY = 0.25
MouthOpenY = 0.5
MouthOpenY = 0.75
MouthOpenY = 1.0
```

캡처 비교.

## 테스트 2

2Hz 이하 테스트 envelope로 10초 실행.

확인:

- 입이 완전히 닫히는가
- 얼굴 표정이 깨지지 않는가
- smile/angry/sad에서도 말할 수 있는가
- 턱/입 주변 픽셀이 찢어지지 않는가

## 테스트 3

모든 감정을 1초 간격으로 바꾸며 립싱크를 계속 실행.

립싱크가 감정 전환 때문에 멈추면 실패.

---

# 26. 눈깜빡임 QA

각 감정에서 최소 10회 blink 검증.

실패 예:

- smiling eye에서 검은 선이 두 겹으로 보임
- uruuru eye가 갑자기 normal eye로 튐
- wink 상태에서 양쪽 눈이 동시에 어색하게 열림
- 눈썹이 같이 찌그러짐
- blink할 때 얼굴 피부에 빈 틈이 생김

특수 눈은 필요하면 별도 blink mapping을 사용한다.

---

# 27. 감정 전환 QA

반드시 아래 조합을 직접 확인한다.

```text
neutral -> excited -> neutral
neutral -> teasing -> pleading
pleading -> angry
angry -> sad
sad -> happy
happy -> surprised
surprised -> scared
scared -> embarrassed
embarrassed -> smug
smug -> confused
confused -> love
love -> relaxed
relaxed -> neutral
neutral -> sick -> neutral
```

합격 기준:

- 눈/입이 1프레임 순간 이동하지 않음
- 손이 허공에서 순간 등장하지 않음
- 팔이 몸통에서 끊어져 보이지 않음
- 머리카락이 전환 직후 갑자기 정지하지 않음
- 표정 전환 중에도 립싱크가 가능
- neutral로 돌아왔을 때 모든 파라미터가 정상 기준값으로 복귀

---

# 28. 성능 목표

기본 목표:

- 60 FPS 가능한 구조
- 매 프레임 PNG 재할당 금지
- texture preload
- expression/motion 미리 로드
- 불필요한 GC 방지
- 모바일/저사양 고려 시 effect layer를 별도 토글 가능하게 구성

실제 texture 크기는 최종 원본 품질에 맞춰 결정한다.

작은 원본을 무리하게 초고해상도 모델로 만들지 않는다.

---

# 29. Live2D 방식이 지나치게 비효율적일 때의 대안

## 대안 1 — Spine 2D raster cutout rig

이 소스는 얼굴뿐 아니라 팔/다리/몸 전체 포즈 변화가 많다.

따라서 작업 시간이 너무 커지면 **Spine 2D + PNG raster assets + mesh/bone animation**을 대안으로 검토한다.

장점:

- PNG 원본 유지 가능
- SVG 변환 불필요
- bone/mesh 기반의 전신 포즈 전환에 강함
- attachment/skin 방식으로 눈/입/손 파츠 변경 가능
- animation mixing으로 감정 전환 가능
- lip-sync용 mouth attachment/mesh 제어 가능

단점:

- Live2D ecosystem과 다름
- Live2D 전용 포맷을 요구하는 서비스에는 바로 사용할 수 없음
- 별도 라이선스/툴체인을 검토해야 함

## 대안 2 — 커스텀 WebGL/Pixi cutout avatar

Live2D 모델 파일 자체가 필요하지 않고,
앱 내부 캐릭터 연출만 필요하다면 더 자동화하기 쉬운 방법이다.

구조:

- 원본 PNG 파츠
- bone hierarchy
- mesh warp
- sprite crossfade
- procedural blink
- procedural breath
- mouth viseme sprites
- emotion state machine

이 방식은 Codex가 코드로 거의 전체를 구현할 수 있다는 장점이 있다.

그러나 Live2D Editor 수준의 mesh authoring UI는 직접 만들어야 하므로,
최종 품질/편집 편의성은 Spine/Live2D보다 떨어질 수 있다.

---

# 30. 방식 선택 기준

다음 조건이면 Live2D 유지:

- 최종 결과물이 Live2D 포맷이어야 함
- Cubism Editor 수작업 가능
- 얼굴 미세 표현 품질이 가장 중요
- 향후 Live2D SDK/Viewer 사용 예정

다음 조건이면 Spine 검토:

- 전신 포즈 전환이 많음
- 원본 PNG를 그대로 살리고 싶음
- bone animation이 더 중요
- 여러 pose를 자연스럽게 섞는 것이 핵심

다음 조건이면 커스텀 2D runtime 검토:

- Live2D 파일 자체가 필요하지 않음
- 브라우저/앱 내부 전용
- Codex 자동화 비중을 최대로 높이고 싶음
- 편집기보다는 코드 제어가 중요

**기본 선택은 Live2D이며, 품질을 위해 Cubism 수작업 checkpoint를 허용한다.**

---

# 31. Codex 최종 산출물

최종적으로 아래를 남긴다.

```text
[필수]
guide.md
docs/source_analysis.md
docs/rigging_spec.md
docs/asset_edit_log.md
docs/cubism_manual_steps.md
docs/qa_checklist.md

config/layer_manifest.json
config/rig_parameters.json
config/emotion_presets.json

tools/source analyzer
tools/asset validator

runtime debug viewer
emotion controller
blink controller
breath controller
lip-sync test controller
```

Cubism Editor 작업까지 완료된 경우 추가:

```text
assets/live2d/*.moc3
assets/live2d/*.model3.json
assets/live2d/*.physics3.json
assets/live2d/*.pose3.json
assets/live2d/*.exp3.json
assets/live2d/*.motion3.json
assets/live2d/textures/*
```

---

# 32. 완료 판정

다음이 모두 만족되어야 완료다.

- [ ] 원본 6개 파일이 변경되지 않았다.
- [ ] SVG 자동 벡터화가 없다.
- [ ] 캐릭터의 머리색/핑크 포인트/양갈래/토끼핀/검정 의상/하트/스타킹 특징이 유지된다.
- [ ] 16개 emotion ID가 모두 동작한다.
- [ ] neutral 상태에서 계속 자연스럽게 호흡한다.
- [ ] neutral 및 일반 감정에서 랜덤 blink가 동작한다.
- [ ] mouth slider 0~1이 정상 동작한다.
- [ ] lip-sync test를 켜면 입이 자동으로 움직인다.
- [ ] 실제 TTS 의존성이 없다.
- [ ] 향후 TTS/viseme 입력을 연결할 API가 준비되어 있다.
- [ ] 감정 전환이 hard swap이 아니다.
- [ ] 팔/다리/눈/입의 전환이 시각적으로 부드럽다.
- [ ] relaxed 및 sick 같은 특수 상태에 별도 transition이 있다.
- [ ] 감정 중에도 립싱크와 호흡/눈깜빡임 ownership이 충돌하지 않는다.
- [ ] 원본에 없는 그림을 대규모로 새로 만들지 않았다.
- [ ] 수작업 보정 영역이 문서화되어 있다.
- [ ] debug viewer에서 모든 기능을 확인할 수 있다.

---

# 33. Codex 실행 순서

Codex는 아래 순서대로 작업한다.

```text
STEP 1
원본 6개 검사
↓
STEP 2
source_analysis.md 생성
↓
STEP 3
alignment/reference sheet 생성
↓
STEP 4
파츠 분리 계획 및 layer_manifest.json
↓
STEP 5
자동으로 안전하게 분리 가능한 파츠 추출
↓
STEP 6
사람의 보정이 필요한 곳 표시
↓
STEP 7
rigging_spec.md 작성
↓
STEP 8
Cubism용 수작업 단계 문서화
↓
STEP 9
emotion_presets.json 작성
↓
STEP 10
runtime / debug viewer 구현
↓
STEP 11
blink / breath / lip-sync test 구현
↓
STEP 12
Live2D export가 존재하면 실제 모델 연결
↓
STEP 13
16 emotion 전환 QA
↓
STEP 14
최종 qa_checklist.md 작성
```

---

# 34. 첫 실행에서 Codex가 해야 할 보고

처음 작업을 시작하면 바로 전체 구현으로 뛰어들지 말고,
먼저 아래 보고서를 생성한다.

`docs/source_analysis.md`

포함 내용:

1. 원본 파일 목록/해상도
2. 기본 베이스로 사용할 이미지
3. 각 이미지에서 재사용할 얼굴/팔/다리/이펙트
4. 가려진 부분 복원이 필요한 영역
5. Live2D deformation만으로 가능한 감정
6. 대체 파츠가 필요한 감정
7. 완전 별도 pose가 필요한 감정
8. 예상되는 Cubism 수작업 항목
9. Live2D / Spine / custom runtime 중 현재 소스에 가장 적합한 방식
10. 그 선택의 이유

그 뒤 작업을 진행한다.

---

# 35. 구현상의 최우선 순위

우선순위는 다음과 같다.

```text
1. 원본 캐릭터성 보존
2. 감정 전환 품질
3. 눈/입 자연스러움
4. 립싱크 확장성
5. 호흡/눈깜빡임
6. 자동화율
7. 개발 편의성
```

자동화하기 쉽다는 이유로 원본 캐릭터성을 희생하지 않는다.

---

# 36. 참고할 공식 문서

Live2D:

- Standard Parameter List  
  https://docs.live2d.com/en/cubism-editor-manual/standard-parameter-list/
- Expression Settings and Export  
  https://docs.live2d.com/en/cubism-editor-manual/setting-and-exporting-facial-expressions/
- Expression Motion  
  https://docs.live2d.com/en/cubism-sdk-manual/expression/
- Automatic Eye Blinking  
  https://docs.live2d.com/en/cubism-sdk-manual/autoeyeblink/
- Breath  
  https://docs.live2d.com/en/cubism-sdk-manual/breath/
- Lip-sync  
  https://docs.live2d.com/en/cubism-sdk-manual/lipsync/
- Motion-sync  
  https://docs.live2d.com/en/cubism-editor-manual/motion-sync/

대안 검토:

- Spine User Guide  
  https://esotericsoftware.com/spine-user-guide/

Live2D SDK/Editor 버전은 작업 시점의 안정 릴리스를 확인하고,
특별한 이유가 없으면 alpha 기능에 종속시키지 않는다.

---

# 37. Codex에 줄 최종 한 줄 지시

> 이 프로젝트의 목표는 “새 캐릭터를 만드는 것”이 아니라, 제공된 6개 원본 PNG의 캐릭터성과 선/색/비율을 유지하면서 자연스럽게 살아 움직이는 2D 아바타를 만드는 것이다. 자동화를 위해 원본을 벡터화하거나 재해석하지 말고, 필요한 경우 수작업 checkpoint를 명확히 남겨라.

