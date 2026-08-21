# 03. 심판 — `npm run verify`

> **원본 범위** — 무엇이 완료를 판정하는가, Issue별 종료 조건의 누적, 로컬과 CI의 관계, 테스트 DB 격리, 정적 검사와 보호 경로 검사의 존재 이유
> **보호 문서** — AI는 이 파일을 수정하지 않는다 ([00-ssot.md](00-ssot.md) 5절)

| 이 문서가 답하는 것 | |
| --- | --- |
| 무엇이 완료를 판정하는가 | 1절 |
| Issue별 조건은 어디로 가는가 | 2절 |
| CI는 왜 같은 것을 또 도는가 | 3절 |
| 어떤 규칙이 검사되는가 | 4절 |
| 테스트 DB는 왜 매번 새로 만드는가 | 5절 |
| 심판 자신은 누가 지키는가 | 6절 |

> **검사 규칙의 실제 내용은 이 문서가 아니라 코드에 있다.**
> `package.json`(verify 구성) · `scripts/verify/`(규칙 자체) · `.github/workflows/verify.yml`(CI 절차)
> 이 문서는 그 코드가 왜 그렇게 생겼는지를 적는다.

---

## 1. 공통 심판

AI가 스스로 작업 완료 여부를 결정하지 못하도록 공통 검증 명령을 둔다.

```text
npm run verify
```

이 명령을 **이번 하네스의 공통 심판**으로 사용한다.

하나라도 실패하면 `verify` 전체가 실패한다. 따라서 AI가

> "핵심 기능은 완성됐습니다."

라고 설명하더라도 `npm run verify`가 실패하면 작업은 아직 끝난 것이 아니다.

> **완료 여부는 AI의 설명이 아니라 실행 가능한 검증 결과가 판단한다.**

### verify가 포함해야 하는 판정 영역

```text
보호 경로 검사    심판과 기준이 바뀌지 않았는가          6절
타입 검사
Lint
정적 규칙 검사    Architecture Check                4.2
도메인 테스트     불변식 + 누적된 Issue별 종료 조건       2절 · 4.1
                (매번 새로 만든 테스트 DB에서)          5절
빌드
```

**실제 단계 순서·명령·플래그·준비 과정은 `package.json`의 `verify` 스크립트가 원본이다.** 여기에 명령 목록을 다시 적지 않는다. 목록을 두 벌 두면 어느 쪽이 기준인지 다시 정해야 한다.

이 목록은 "무엇을 판정해야 하는가"이고, `package.json`은 "어떻게 실행하는가"다. 판정 영역이 늘거나 줄 때만 이 목록을 고친다.

---

## 2. Issue별 종료 조건도 `verify`에 편입한다

H1에서 모든 미래 Issue의 심판을 미리 만들 수는 없다.

H1에서는 Type Check, Lint, Architecture Check, 기존 Domain Test, Build처럼 **모든 Issue에 공통으로 적용할 검증 기반**을 만든다.

이후 실제 Issue가 들어오면 기계적으로 판정 가능한 종료 조건을 테스트로 추가한다.

```text
Issue #23 — 만료 재고 폐기
        ↓
tests/issues/issue-23-dispose.test.ts

Issue #24 — Movement 취소
        ↓
tests/issues/issue-24-reverse-movement.test.ts
```

파일명 규칙과 기능명을 정하는 주체는 [02-contract.md](02-contract.md) 5절에 있다.

Issue가 Merge된 뒤에도 해당 테스트는 삭제하지 않는다.

```text
Issue #23 Merge
↓
issue-23-dispose.test.ts 유지

Issue #24 작업
↓
기존 issue-23-dispose.test.ts
+
신규 issue-24-reverse-movement.test.ts
↓
둘 다 npm run verify에서 실행
```

즉 `npm run verify`는 시간이 지날수록 다음을 함께 판정한다.

```text
공통 규칙
+
기존 기능
+
과거 Issue에서 추가된 종료 조건
+
현재 Issue에서 추가된 종료 조건
```

별도의 `npm run verify:issue` 명령은 두지 않는다.

**Issue별 검증을 기존 테스트 스위트에 누적해 `npm run verify` 하나로 로컬과 CI가 동일한 전체 판정을 실행하도록 한다.** CI 역시 별도의 Issue 검증 명령을 갖지 않는다.

이 테스트는 해당 Issue만을 위한 일회성 검사가 아니라 Merge 후에도 남는 회귀 테스트다.

---

## 3. 로컬과 CI는 같은 심판을 사용한다

`npm run verify`는 두 곳에서 실행한다.

```text
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

Issue별 종료 조건 테스트까지 포함해 **AI가 작업한 로컬 환경에서 통과한 전체 판정이 깨끗한 GitHub 환경에서도 동일하게 재현되는지 확인하기 위한 것이다.**

따라서 로컬과 CI가 사용하는 심판은 같고, 실행 환경은 서로 독립적이다. 정상적으로 구성되어 있다면 로컬에서 통과한 결과는 CI에서도 그대로 통과해야 한다.

### CI에서 실패하면 확인할 것

```text
커밋되지 않은 파일에 의존했는가?
환경변수가 빠졌는가?
테스트 DB 초기화 과정이 빠졌는가?
Migration 적용에 문제가 있는가?
테스트 데이터 준비가 빠졌는가?
Node/npm 환경 차이가 있는가?
파일명 대소문자 문제가 있는가?
```

CI가 실패하는 것은 그 자체로 문제가 아니라,

> **"현재 검증 과정이 깨끗한 환경에서는 재현되지 않는다."**

라는 문제를 발견한 것이다.

CI 실패 이후의 처리 절차는 [04-loop.md](04-loop.md) 5절에 있다.

---

## 4. 무엇을 검사하는가

### 4.1 재고관리 PoC의 불변식

재고관리 PoC를 실습 대상으로 선택한 이유는 결과를 비교적 명확하게 검증할 수 있기 때문이다.

| 규칙 | 검증 |
| --- | --- |
| 내부 이동으로 전체 재고량은 변하지 않는다 | 이동 전후 `totalStock()` 비교 |
| 모든 재고 수량 변경은 `applyMovement()`를 통한다 | Architecture Check |
| 출고는 FEFO를 따른다 | 테스트 |
| 발송은 LEFO를 따른다 | 테스트 |
| 취소는 기존 원장을 삭제하지 않는다 | 테스트 |
| 취소 시 반대 Movement를 만든다 | 테스트 |
| 같은 Movement는 두 번 취소할 수 없다 | 테스트 |
| 유통기한은 공통 날짜 처리 함수를 사용한다 | Architecture Check |

중요한 규칙은 문서에만 적어두지 않고 가능한 한 **실행 가능한 검사로 만든다.** 규칙 자체의 원본은 `docs/06-architecture.md`이고, 검사의 원본은 `scripts/verify/arch.ts`다.

### 4.2 Architecture Check

테스트만으로 확인하기 어려운 구조적 규칙은 별도의 정적 검사로 만든다.

```text
문서에 적힌 규칙
        ↓
실제로 검사되는 규칙
```

**검사하는 규칙의 목록은 `scripts/verify/arch.ts`가 원본이다.** 여기에 규칙을 다시 적지 않는다.

---

## 5. 테스트 DB 격리

하네스는 같은 테스트를 여러 번 실행한다. 개발 DB를 그대로 사용하면 반복 과정에서 데이터가 오염되거나, 이전 실행 상태 때문에 우연히 테스트가 통과할 수 있다.

따라서 테스트 전용 DB를 사용한다. 중요한 점은 **DB 파일 자체를 로컬과 CI가 공유하는 것이 아니라는 것**이다.

```text
Local                          CI
기존 테스트 DB 제거              (환경이 매번 새로 시작)
↓                              ↓
새 테스트 DB 생성                새 테스트 DB 생성
↓                              ↓
Schema / Migration 적용         Schema / Migration 적용
↓                              ↓
필요한 테스트 데이터 준비          필요한 테스트 데이터 준비
↓                              ↓
npm run verify                 npm run verify
```

둘은 이름만 같을 뿐 서로 다른 파일이다.

> **같은 방법으로 독립된 테스트 DB를 만들어 사용한다.**

테스트 DB 파일은 Git에 포함하지 않는다. 실제 구축 산출물은 DB 파일이 아니라 다음과 같다.

```text
테스트용 DATABASE_URL 설정
테스트 DB 초기화 스크립트
Prisma 준비 스크립트
Schema / Migration 적용 과정
필요한 테스트 데이터 준비 과정
Local과 CI에서 동일하게 DB를 준비하는 방법
```

핵심 원칙은 다음과 같다.

```text
verify 1회 → 새 테스트 DB
verify 2회 → 이전 DB 재사용 금지 → 다시 새 테스트 DB
verify 3회 → 다시 새 테스트 DB
```

검증이 반복될수록 데이터가 쌓이는 구조가 아니라, **매번 같은 출발점에서 다시 판정하는 구조**로 만든다.

### CI에서 테스트 DB를 준비하는 이유

GitHub Actions는 실행할 때마다 새로운 환경에서 시작한다. 따라서 로컬의 테스트 DB 파일은 CI에 존재하지 않고, CI에서는 검증 전에 테스트 DB를 직접 준비해야 한다.

이 구조의 장점은 로컬 환경에 숨어 있는 의존성을 발견할 수 있다는 것이다. 로컬에서는 오래 사용한 테스트 DB에 필요한 데이터가 이미 존재해 우연히 통과할 수 있지만, CI는 매번 깨끗한 상태에서 시작하므로 준비 과정이 빠져 있다면 실패한다.

**구체적인 준비 절차는 `scripts/verify/reset-db.ts`와 `.github/workflows/verify.yml`이 원본이다.**

---

## 6. 심판 자신을 지키는 검사

테스트가 실패했을 때 AI가 구현 코드를 고치는 대신 **테스트 자체를 느슨하게 만들어버릴 수도 있다.**

```text
테스트 실패
   ↓
정상
→ 구현 코드 수정

문제
→ 테스트 삭제
→ expect 완화
→ Architecture Check 예외 추가
```

무엇을 왜 보호하는지는 [00-ssot.md](00-ssot.md) 5절에 있다. 여기서는 **어떻게 판정하는지**만 적는다.

AI에게 "보호된 파일을 수정하지 마"라고 지시하는 것만으로는 충분하지 않다. 실제로 수정했는지 Git 변경 내역을 이용해 확인한다.

```text
Git 변경 파일 확인
        ↓
보호 경로와 비교
        ↓
보호 파일 변경 발견
        ↓
verify FAIL
```

```text
Event: PROTECTED_PATH_CHANGE
Target: tests/stock-invariant.test.ts
Result: BLOCKED
```

즉 보호 규칙 역시 AI의 자기신고가 아니라 **실제 변경 내역으로 판단한다.**

**보호 경로 목록과 판정 기준선은 `scripts/verify/protected.ts`가 원본이다.** 문서에 목록을 다시 적지 않는다.
