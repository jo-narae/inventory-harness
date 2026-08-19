# 00. SSOT 정책

> H0 산출물 · 하네스 정책의 근거: [../08-harness.md](../08-harness.md) 23절  
> **보호 문서** — AI는 이 파일을 수정하지 않는다 (5절 참조)

---

## 0. 이 문서의 역할

**어떤 질문에 어떤 원본을 봐야 하는지**를 정한다.

모든 정보를 한 문서에 모으는 것이 목적이 아니다. 정보는 지금 있는 자리에 그대로 두고,  
**영역마다 최종 판단 권한을 가진 문서 하나**를 지정한다.

```text
"재고 감소에 사유를 꼭 붙여야 하나?"   → docs/01-requirements.md
"폐기도 applyMovement를 거쳐야 하나?"  → docs/06-architecture.md
"verify가 3번 실패하면 어떻게 하나?"   → docs/08-harness.md
"이번에 무엇을 고쳐야 하나?"           → GitHub Issue
```

---

## 1. 영역별 SSOT

| 영역 | 원본 | 여기서 결정되는 것 |
| --- | --- | --- |
| 제품 기능 · 도메인 규칙 | `docs/01-requirements.md` | 무엇을 만드는가. 로트의 정의, 사유 체계, FEFO/LEFO, 팝업 정산, 완료 기준 |
| 기술 구조 · 아키텍처 불변식 | `docs/06-architecture.md` | 어떻게 만드는가. 데이터 모델, `applyMovement` 단일 통로, 트랜잭션 경계 |
| 유지보수 하네스 정책 | `docs/08-harness.md` | 어떻게 검증하고 언제 멈추는가. verify 구성, 루프 상한, 보호 규칙, PR 게이트 |
| 개별 유지보수 작업 | **GitHub Issue** | 이번에 무엇을 바꾸고, 무엇이 참이면 완료인가 |
| 검사 규칙의 실제 내용 | `scripts/verify/` | 실행되는 규칙 그 자체 (H1 이후) |

마지막 줄이 중요하다. **규칙의 원본은 그 규칙을 실행하는 코드**이고,  
`08-harness.md`는 그 코드가 왜 그렇게 생겼는지를 설명하는 정책 문서다.  
규칙 목록을 알고 싶으면 문서가 아니라 `scripts/verify/`를 읽는다.

---

## 2. 참고 문서 — 기준이 아닌 것

아래는 배경과 의도를 이해하는 데 쓰지만, **구현 판단의 최종 근거로 사용하지 않는다.**

| 문서 | 성격 |
| --- | --- |
| `docs/02-personas.md` | 사용자 성격과 설계 긴장점 |
| `docs/03-scenarios.md` | 업무 흐름 S1~S12, 설계 원칙 P1~P12 |
| `docs/04-engagement.md` | 차별화 장치 E1~E3 |
| `docs/05-design.md` | 화면·컴포넌트 명세 |
| `docs/07-plan.md` | **최초 구현 당시의 계획.** 지나간 기록이다 |
| `docs/HANDOVER.md` | 구현 중 정해진 것, 함정, 파일 지도 |
| `docs/harness/01-log.md` | 하네스 실험 기록 |

`07-plan.md`을 특히 조심한다. M1~M7 진행 상황과 "구현 중 결정" 메모가 섞여 있어  
현재 상태처럼 읽히기 쉽지만, **제품 요구사항이나 현재 아키텍처를 바꾸지 못한다.**

---

## 3. 작업 시작 전 확인 절차

Issue를 읽고 바로 구현하지 않는다.

```text
Issue 조회 (gh issue view N)
      ↓
관련 SSOT 확인
      ↓
기준 충돌 검사
 ├─ 충돌 없음 → 계획 → 구현
 └─ 충돌 있음 → NEEDS_HUMAN
```

여기서 기준 충돌은 **Issue ↔ SSOT뿐 아니라, 작업에 관련된 SSOT ↔ SSOT 충돌도 포함한다.**

매번 모든 문서를 읽는 것이 목적은 아니다. 변경 영역에 따라 필요한 기준만 확인한다.

| 작업 영역 | 확인할 SSOT |
| --- | --- |
| 재고 증감 · 이동 · 사유 코드 | `01` F5-1 · `06` 4.1 `applyMovement` |
| 로트 배분 (FEFO / LEFO) | `01` F5·F6 · `06` 4.2 |
| 팝업 반출 · 정산 역산 | `01` F7 · `06` 4.3 |
| 취소 · 이력 | `01` F10 · `06` 4.4 (상쇄 기록 · 중복 취소 금지) |
| 유통기한 · 폐기 | `01` F9 · `06` 4.1 |
| 실사 · 수치 반영 | `01` F8 · `02` T5 (성격 차이) |
| 화면 · 컴포넌트 | `05` (참고) — 동작 규칙은 `01` |
| 하네스 자체의 동작·정책 | `08` |

---

## 4. 충돌 규칙

기준이 서로 다른 말을 하면 **AI가 어느 쪽이 맞는지 결정하지 않는다.**

원칙은 단순하다.

- **SSOT ↔ 참고 문서가 충돌하면 SSOT가 우선한다.**
- **SSOT ↔ SSOT가 충돌하면 AI가 우선순위를 정하지 않고 `NEEDS_HUMAN`으로 종료한다.**
- **Issue가 SSOT를 변경하려는 경우에도 AI가 임의로 기준을 바꾸지 않는다.**

| 충돌 | 처리 |
| --- | --- |
| GitHub Issue ↔ `01-requirements.md` | 구현하지 않음 → `NEEDS_HUMAN` |
| GitHub Issue ↔ `06-architecture.md` | 구현하지 않음 → `NEEDS_HUMAN` |
| GitHub Issue ↔ `08-harness.md` | 구현하지 않음 → `NEEDS_HUMAN` |
| `01-requirements.md` ↔ `06-architecture.md` | 어느 쪽도 우선하지 않음 → `NEEDS_HUMAN` |
| `07-plan.md` ↔ `01` / `06` | `01` · `06` 우선. 충돌로 보지 않는다 |
| 참고 문서(`02`~`05`, `HANDOVER`) ↔ `01` / `06` | `01` · `06` 우선 |

### 의도적인 기준 변경도 마찬가지다

Issue가 기존 요구사항이나 아키텍처를 **바꾸려는 작업**이라면 기존 SSOT를 무시하고 바로 구현하지 않는다.

사람이 변경 의도를 확인하고 해당 SSOT를 먼저 갱신한 뒤 작업한다.

```text
Issue
  "폐기는 lot.update()로 직접 재고를 감소시킨다."

06-architecture.md
  "모든 재고 변경은 applyMovement()를 통한다."

      ↓
SSOT_CONFLICT
      ↓
NEEDS_HUMAN
      ↓
사람이 변경 여부 판단
      ↓
필요한 SSOT 갱신
      ↓
갱신된 기준으로 다시 작업
```

Issue가 더 최신이라는 이유만으로 SSOT를 이기지 못한다.

**기준을 먼저 고치고, 그다음 코드를 고친다.**

마찬가지로 `01-requirements.md`와 `06-architecture.md`처럼 서로 다른 영역의 SSOT끼리 충돌하는 경우에도 AI가 어느 쪽을 우선할지 판단하지 않는다. 사람이 충돌을 해소하고 SSOT를 갱신한 뒤, 정리된 기준으로 작업을 재개한다.

---

## 5. 보호 대상

AI가 기준과 심판을 스스로 고치면 기준의 의미가 사라진다. 아래는 변경 금지다.

```text
docs/01-requirements.md
docs/06-architecture.md
docs/08-harness.md
docs/harness/00-ssot.md      ← 이 문서

scripts/verify/**
tests/**invariant**
.github/workflows/**
기존 prisma/migrations/**
```

허용되는 것:

```text
docs/harness/01-log.md        실험 기록
새 테스트 파일                 예: tests/dispose.test.ts
새 migration                   기존 migration 수정은 금지
```

> **이 목록의 원본은 H1 이후 `scripts/verify/protected.ts`로 옮긴다.**  
> 그 시점부터 여기에는 목록을 두지 않고 그 파일을 가리킨다.  
> 지시가 아니라 **Git 변경 내역으로 판정**하며, 위반 시 `verify`가 실패한다.

---

## 6. SSOT 변경 규칙

구현 중 기준 자체를 바꿔야 한다고 판단해도 직접 수정하지 않는다.

```text
SSOT 변경 필요 발견
      ↓
직접 수정하지 않음
      ↓
변경이 필요한 이유를 기록
      ↓
NEEDS_HUMAN
```

> **코드를 기준에 맞추는 것이 기본이고, 기준을 코드에 맞춰 바꾸지 않는다.**

SSOT를 고치는 것은 사람의 일이다. 사람이 갱신한 뒤에 그 기준으로 다시 작업한다.

---

## 7. 이 문서를 고쳐야 할 때

아래가 달라지면 사람이 이 문서를 갱신한다.

- 새 SSOT 영역이 생겼을 때 (예: 배포 정책 문서 추가)
- 보호 대상이 늘거나 줄었을 때
- 문서 배치가 바뀌었을 때 (`../08-harness.md` 22.1과 함께 고친다)

갱신하면 `08-harness.md` 22.1의 산출물 표와 어긋나지 않는지 확인한다. 둘은 같은 배치를 말해야 한다.
