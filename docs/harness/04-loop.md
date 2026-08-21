# 04. 루프 — 구현부터 종료까지

> **원본 범위** — 루프의 시작점, 구현 루프와 상한, PR 생성, CI 실패 복귀, AI Review, 사람 최종 게이트, 최종 상태
> **보호 문서** — AI는 이 파일을 수정하지 않는다 ([00-ssot.md](00-ssot.md) 5절)

| 이 문서가 답하는 것 | |
| --- | --- |
| 루프는 무엇으로 시작하는가 | 1절 |
| 종료 조건을 어떻게 처리하는가 | 2절 |
| 몇 번까지 다시 시도하는가 | 3절 |
| PR은 언제 만드는가 | 4절 |
| CI가 실패하면 | 5절 |
| AI Review 결과는 누가 처리하는가 | 6절 |
| 언제 Merge하는가 | 7절 |
| 작업은 어떤 상태로 끝나는가 | 8절 |

---

## 1. 시작점 — Issue 번호 전달

이 루프의 시작은 **사람이 처리할 Issue 번호를 전달하는 것**이다.

```text
사람: 23번 이슈 처리해줘
```

AI는 Issue 내용을 사람에게 다시 받지 않는다. 전달받은 번호로 GitHub CLI를 사용해 직접 조회한다.

```bash
gh issue view 23
```

여기서 다음을 읽는다.

```text
변경할 내용
종료 조건
건드리면 안 되는 것
구현 루프 최대 횟수
```

이렇게 하면 Issue가 개별 유지보수 작업의 단일 원본이 된다. 사람이 내용을 옮겨 적는 과정에서 종료 조건이 빠지거나 바뀌는 일이 생기지 않는다.

다만 Issue를 읽은 뒤 바로 구현하지 않는다. **먼저 해당 작업과 관련된 SSOT를 확인한다** — 절차와 충돌 처리는 [00-ssot.md](00-ssot.md) 3절·4절에 있다.

```text
Issue
↓
관련 SSOT 확인
↓
충돌 검사
├─ 충돌 없음 → 계획 및 구현
└─ 충돌 있음 → NEEDS_HUMAN
```

기준 자체가 충돌하는 문제는 구현 반복으로 해결하지 않고 사람에게 넘긴다.

### 브랜치와 Issue 번호

구현에 앞서 브랜치를 만든다. **현재 Issue 번호는 브랜치명에서 읽는다** (`23-expiry-dispose` → 23).

이 번호는 두 곳에서 쓰인다.

```text
tests/issues/issue-23-*.test.ts     이번 계약의 종료 조건 파일명   → 02-contract.md 5절
보호 경로 예외 판정                   과거 Issue의 테스트는 쓰기 금지  → scripts/verify/protected.ts
```

브랜치명이 두 판정의 입력이므로, 번호를 읽을 수 없는 이름은 쓰지 않는다.

---

## 2. 종료 조건 처리

Issue의 종료 조건을 읽고 판정 가능성 검사를 수행한다. **판정 기준과 세 갈래의 정의는 [02-contract.md](02-contract.md) 2절이 원본이다.**

```text
기계 판정 가능    → tests/issues/issue-{번호}-{기능명}.test.ts 로 추가
사람 판단 항목    → 7절 최종 승인 항목으로 분리
조건이 불명확      → NEEDS_HUMAN
```

추가한 테스트는 `npm run verify`에 자동으로 포함된다 ([03-verify.md](03-verify.md) 2절).

---

## 3. 구현 루프와 상한

Issue가 준비되면 AI는 다음 순서로 작업한다.

```text
Issue 읽기
   ↓
종료 조건 확인
   ↓
계획
   ↓
브랜치 생성
   ↓
구현
   ↓
npm run verify
   ├─ PASS → PR 단계
   │
   └─ FAIL
        ↓
      로그 분석
        ↓
      수정
        ↓
      npm run verify
```

이번 하네스의 핵심 반복은 바로 이 구간이다. **구현 → 검증 → 실패 분석 → 재수정**이다.

### 상한은 3회

처음에는 종료 조건을 만족할 때까지 계속 반복하는 구조를 생각했다. 하지만 AI가 해결할 수 없는 문제를 무한히 반복하게 하는 것도 좋은 하네스는 아니다.

따라서 기본 구현 루프 상한은 **3회**로 한다.

```text
구현
 ↓
verify 실패        # 1
 ↓
수정
 ↓
verify 실패        # 2
 ↓
수정
 ↓
verify 실패        # 3
 ↓
STOP
```

이 값은 Issue의 「구현 루프 최대 횟수」 항목으로 개별 지정할 수 있다 ([02-contract.md](02-contract.md) 4절).

3회 안에 해결하지 못하면 성공한 척하지 않고 사람에게 넘긴다.

```text
NEEDS_HUMAN
```

이때 최소한 다음 내용을 남긴다.

```text
마지막 verify 실패 결과
총 시도 횟수
시도한 방법
수정한 내용
현재 막힌 지점
사람이 확인해야 할 내용
```

따라서 구현 루프에는 두 가지 결과가 존재한다.

```text
SUCCESS
NEEDS_HUMAN
```

---

## 4. PR 생성

로컬 `npm run verify`가 성공하면 PR을 생성한다. 사람의 별도 지시를 기다리지 않는다.

```text
npm run verify PASS
        ↓
PR 생성
```

PR에는 작업한 Issue를 연결한다.

```text
Closes #23
```

여기까지는 별도의 사람 개입 없이 진행하는 것을 목표로 한다.

---

## 5. CI 실패와 복귀

PR이 생성되면 GitHub Actions가 독립된 환경에서 같은 `npm run verify`를 실행한다. CI의 역할과 실패 시 확인할 항목은 [03-verify.md](03-verify.md) 3절에 있다.

CI에서 실패하면 원인을 분석하고, 자동으로 수정할 수 있다면 구현 단계로 돌아간다.

```text
CI FAIL
   ↓
원인 분석
   ↓
수정
   ↓
Local Verify
   ↓ PASS
PR 업데이트
   ↓
CI에서 새 환경 생성
   ↓
CI Verify 재실행
```

### PR 이후 수정 루프에도 상한을 둔다

CI 실패 또는 사람의 최종 검토에서 수정 지시를 받아 구현 단계로 복귀하는 횟수에는 별도의 상한을 둔다.

```text
PR
↓
CI 실패 또는 사람의 수정 지시
↓
구현 단계로 복귀
↓
수정 + Local Verify
↓
PR 업데이트
↓
CI / Review 재확인
↓
반복
```

이 반복이 정해진 상한을 넘으면 더 이상 AI가 계속 수정하지 않고 `NEEDS_HUMAN`으로 넘긴다.

> **구체적인 상한값은 지금 임의로 정하지 않고 H5 실습에서 실제 수정 횟수를 관찰한 뒤 결정한다.**
> (미정 상태 — 관찰 항목은 [05-experiment.md](05-experiment.md) 3절)

CI 실패 자체를 별도의 핵심 반복 루프로 보지는 않는다. **핵심 구현 루프는 여전히 로컬의 구현 → verify → 수정 과정이고, PR 이후에는 별도의 제한된 수정 루프만 허용한다.**

---

## 6. AI Review

CI까지 통과하면 AI에게 코드 리뷰를 맡긴다. `verify`와 AI Review의 역할은 다르다.

```text
verify
→ 코드가 정해진 규칙과 테스트를 통과하는가?

AI Review
→ 구현 방법 자체에 문제가 없는가?
```

Review에서는 다음과 같은 것을 확인한다.

```text
불필요하게 복잡하게 구현하지 않았는가?
기존 구조를 이상하게 우회하지 않았는가?
Issue의 의도를 잘못 해석하지 않았는가?
위험한 변경이 포함되지 않았는가?
```

가능하면 구현을 담당한 AI와 리뷰를 담당한 컨텍스트를 분리한다.

```text
구현 AI
≠
Review AI 컨텍스트
```

Review AI는 코드를 직접 수정하지 않고 **리뷰 결과만 남긴다.** 리뷰에서 문제가 발견되더라도 그 결과를 자동으로 구현 AI에게 넘겨 수정시키지 않는다.

```text
AI Review
   ↓
Review 결과
   ↓
[사람]
PR 내용 + CI 결과 + Review 결과 확인
   ↓
승인 또는 수정 필요 판단
```

코드 리뷰는 종료 조건처럼 참·거짓으로만 판정되는 영역이 아니다. Review AI가 구조, 보안, 유지보수성 등의 문제를 제기하더라도 그 지적이 실제로 수정해야 할 사항인지, 현재 Issue의 범위에서 받아들여야 하는지는 사람이 판단한다.

---

## 7. 마지막 사람 게이트

모든 자동 검증과 Review를 통과해도 자동으로 Merge하지 않는다.

```text
Local Verify PASS
+
CI Verify PASS
+
AI Review 결과
        ↓
[사람]
최종 확인
```

사람은 여기서 기계가 판단하기 어려운 부분을 확인한다.

```text
Issue의 실제 의도와 맞는가?
원했던 방식으로 구현됐는가?
AI Review의 지적 중 실제로 반영해야 할 것이 있는가?
화면이나 사용 흐름에 문제가 없는가?
최종적으로 받아들일 수 있는 변경인가?
```

문제가 없다면 승인한다.

```text
승인
 ↓
Merge
 ↓
Issue Close
```

반대로 검증을 모두 통과했더라도 구현 방향이 Issue의 의도와 다르거나, Review 결과를 포함해 추가 수정이 필요하다고 판단되면 승인하지 않는다.

```text
사람 검토
 ↓
반려
 ↓
구현 단계로 복귀
 ↓
수정
 ↓
verify
 ↓
PR 업데이트
 ↓
CI
 ↓
AI Review
 ↓
사람 재검토
```

이때 PR을 새로 생성하지 않는다. 기존 PR이 해당 브랜치를 계속 추적하므로 수정 후 같은 브랜치에 Push한다.

이 반려로 인한 복귀도 **PR 이후 수정 루프 횟수에 포함**한다 (5절). 반려가 반복되어 상한을 넘으면 `NEEDS_HUMAN`으로 종료한다.

즉 **기계적 정답과 사람의 의도를 둘 다 통과해야 최종 완료**다.

---

## 8. 최종 상태

최종 작업 상태는 두 개로 둔다.

```text
MERGED
NEEDS_HUMAN
```

`SSOT_CONFLICT`, `BLOCKED`, `VERIFY_FAIL`, `CI_FAIL` 등은 작업 도중 발생하는 이벤트다.

```text
Event: PROTECTED_PATH_CHANGE
Result: BLOCKED

Final State: NEEDS_HUMAN
```

전체 흐름은 다음과 같다.

```text
Issue
 ↓
SSOT 확인
 ├─ 충돌 → NEEDS_HUMAN
 └─ 문제 없음
        ↓
Implementation Loop
 ├─ verify FAIL → 수정 → 재검증
 ├─ 구현 루프 상한 도달 → NEEDS_HUMAN
 └─ verify PASS
        ↓
       PR
        ↓
GitHub Actions
독립 테스트 환경 준비
        ↓
   CI verify
    ├─ FAIL → 구현 단계로 복귀
    │          ↓
    │       수정 + Local Verify
    │          ↓
    │       PR 업데이트
    │          ↓
    │       CI 재확인
    │
    └─ PASS
         ↓
     AI Review
         ↓
     Review 결과
         ↓
   사람 최종 판단
   (PR 내용 + CI 결과 + Review 결과)
    ├─ 수정 필요 → 구현 단계로 복귀
    │               ↓
    │            수정 + Local Verify
    │               ↓
    │            PR 업데이트
    │               ↓
    │            CI → AI Review → 사람 재검토
    │
    └─ 승인
            ↓
          MERGED
            ↓
        Issue Close

PR 이후 수정 루프
→ 정해진 상한 도달
→ NEEDS_HUMAN
```

즉 `NEEDS_HUMAN`으로 가는 경로는 두 군데다.

```text
1. 로컬 Implementation Loop에서 상한 도달
2. PR 이후 수정 루프(CI 실패 · 사람 수정 지시)에서 상한 도달
```

사람의 판단이 즉시 필요한 문제가 발생한 경우에도 반복을 계속하지 않고 `NEEDS_HUMAN`으로 종료할 수 있다.
