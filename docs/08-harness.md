# 08. 유지보수 하네스 설계

> Phase 8
>  대상: M1\~M7까지 구현한 재고관리 PoC
>  목표: 사람이 만든 유지보수 이슈를 AI가 읽고, 구현하고, 검증하고, PR까지 처리하는 유지보수 하네스를 구축한다.
>
> **상태: 설계 단계. H0\~H4는 아직 착수하지 않았다.**

---

## 0. 한 줄 요약

**사람이 문제와 종료 조건을 정의하면, AI는 검증을 통과할 때까지 반복해서 수정한다. 단, 정해진 횟수 안에 해결하지 못하면 실패를 인정하고 사람에게 넘긴다.**

완료 여부는 AI의 설명이 아니라 **실행 가능한 검증 결과**가 판단한다.

---

# 1. 이번 실습에서 검증하려는 것

이번 실습의 목적은 재고관리 프로그램 자체를 완성하는 것이 아니다.

M1\~M7까지 만든 재고관리 PoC에 실제 유지보수 이슈를 만들고,

> **AI가 어디까지 사람 대신 유지보수를 수행할 수 있는가?**

를 확인하는 것이 목적이다.

전체 흐름은 다음과 같다.

```
[사람]
Issue 작성
+ 종료 조건 정의
        ↓
[AI]
Issue 분석
        ↓
구현
        ↓
npm run verify
   ├─ 실패 → 원인 분석 → 수정 → 재검증
   │
   └─ 성공
        ↓
PR 생성
        ↓
[GitHub Actions]
독립된 테스트 환경 준비
        ↓
npm run verify 재실행
        ↓
AI Review
        ↓
필요하면 수정 및 재검증
        ↓
[사람]
최종 승인
        ↓
Merge
        ↓
Issue Close

```

여기서 중요한 것은 단순히 AI를 반복시키는 것이 아니다.

두 가지를 먼저 정해야 한다.

1. **무엇을 완료라고 판단할 것인가**
2. **AI가 해결하지 못했을 때 언제 멈출 것인가**

즉 성공뿐 아니라 **실패했을 때의 종료 방법까지 하네스에 포함한다.**

---

# 2. 사람과 AI의 경계

사람의 개입 지점은 크게 시작과 끝이다.

## 시작

사람이 유지보수 Issue와 종료 조건을 정의한다.

## 끝

모든 검증과 리뷰를 통과한 PR을 사람이 최종 확인한다.

그 사이 과정은 가능한 한 AI가 담당한다.

```
[사람]
Issue + 종료 조건
        ↓
[AI]
구현
검증
재시도
PR 생성
CI 결과 확인
AI Review 대응
        ↓
[사람]
최종 승인

```

사람의 별도 지시 없이 로컬 검증에 성공하면 PR 단계로 넘어간다.

```
npm run verify
        ↓ PASS
PR 생성

```

---

# 3. Issue = 유지보수 계약서

Issue에는 최소한 두 가지가 필요하다.

```
무엇을 바꿀 것인가
+
무엇이 참이면 완료인가

```

두 번째가 **종료 조건**이다.

예를 들어 다음 조건은 사람이 이해하기에는 쉽지만 기계가 판정하기 어렵다.

```
- 만료 화면이 잘 동작한다.
- 폐기 기능이 정상적으로 동작한다.
- 기존 기능이 깨지지 않는다.

```

이 상태에서는 결국 AI가

> "정상적으로 동작합니다."

라고 스스로 판단할 가능성이 있다.

따라서 종료 조건은 가능한 한 **실제로 실행해서 참과 거짓을 확인할 수 있는 형태**로 작성한다.

예:

```
- 만료·임박 조회 함수가 대상 로트를 정확히 반환한다.
- 폐기 기능을 검증하는 신규 테스트가 존재하고 통과한다.
- 만료 로트 6개 폐기 시 자사창고 -6, 폐기 거점 +6이 된다.
- 작업 전후 전체 재고 수량은 동일하다.
- 폐기 Movement의 reason이 비어 있지 않다.
- 폐기 취소 시 원래 재고 수량으로 복구된다.

```

핵심은

> **"기능을 만들었다"가 아니라 "결과가 맞다"를 검증하는 것**

이다.

---

# 4. 기계가 판단할 것과 사람이 판단할 것

모든 조건을 자동화할 수 있는 것은 아니다.

예를 들어 다음과 같은 것은 테스트로 판단할 수 있다.

```
만료 재고 조회 결과
재고 수량 변화
Movement 생성 여부
취소 후 재고 복구
Type Check
Lint
Build

```

반면 다음과 같은 것은 사람이 직접 확인하는 편이 낫다.

```
화면이 의도한 형태인가?
사용하기 불편하지 않은가?
기능의 방향이 Issue의 실제 의도와 맞는가?

```

따라서 역할을 나눈다.

```
기계가 판정할 수 있는 것
→ verify

기계가 판정하기 어려운 것
→ 사람 최종 승인

```

---

# 5. Issue 템플릿

```
## 배경
왜 이 작업이 필요한가?

## 변경할 내용
무엇을 수정하거나 추가해야 하는가?

## 종료 조건
- [ ] 실행 가능한 조건 1
- [ ] 실행 가능한 조건 2
- [ ] 실행 가능한 조건 3

## 건드리면 안 되는 것
필요한 경우 추가한다.

## 구현 루프 최대 횟수
기본값: 3

```

종료 조건이 지나치게 추상적이라 기계적으로 확인할 수 없다면 바로 구현하지 않는다.

먼저 검증 가능한 조건으로 바꿀 수 있는지 확인한다.

검증으로 바꾸기 어려운 항목은 최종 사람 승인 단계에서 확인한다.

---

# 6. 심판 — `npm run verify`

AI가 스스로 작업 완료 여부를 결정하지 못하도록 공통 검증 명령을 둔다.

```
npm run verify

```

이 명령을 **이번 하네스의 공통 심판**으로 사용한다.

예:

```
1. Type Check
2. Lint
3. Architecture Check
4. Domain Test
5. Build

```

실제 명령은 다음과 같이 구성할 수 있다.

```
tsc --noEmit
eslint
tsx scripts/verify/arch.ts
vitest run
next build

```

하나라도 실패하면 `verify` 전체가 실패한다.

따라서 AI가

> "핵심 기능은 완성됐습니다."

라고 설명하더라도 `npm run verify`가 실패하면 작업은 아직 끝난 것이 아니다.

---

# 7. 로컬과 CI는 같은 심판을 사용한다

`npm run verify`는 두 곳에서 실행한다.

```
AI 작업 환경
npm run verify
        ↓ PASS
PR 생성
        ↓
GitHub Actions
독립 테스트 환경 준비
        ↓
npm run verify

```

두 번째 검증은 새로운 기준으로 다시 채점하기 위한 것이 아니다.

**AI가 작업한 로컬 환경에서 통과한 결과가 깨끗한 GitHub 환경에서도 동일하게 재현되는지 확인하기 위한 것이다.**

따라서 로컬과 CI가 사용하는 심판은 같다.

```
Local
→ npm run verify

CI
→ npm run verify

```

다만 실행 환경은 서로 독립적이다.

정상적으로 구성되어 있다면 로컬에서 통과한 결과는 CI에서도 그대로 통과해야 한다.

---

# 8. 재고관리 PoC의 불변식

재고관리 PoC를 실습 대상으로 선택한 이유는 결과를 비교적 명확하게 검증할 수 있기 때문이다.

대표적인 규칙은 다음과 같다.

| 규칙 검증                               |                         |
| ----------------------------------- | ----------------------- |
| 내부 이동으로 전체 재고량은 변하지 않는다             | 이동 전후 `totalStock()` 비교 |
| 모든 재고 수량 변경은 `applyMovement()`를 통한다 | Architecture Check      |
| 출고는 FEFO를 따른다                       | 테스트                     |
| 발송은 LEFO를 따른다                       | 테스트                     |
| 취소는 기존 원장을 삭제하지 않는다                 | 테스트                     |
| 취소 시 반대 Movement를 만든다               | 테스트                     |
| 같은 Movement는 두 번 취소할 수 없다           | 테스트                     |
| 유통기한은 공통 날짜 처리 함수를 사용한다             | Architecture Check      |

중요한 규칙은 문서에만 적어두지 않고 가능한 한 **실행 가능한 검사로 만든다.**

---

# 9. Architecture Check

테스트만으로 확인하기 어려운 구조적 규칙은 별도의 정적 검사로 만든다.

예:

```
src/actions
src/app

에서 lot.update( 직접 호출 금지

```

```
expiryDate에 원시 new Date( 직접 대입 금지

```

```
proxy.ts에서 lib/db 또는 lib/auth 직접 import 금지

```

검사 코드는 다음 위치에서 관리한다.

```
scripts/verify/arch.ts

```

목표는 간단하다.

```
문서에 적힌 규칙
        ↓
실제로 검사되는 규칙

```

---

# 10. 테스트 DB 격리

하네스는 같은 테스트를 여러 번 실행한다.

개발 DB를 그대로 사용하면 반복 과정에서 데이터가 오염되거나, 이전 실행 상태 때문에 우연히 테스트가 통과할 수 있다.

따라서 테스트 전용 DB를 사용한다.

예:

```
DATABASE_URL=file:./prisma/harness.db

```

여기서 중요한 점은 **`harness.db`** **파일 자체를 로컬과 CI가 공유하는 것이 아니라는 것**이다.

로컬에서는 `npm run verify`를 실행할 때마다 기존 테스트 DB를 재사용하지 않고 새로 만든다.

```
Local
↓
기존 테스트 DB 제거
↓
새 테스트 DB 생성
↓
Schema / Migration 적용
↓
필요한 테스트 데이터 준비
↓
npm run verify

```

즉 로컬에서도 이전 검증에서 남은 데이터가 다음 검증에 영향을 주지 않도록 한다.

GitHub Actions에서도 CI 실행 시 별도의 테스트 DB를 새로 만든다.

```
GitHub Actions
↓
새 테스트 DB 생성
↓
Schema / Migration 적용
↓
필요한 테스트 데이터 준비
↓
npm run verify

```

즉 두 환경은 같은 DB 파일을 사용하는 것이 아니라,

> **같은 방법으로 독립된 테스트 DB를 만들어 사용한다.**

테스트 DB 파일은 Git에 포함하지 않는다.

실제 구축 산출물은 DB 파일이 아니라 다음과 같다.

```
테스트용 DATABASE_URL 설정
테스트 DB 초기화 스크립트
Prisma 준비 스크립트
Schema / Migration 적용 과정
필요한 테스트 데이터 준비 과정
Local과 CI에서 동일하게 DB를 준비하는 방법

```

이렇게 해야 로컬과 CI 모두 이전 실행에서 남은 데이터에 의존하지 않고 테스트 결과를 재현할 수 있다.

핵심 원칙은 다음과 같다.

```
verify 1회
→ 새 테스트 DB

verify 2회
→ 이전 DB 재사용 금지
→ 다시 새 테스트 DB

verify 3회
→ 다시 새 테스트 DB
```

검증이 반복될수록 데이터가 쌓이는 구조가 아니라, **매번 같은 출발점에서 다시 판정하는 구조**로 만든다.

---

# 11. CI에서 테스트 DB를 준비하는 이유

GitHub Actions는 실행할 때마다 새로운 환경에서 시작한다.

따라서 로컬에 있는 `prisma/harness.db` 파일은 CI에 존재하지 않는다.

CI에서는 검증 전에 테스트 DB를 직접 준비해야 한다.

개념적으로는 다음과 같다.

```
GitHub Actions 시작
↓
코드 Checkout
↓
npm ci
↓
Prisma 준비
↓
테스트 DB 생성
↓
Schema / Migration 적용
↓
필요한 테스트 데이터 준비
↓
npm run verify

```

SQLite를 사용한다면 CI 안에서도 `harness.db` 파일을 새로 생성할 수 있다.

예:

```
Local
prisma/harness.db
→ 로컬 실행 시 생성

CI
prisma/harness.db
→ GitHub Actions 실행 시 새로 생성

```

둘은 이름만 같을 뿐 서로 다른 파일이다.

이 구조의 장점은 로컬 환경에 숨어 있는 의존성을 발견할 수 있다는 것이다.

예를 들어 로컬에서는 오래 사용한 테스트 DB에 필요한 데이터가 이미 존재해 우연히 테스트가 통과할 수도 있다.

```
Local
기존 harness.db 사용
↓
PASS

```

하지만 CI는 매번 깨끗한 상태에서 DB를 만들기 때문에 준비 과정이 빠져 있다면 실패한다.

```
CI
빈 환경
↓
DB 새로 생성
↓
필요한 준비 과정 누락
↓
FAIL

```

이 경우 CI가 실패하는 것은 문제가 아니라,

> **"현재 검증 과정이 깨끗한 환경에서는 재현되지 않는다."**

라는 문제를 발견한 것이다.

---

# 12. Harness Loop — 핵심 반복 구간

Issue가 준비되면 AI는 다음 순서로 작업한다.

```
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

이번 하네스의 핵심 반복은 바로 이 구간이다.

**구현 → 검증 → 실패 분석 → 재수정**

이다.

---

# 13. 구현 루프에는 상한을 둔다

처음에는 종료 조건을 만족할 때까지 계속 반복하는 구조를 생각했다.

하지만 AI가 해결할 수 없는 문제를 무한히 반복하게 하는 것도 좋은 하네스는 아니다.

따라서 기본 구현 루프 상한은 **3회**로 한다.

```
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

3회 안에 해결하지 못하면 성공한 척하지 않고 사람에게 넘긴다.

```
NEEDS_HUMAN

```

이때 최소한 다음 내용을 남긴다.

```
마지막 verify 실패 결과
총 시도 횟수
시도한 방법
수정한 내용
현재 막힌 지점
사람이 확인해야 할 내용

```

따라서 구현 루프에는 두 가지 결과가 존재한다.

```
SUCCESS
NEEDS_HUMAN

```

---

# 14. AI가 심판을 고치지 못하게 한다

테스트가 실패했을 때 AI가 구현 코드를 고치는 대신 **테스트 자체를 느슨하게 만들어버릴 수도 있다.**

예:

```
테스트 실패
   ↓

정상
→ 구현 코드 수정

문제
→ 테스트 삭제
→ expect 완화
→ Architecture Check 예외 추가

```

이를 막기 위해 일부 경로를 보호한다.

예:

```
scripts/verify/**
tests/**invariant**
.github/workflows/**
docs/01~08
docs/harness/00-ssot.md
기존 prisma/migrations/**

```

다만 새로운 기능을 검증하기 위한 테스트나 migration 추가는 허용한다.

예:

```
tests/dispose.test.ts

```

---

# 15. 보호 경로 변경도 기계가 확인한다

AI에게

> "보호된 파일을 수정하지 마."

라고 지시하는 것만으로는 충분하지 않다.

실제로 수정했는지 Git 변경 내역을 이용해 확인한다.

```
Git 변경 파일 확인
        ↓
보호 경로와 비교
        ↓
보호 파일 변경 발견
        ↓
verify FAIL

```

예:

```
Event: PROTECTED_PATH_CHANGE
Target: tests/stock-invariant.test.ts
Result: BLOCKED

```

즉 보호 규칙 역시 AI의 자기신고가 아니라 **실제 변경 내역으로 판단한다.**

---

# 16. PR 생성

로컬 `npm run verify`가 성공하면 PR을 생성한다.

```
npm run verify PASS
        ↓
PR 생성

```

PR에는 작업한 Issue를 연결한다.

예:

```
Closes #23

```

여기까지는 별도의 사람 개입 없이 진행하는 것을 목표로 한다.

---

# 17. CI — 독립 환경에서 다시 확인

PR이 생성되면 GitHub Actions가 실행된다.

구현 대상:

```
.github/workflows/verify.yml

```

GitHub Actions에서는 먼저 독립된 테스트 환경을 준비한다.

```
Checkout
↓
Dependency 설치
↓
Prisma 준비
↓
테스트 DB 생성
↓
Schema / Migration 적용
↓
필요한 테스트 데이터 준비
↓
npm run verify

```

로컬과 CI의 검증 명령은 동일하다.

```
npm run verify

```

정상적인 경우라면 로컬에서 통과한 결과가 그대로 PASS해야 한다.

```
Local Verify: PASS
        ↓
PR
        ↓
CI 환경 새로 준비
        ↓
CI Verify: PASS

```

CI에서 실패한다면 다음과 같은 문제를 확인한다.

```
커밋되지 않은 파일에 의존했는가?
환경변수가 빠졌는가?
테스트 DB 초기화 과정이 빠졌는가?
Migration 적용에 문제가 있는가?
테스트 데이터 준비가 빠졌는가?
Node/npm 환경 차이가 있는가?
파일명 대소문자 문제가 있는가?

```

CI에서 실패하면 원인을 분석하고, 자동으로 수정할 수 있다면 구현 단계로 돌아간다.

```
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

다만 PR 이후의 수정도 무한히 반복하지 않는다.

CI, AI Review, 그리고 사람의 최종 검토에서 반려되어 구현 단계로 복귀하는 횟수에는 별도의 상한을 둔다.

```
PR
↓
CI 또는 Review에서 수정 필요
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

구체적인 상한값은 지금 임의로 정하지 않고 **H5 실습에서 실제 수정 횟수를 관찰한 뒤 결정한다.**

CI 실패 자체를 별도의 핵심 반복 루프로 보지는 않는다.

**핵심 구현 루프는 여전히 로컬의 구현 → verify → 수정 과정이고, PR 이후에는 별도의 제한된 수정 루프만 허용한다.**

---

# 18. AI Review

CI까지 통과하면 AI에게 코드 리뷰를 맡긴다.

`verify`와 AI Review의 역할은 다르다.

```
verify
→ 코드가 정해진 규칙과 테스트를 통과하는가?

AI Review
→ 구현 방법 자체에 문제가 없는가?

```

예를 들어 Review에서는 다음과 같은 것을 확인한다.

```
불필요하게 복잡하게 구현하지 않았는가?
기존 구조를 이상하게 우회하지 않았는가?
Issue의 의도를 잘못 해석하지 않았는가?
위험한 변경이 포함되지 않았는가?

```

가능하면 구현을 담당한 AI와 리뷰를 담당한 컨텍스트를 분리한다.

```
구현 AI
≠
Review AI 컨텍스트

```

리뷰에서 수정할 내용이 발견되면 구현 단계로 돌아간다.

```
AI Review
   ↓
수정 필요
   ↓
코드 수정
   ↓
npm run verify
   ↓
Push
   ↓
CI
   ↓
AI Review

```

리뷰에서 수정이 필요하면 구현 단계로 돌아가지만, 이 과정 역시 무한히 반복하지 않는다.

CI, AI Review, 사람 반려를 따로 세지 않고 **PR 생성 이후 구현 단계로 복귀한 횟수**를 하나의 수정 루프로 본다.

복귀 사유는 셋이다.

```
CI 실패
AI Review 수정 요청
사람 최종 검토 반려
```

어느 사유든 구현 단계로 돌아가면 같은 카운터를 올린다.

정해진 상한을 넘으면 `NEEDS_HUMAN`으로 종료한다.

구체적인 상한값은 H5 실습에서 실제 수정 횟수를 관찰한 뒤 결정한다.

---

# 19. 마지막 사람 게이트

모든 자동 검증과 Review를 통과해도 자동으로 Merge하지 않는다.

```
Local Verify PASS
+
CI Verify PASS
+
AI Review PASS
        ↓
[사람]
최종 확인

```

사람은 여기서 기계가 판단하기 어려운 부분을 확인한다.

```
Issue의 실제 의도와 맞는가?
원했던 방식으로 구현됐는가?
화면이나 사용 흐름에 문제가 없는가?
최종적으로 받아들일 수 있는 변경인가?

```

문제가 없다면 승인한다.

```
승인
 ↓
Merge
 ↓
Issue Close

```

반대로 검증은 모두 통과했지만 구현 방향이 의도와 다르다면 승인하지 않는다.

```
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

이 반려로 인한 복귀도 **PR 이후 수정 루프 횟수에 포함**한다.

반려가 반복되어 상한을 넘으면 `NEEDS_HUMAN`으로 종료한다.

즉 **기계적 정답과 사람의 의도를 둘 다 통과해야 최종 완료**다.

---

# 20. 실험 로그

이번 실습에서는 결과뿐 아니라 AI가 유지보수 과정에서 어떻게 행동했는지도 기록한다.

```
docs/harness/01-log.md

```

`docs/01~08`과 `docs/harness/00-ssot.md`는 보호하지만
`docs/harness/01-log.md`는 실험 기록을 위해 수정할 수 있도록 한다.

---

# 21. 실험 로그에 남길 내용

Issue별로 최소한 다음을 기록한다.

```
Issue 번호
시작 시간
종료 상태

구현 시도 횟수

첫 Local Verify 결과
최종 Local Verify 결과
CI Verify 결과

실패 원인
각 시도에서 변경한 내용

보호 경로 변경 시도
AI Review 지적 사항
AI Review 반영 횟수

NEEDS_HUMAN 발생 여부
사람 개입 이유

최종 결과

```

예:

```
## Issue #23 — 만료 재고 폐기

Implementation Attempts: 2

First Local Verify: FAIL
Final Local Verify: PASS
CI Verify: PASS

Protected Path Attempts: 1
AI Review Findings: 2

Needs Human: No
Final: MERGED

```

CI에서 문제가 발생한 경우에는 원인을 별도로 기록한다.

```
Local Verify: PASS
CI Verify: FAIL
CI Failure Cause: 테스트 DB 초기화 과정 누락

```

---

# 22. 구축 순서

| 단계 | 목표 | 주요 산출물 |
|---|---|---|
| H0 | SSOT 정책 수립 | 기준 문서 정의, 문서 역할·충돌·변경 규칙 |
| H1 | 심판 구축 | `npm run verify`, Architecture Check, 보호 경로 검사, 테스트 DB 준비 과정, GitHub Actions |
| H2 | 계약서 | 유지보수 Issue Template |
| H3 | 구현 루프 | Issue → SSOT 확인 → 구현 → verify → 재시도 |
| H4 | PR 게이트 | PR → 독립 CI 재검증 → AI Review → 사람 승인 |
| H5 | 실전 검증 | 실제 유지보수 Issue 투입 + 실험 로그 |

가장 먼저 정할 것은 AI에게 작업을 시키는 방법이 아니다.

AI가 작업을 시작하기 전에 다음 두 가지를 먼저 만든다.

```text
무엇을 기준으로 구현할 것인가
+
무엇을 기준으로 완료를 판정할 것인가
```

첫 번째가 **SSOT 정책**, 두 번째가 **검증 체계**다.

따라서 전체 구축 순서는 다음과 같다.

```text
SSOT 정책
↓
검증 체계
↓
Issue 계약
↓
구현 루프
↓
PR 게이트
↓
실전 검증
```

> **기준을 먼저 정하고, 그 기준을 지키는지 판정할 심판을 만든 뒤 AI를 투입한다.**

---

## 22.1 산출물이 놓이는 자리

H0~H5에서 만드는 것 중 **문서는 두 개뿐**이고, 나머지는 실제로 실행되는 코드·설정이다.

| 단계 | 산출물 | 위치 | 성격 |
|---|---|---|---|
| H0 | SSOT 정책 | `docs/harness/00-ssot.md` | 문서 · **보호** |
| H1 | verify 명령 | `package.json` | 설정 |
| H1 | Architecture Check | `scripts/verify/arch.ts` | 코드 · **보호** |
| H1 | 보호 경로 검사 | `scripts/verify/protected.ts` | 코드 · **보호** |
| H1 | 테스트 DB 초기화 | `scripts/verify/reset-db.ts` | 코드 · **보호** |
| H1 | CI | `.github/workflows/verify.yml` | 설정 · **보호** |
| H2 | Issue 템플릿 | `.github/ISSUE_TEMPLATE/maintenance.yml` | 설정 |
| H3 | 구현 루프 | `.claude/skills/harness-loop/` | 스킬 |
| H4 | PR 게이트 | `.claude/skills/harness-ship/` | 스킬 |
| H5 | 실험 로그 | `docs/harness/01-log.md` | 문서 · 수정 허용 |

### 문서 배치

```text
docs/
├── 01-requirements.md   ┐
├── 02-personas.md       │
├── 03-scenarios.md      │  기획 Phase 산출물
├── 04-engagement.md     │  번호 = 만들어진 순서이자 읽는 순서
├── 05-design.md         │
├── 06-architecture.md   │
├── 07-plan.md           │
├── 08-harness.md        ┘  ← 하네스 "설계"는 여기 남는다
├── HANDOVER.md
└── harness/                 ← 하네스 "운영물"
    ├── 00-ssot.md           기준 지도 · 보호
    └── 01-log.md            실험 기록 · AI 수정 허용
```

번호 체계를 섞지 않는다.

```text
docs/ 루트의 번호   → 기획 Phase 순서 (01~08에서 끝)
harness/ 안의 번호  → 하네스 문서 자체의 순서 (00부터 새로 시작)
```

하네스 운영물을 `docs/` 루트에 번호로 밀어 넣으면 `00`은 "가장 먼저 읽을 것"인데
**실제로는 Phase 8에서 만들어지고**, `09`는 Phase 산출물이 아니라 실행 기록인데
아홉 번째 기획 문서처럼 보인다. 번호 하나가 세 가지를 뜻하게 되므로 디렉터리로 가른다.

### 왜 단계마다 문서를 만들지 않는가

H1의 검사 규칙을 별도 문서로 또 적으면 같은 규칙이 두 곳에 존재하게 된다.
문서와 `arch.ts`가 어긋나는 순간 **어느 쪽이 기준인지 다시 정해야 한다.**

이 하네스가 하려는 것은 그 반대다.

```text
문서에 적힌 규칙
      ↓
실제로 검사되는 규칙
```

따라서 H1~H4에서는 **검사 코드 자체가 규칙의 원본**이고,
`08-harness.md`는 그 코드가 왜 그렇게 생겼는지를 설명하는 정책 문서로 남는다.

```text
"규칙이 무엇인가"         → scripts/verify/
"왜 그런 규칙인가"        → docs/08-harness.md
"어떤 질문에 어디를 보나"  → docs/harness/00-ssot.md
```

문서를 줄이는 것이 목적이 아니라 **규칙이 두 벌 생기지 않게 하는 것**이 목적이다.

---

# 23. H0 — SSOT 정책 수립

현재 프로젝트에는 역할이 다른 여러 문서가 존재한다.

모든 정보를 하나의 문서로 합치기보다 **영역별로 어떤 문서가 기준인지 명확하게 정의한다.**

## 23.1 SSOT 정의

```text
docs/01-requirements.md
→ 제품 기능 · 도메인 규칙의 SSOT

docs/06-architecture.md
→ 기술 구조 · 아키텍처 불변식의 SSOT

docs/08-harness.md
→ 유지보수 하네스 정책의 SSOT

GitHub Issue
→ 개별 유지보수 작업의 SSOT
```

`docs/07-plan.md`은 최초 구현 당시의 계획을 기록한 문서다.

유지보수 작업에서 참고할 수는 있지만 제품 요구사항이나 현재 아키텍처를 결정하는 최종 기준으로 사용하지 않는다.

SSOT 정책 자체는 다음 파일에서 관리한다.

```text
docs/harness/00-ssot.md
```

예:

```markdown
# SSOT Policy

## 제품 요구사항
docs/01-requirements.md

## 아키텍처
docs/06-architecture.md

## 하네스 정책
docs/08-harness.md

## 개별 유지보수 작업
GitHub Issue

## 참고 문서
docs/02-personas.md
docs/03-scenarios.md
docs/04-engagement.md
docs/05-design.md
docs/07-plan.md
HANDOVER.md
```

목표는 모든 정보를 한 문서에 복사하는 것이 아니다.

> **어떤 질문에 어떤 원본을 봐야 하는지 명확하게 만드는 것**이다.

---

## 23.2 SSOT 충돌 규칙

문서가 여러 영역으로 나뉘어 있으면 서로 다른 내용이 발견될 수 있다.

AI가 이 경우 임의로 하나를 선택해서 구현하지 못하게 한다.

```text
GitHub Issue
vs
01-requirements.md

충돌
↓
구현하지 않음
↓
NEEDS_HUMAN
```

```text
GitHub Issue
vs
06-architecture.md

충돌
↓
구현하지 않음
↓
NEEDS_HUMAN
```

```text
07-plan.md
vs
01-requirements.md / 06-architecture.md

↓
Requirements / Architecture 우선
```

Issue가 기존 요구사항이나 아키텍처를 **의도적으로 변경하기 위한 작업**이라면 기존 SSOT를 무시하고 바로 구현하지 않는다.

먼저 사람이 변경 의도를 확인하고 해당 SSOT를 갱신한 뒤 작업한다.

예:

```text
Issue
"폐기 시 lot.update()로 직접 재고를 감소시킨다."

Architecture
"모든 재고 변경은 applyMovement()를 통한다."

↓
SSOT_CONFLICT
↓
NEEDS_HUMAN
```

AI가 어느 쪽이 맞는지 스스로 결정하지 않는다.

---

## 23.3 작업 시작 전 SSOT 확인

AI는 Issue를 읽고 바로 구현하지 않는다.

먼저 해당 작업과 관련된 SSOT를 확인한다.

```text
Issue 조회
↓
관련 SSOT 확인
↓
Issue ↔ SSOT 충돌 검사
├─ 충돌 없음 → 계획
└─ 충돌 있음 → NEEDS_HUMAN
```

모든 문서를 매번 전부 읽는 것이 목적은 아니다.

Issue의 변경 영역에 따라 필요한 기준을 확인한다.

예를 들어 `/expiry`와 폐기 기능을 구현한다면:

```text
GitHub Issue
+
01-requirements.md
+
06-architecture.md
```

를 확인한다.

하네스 자체의 동작이나 정책을 변경하는 작업이라면 `08-harness.md`도 기준이 된다.

---

## 23.4 SSOT 변경 규칙

AI가 Issue를 해결하기 위해 SSOT를 임의로 수정하면 기준의 의미가 사라진다.

따라서 SSOT는 보호 대상으로 둔다.

```text
docs/harness/00-ssot.md
docs/01-requirements.md
docs/06-architecture.md
docs/08-harness.md
```

구현 중 SSOT 자체의 변경이 필요하다고 판단하면 직접 수정하지 않는다.

```text
SSOT 변경 필요 발견
↓
직접 수정하지 않음
↓
변경이 필요한 이유 기록
↓
NEEDS_HUMAN
```

기본 원칙은 다음과 같다.

> **코드를 기준에 맞추는 것이 기본이고, 기준을 코드에 맞춰 바꾸지 않는다.**

---

# 24. H1 — 심판 구축

주요 산출물:

```
package.json
scripts/verify/arch.ts
보호 경로 Git diff 검사

테스트용 DATABASE_URL
테스트 DB 초기화 스크립트
Prisma 준비 스크립트
Schema / Migration 적용 과정
필요한 테스트 데이터 준비 과정

.github/workflows/verify.yml

```

목표는 로컬과 CI에서 같은 검증을 재현하는 것이다.

```
Local
기존 테스트 DB 제거
↓
새 테스트 DB 준비
↓
npm run verify

CI
새 테스트 DB 준비
↓
npm run verify

```

두 환경에서 사용하는 DB 파일은 서로 다르지만, **매 검증마다 깨끗한 DB를 준비하는 과정과 검증 명령은 동일하게 만든다.**

---

# 25. H2 — Issue 계약

주요 산출물:

```
.github/ISSUE_TEMPLATE/maintenance.yml

```

필수 항목:

```
배경
변경할 내용
종료 조건
건드리면 안 되는 영역
구현 루프 최대 횟수

```

---

# 26. H3 — Harness Loop

구현 대상 예시:

```
.claude/skills/harness-loop/

```

역할:

```
[사람] 처리할 Issue 번호 전달
→ gh CLI로 해당 Issue 조회
→ 관련 SSOT 확인
→ Issue와 SSOT 충돌 검사
→ 종료 조건 확인
→ 계획
→ 브랜치 생성
→ 구현
→ verify
→ 실패 분석
→ 재시도
→ SUCCESS 또는 NEEDS_HUMAN

```

## 시작점 — Issue 번호 전달

이 루프의 시작은 **사람이 처리할 Issue 번호를 전달하는 것**이다.

```
사람: 23번 이슈 처리해줘
```

AI는 Issue 내용을 사람에게 다시 받지 않는다.

전달받은 번호로 GitHub CLI를 사용해 직접 조회한다.

```bash
gh issue view 23
```

여기서 다음을 읽는다.

```
변경할 내용
종료 조건
건드리면 안 되는 것
구현 루프 최대 횟수
```

이렇게 하면 Issue가 개별 유지보수 작업의 단일 원본이 된다.

사람이 내용을 옮겨 적는 과정에서 종료 조건이 빠지거나 바뀌는 일이 생기지 않는다.

다만 Issue를 읽은 뒤 바로 구현하지 않는다.

먼저 해당 작업과 관련된 SSOT를 확인한다.

```text
Issue
↓
관련 SSOT 확인
↓
충돌 검사
├─ 충돌 없음 → 계획 및 구현
└─ 충돌 있음 → NEEDS_HUMAN
```

Issue가 `01-requirements.md` 또는 `06-architecture.md`와 충돌하면 AI가 임의로 어느 한쪽을 선택하지 않는다.

기준 자체가 충돌하는 문제는 구현 반복으로 해결하지 않고 사람에게 넘긴다.

이번 하네스에서 가장 중요한 자동 반복 구간이다.

---

# 27. H4 — Harness Ship

구현 대상 예시:

```
.claude/skills/harness-ship/
.github/workflows/verify.yml
GitHub branch protection

```

역할:

```
Local Verify PASS
→ PR 생성
→ GitHub Actions에서 독립 테스트 환경 준비
→ 동일한 verify 재확인
→ AI Review
→ 필요하면 제한된 횟수만 구현 단계로 복귀
→ 사람 최종 승인 요청

```

CI는 로컬 DB를 가져다 사용하는 것이 아니다.

**CI 실행 시 자신의 테스트 DB를 새로 만들고 같은 검증을 실행한다.**

PR 이후 CI · AI Review · 사람 반려 때문에 구현 단계로 돌아가는 수정 루프에도 상한을 둔다.

구체적인 상한값은 H5 실습 결과를 보고 결정한다.

---

# 28. H5 — 실제 유지보수 이슈

하네스만 보여주기 위한 가짜 문제를 만들기보다는 M1\~M7 구현 후 실제로 남아 있는 유지보수 작업을 투입한다.

## Issue 1 — `/expiry` + 폐기

첫 번째 실전 이슈로 사용한다.

결과를 숫자로 검증하기 쉽다.

```
만료 로트 6개 폐기
→ 자사창고 -6
→ 폐기 거점 +6
→ 전체 재고 변화 0

```

테스트 규칙:

```
기존 stock-invariant 테스트 수정 금지
신규 tests/dispose.test.ts 생성 허용

```

## Issue 2 — `/history` + 취소

기존 `reverseMovement()`를 활용한다.

```
기존 Movement
→ reverseMovement()
→ reversalOfId 연결
→ 원래 재고 상태 복구

```

## Issue 3 — `/settings`

앞선 두 이슈에서 하네스를 안정화한 뒤 진행한다.

---

# 29. 실습에서 관찰할 것

| 관찰 항목 | 확인할 내용 |
| --- | --- |
| SSOT 준수         | 관련 기준을 확인하고 충돌 시 임의로 구현하지 않았는가 |
| 첫 시도 성공률      | 첫 구현에서 verify를 통과했는가               |
| 구현 시도 횟수      | 성공 또는 중단까지 몇 번 수정했는가               |
| 실패 원인 분석      | 실패 로그를 다음 수정에 제대로 반영했는가            |
| 회귀 방지         | 새 기능 때문에 기존 기능을 깨뜨렸는가              |
| 보호 경로 변경      | 금지된 테스트나 심판을 수정하려 했는가              |
| CI 재현성        | 로컬 PASS가 새로 만든 CI 환경에서도 PASS했는가    |
| 테스트 DB 재현성    | 로컬과 CI 모두 빈 상태에서 테스트 DB를 준비할 수 있는가 |
| AI Review     | 기계 검증에서 잡지 못한 문제가 발견됐는가            |
| 사람 호출 시점      | 해결할 수 없을 때 제대로 멈췄는가                |
| 사람 최종 검토      | 검증 결과와 실제 의도가 일치했는가                |

---

# 30. 최종 상태

최종 작업 상태는 두 개로 둔다.

```
MERGED
NEEDS_HUMAN

```

`SSOT_CONFLICT`, `BLOCKED`, `VERIFY_FAIL`, `CI_FAIL` 등은 작업 도중 발생하는 이벤트다.

예:

```
Event: PROTECTED_PATH_CHANGE
Result: BLOCKED

Final State: NEEDS_HUMAN

```

전체 흐름은 다음과 같다.

```
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
      ├─ 수정 필요 → 구현 단계로 복귀
      │               ↓
      │            수정 + Local Verify
      │               ↓
      │            PR 업데이트
      │               ↓
      │            CI / Review 재확인
      │
      └─ PASS
           ↓
      사람 최종 승인
       ├─ 반려 → 구현 단계로 복귀
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

```
1. 로컬 Implementation Loop에서 상한 도달
2. PR 이후 수정 루프(CI · AI Review · 사람 반려)에서 상한 도달
```

사람의 판단이 즉시 필요한 문제가 발생한 경우에도 반복을 계속하지 않고 `NEEDS_HUMAN`으로 종료할 수 있다.

---

# 31. 이번 Phase의 성공 기준

Phase 8의 성공은 모든 유지보수를 완전히 자동화하는 것이 아니다.

최소 하나의 실제 Issue에서 다음 흐름을 끝까지 재현한다.

```
Issue
→ AI 구현
→ verify
→ 필요하면 재수정
→ verify 성공
→ PR
→ CI에서 독립 테스트 환경 생성
→ 동일한 verify 재검증
→ AI Review
→ 사람 승인
→ Merge
→ Issue Close

```

또는 AI가 해결하지 못했다면,

```
Issue
→ 반복 시도
→ 상한 도달
→ 실패 기록
→ NEEDS_HUMAN
→ 사람에게 인계

```

까지 정상적으로 동작해도 의미 있는 결과로 본다.

---

# 32. 핵심 원칙

### 1. 구현보다 기준을 먼저 정한다

AI가 무엇을 따라야 하는지 모르는 상태에서 작업을 시작하지 않는다.

### 2. SSOT의 역할을 나눈다

제품 요구사항, 아키텍처, 하네스 정책, 개별 Issue가 각각 무엇의 원본인지 명확하게 한다.

### 3. 기준이 충돌하면 AI가 결정하지 않는다

Issue와 SSOT가 충돌하면 구현을 멈추고 `NEEDS_HUMAN`으로 넘긴다.

### 4. 반복보다 판정을 먼저 만든다

언제 끝나는지 모르는 반복부터 만들지 않는다.

### 5. 종료 조건은 가능한 한 실행 가능하게 만든다

"잘 동작한다"보다 테스트와 숫자로 확인할 수 있는 조건을 사용한다.

### 6. AI의 말을 완료 근거로 사용하지 않는다

`npm run verify`의 실행 결과가 판단한다.

### 7. 기존 기능도 함께 검증한다

새로운 문제를 해결하면서 기존 기능을 깨뜨리지 못하게 한다.

### 8. AI는 심판을 수정할 수 없다

테스트를 통과하지 못했다고 검증 기준 자체를 느슨하게 만들 수 없다.

### 9. 반복에는 상한이 있다

해결하지 못하는 문제를 무한히 붙잡지 않는다.

### 10. 실패해도 제대로 멈춰야 한다

해결하지 못하면 `NEEDS_HUMAN`으로 사람에게 넘긴다.

### 11. 테스트 DB는 매 검증마다 새로 만든다

로컬과 CI가 각각 독립된 테스트 DB를 만들며, 이전 검증에서 사용한 DB를 재사용하지 않는다.

### 12. PR 이후 수정도 무한히 반복하지 않는다

CI, AI Review, 사람의 최종 검토 반려 때문에 구현 단계로 복귀하는 수정 루프에도 상한을 둔다.

구체적인 상한값은 H5 실습 결과를 보고 결정한다.

### 13. CI는 두 번째 심판이 아니다

로컬과 동일한 `npm run verify`를 깨끗한 GitHub 환경에서 다시 실행해 **결과가 재현되는지 확인한다.**

### 14. 마지막 판단은 사람이 한다

기계 검증을 모두 통과했더라도 실제 구현이 Issue의 의도와 다르면 승인하지 않는다.

---

## 최종 요약

```
먼저 SSOT 정책을 정한다.
        ↓
사람이 Issue와 종료 조건을 만든다.
        ↓
AI가 Issue와 관련 SSOT를 확인한다.
        ↓
충돌하면 구현하지 않고 NEEDS_HUMAN으로 넘긴다.
        ↓
문제가 없으면 AI가 구현한다.
        ↓
기존 테스트 DB를 제거하고 새 테스트 DB를 준비한다.
        ↓
npm run verify가 판정한다.
        ↓
실패하면 다시 수정한다.
        ↓
정해진 횟수 안에 해결하지 못하면 사람에게 넘긴다.
        ↓
성공하면 PR을 만든다.
        ↓
GitHub Actions가 새로운 테스트 DB를 만든다.
        ↓
같은 npm run verify를 다시 실행한다.
        ↓
AI가 코드를 Review한다.
        ↓
CI 또는 Review 수정이 필요하면
제한된 횟수만 구현 단계로 돌아간다.
        ↓
상한을 넘으면 NEEDS_HUMAN으로 종료한다.
        ↓
사람이 마지막으로 실제 의도를 확인한다.
        ↓
승인하면 Merge하고 Issue를 종료한다.

```

**AI에게 구현은 맡기되, 완료 판정까지 맡기지는 않는다.**