# 01. 구축 — H0~H5 재구축 청사진

> **원본 범위** — 단계별 목표·착수 조건·읽을 문서·산출물·완료 조건, 산출물이 놓이는 자리
> **보호 문서** — AI는 이 파일을 수정하지 않는다 ([00-ssot.md](00-ssot.md) 5절)

**하네스를 처음부터 짓거나 고칠 때만 읽는다.** 개별 유지보수 작업에서는 이 문서가 필요 없다 — 그때는 [00-ssot.md](00-ssot.md)에서 시작한다.

---

## 0. 이 문서의 역할

**규칙을 적지 않는다.** 규칙의 원본은 `00`·`02`~`05`와 `scripts/verify/`에 있다.

이 문서는 네 가지만 답한다.

```text
지금 어느 단계인가
그 단계에서 무엇을 읽어야 하는가
무엇을 만들어야 하는가
언제 다음 단계로 갈 수 있는가
```

### 재구축의 입력과 출력

```text
입력   docs/**
       설계는 이미 존재한다. 다시 쓰지 않는다.

출력   scripts/verify/**   .github/**   .claude/skills/**   tests/**
       실제로 실행되는 것.
```

H0·H2의 문서·설정 산출물은

- 이미 있으면 → 완료 조건으로 **검증**만 한다
- 없으면 → 이 문서가 가리키는 원본을 근거로 **작성**한다

---

## 1. 두 개의 순서

**구축 순서(H0~H5)와 문서 번호(00~06)는 다르다.**

```text
문서 번호   유지보수 작업이 흐르는 순서로 매겼다
구축 순서   하네스를 짓는 순서다
```

가장 눈에 띄는 차이는 심판과 템플릿이다. 문서에서는 계약(`02`)이 심판(`03`)보다 앞이지만, 구축은 심판(H1)을 템플릿(H2)보다 먼저 만들었다.

> **반복보다 판정을 먼저 만든다.** 언제 끝나는지 모르는 반복부터 만들지 않는다.

AI가 작업을 시작하기 전에 두 가지를 먼저 만든다.

```text
무엇을 기준으로 구현할 것인가     → SSOT 정책   (H0)
무엇을 기준으로 완료를 판정할 것인가 → 검증 체계   (H1)
```

```text
SSOT 정책 → 검증 체계 → Issue 템플릿 → 구현 루프 → PR 게이트 → 실전 검증
   H0          H1           H2            H3          H4          H5
```

> **기준을 먼저 정하고, 그 기준을 지키는지 판정할 심판을 만든 뒤 AI를 투입한다.**

---

## 2. 단계 요약

| 단계 | 목표 | 읽을 문서 | 완료 조건 |
|---|---|---|---|
| H0 | SSOT 정책 수립 | `docs/08-harness.md` | `00-ssot.md`가 다섯 질문에 답한다 |
| H1 | 공통 심판 기반 구축 | `03-verify.md` · `00-ssot.md` 5절 | `main`과 CI에서 `npm run verify` 통과 |
| H2 | Issue 템플릿 | `02-contract.md` | 템플릿이 필수 항목·배치 규칙을 만족한다 |
| H3 | 구현 루프 | `04-loop.md` · `02-contract.md` | 개발용 Issue가 Local Verify PASS 또는 NEEDS_HUMAN으로 종료 |
| H4 | PR 게이트 | `04-loop.md` 4~8절 | PASS한 개발용 Issue가 PR→CI→Review→사람 판단까지 통과 |
| H5 | 실전 검증 | `05-experiment.md` | 측정용 Issue 최소 1건에서 전 흐름 재현 |

---

## 3. 단계별 상세

### H0 — SSOT 정책 수립

```text
착수 조건    없음 (첫 단계)

읽을 것      docs/08-harness.md          하네스의 목적과 사람/AI 경계

만들 것      docs/harness/00-ssot.md     문서

하지 않을 것  모든 정보를 한 문서로 합치는 것.
             정보는 있는 자리에 두고 영역별로 최종 판단 권한만 정한다.

완료 조건    00-ssot.md가 다음 다섯 질문에 답한다
             ① 어떤 질문에 어떤 원본을 보는가
             ② 어디까지 읽는가
             ③ 기준이 서로 다른 말을 하면 어떻게 하는가
             ④ 무엇을 보호하는가, 왜 보호하는가
             ⑤ 기준 자체를 바꿔야 하면 어떻게 하는가

완료 후 변화  docs/harness/** 가 보호 대상이 된다 (06-log.md 제외)
```

현재 프로젝트에는 역할이 다른 여러 문서가 존재한다. 모든 정보를 하나로 합치기보다 **영역별로 어떤 문서가 기준인지 명확하게 정의한다.** 다섯 질문의 답은 `00-ssot.md` 자신이 원본이다.

---

### H1 — 공통 심판 기반 구축

```text
착수 조건    H0 완료 · docs/harness/00-ssot.md 존재

읽을 것      03-verify.md        심판이 무엇을 판정하는가 · 왜 하나의 명령인가
             00-ssot.md 5절      무엇을 왜 보호하는가
             docs/06-architecture.md   Architecture Check가 검사할 불변식의 근거

만들 것      package.json                       verify 스크립트          설정
             scripts/verify/arch.ts             Architecture Check      코드
             scripts/verify/protected.ts        보호 경로 검사           코드
             scripts/verify/reset-db.ts         테스트 DB 초기화         코드
             .github/workflows/verify.yml       CI                     설정

             테스트용 DATABASE_URL 설정
             Prisma 준비 · Schema/Migration 적용 · 테스트 데이터 준비 과정
             Local과 CI에서 동일하게 DB를 준비하는 방법

하지 않을 것  Issue별 종료 조건 테스트.
             아직 대상 Issue가 없다. H3 이후 실제 Issue에서 추가한다.

완료 조건    main에서 npm run verify 통과
             같은 명령이 CI 새 환경에서 통과

완료 후 변화  scripts/verify/** · .github/workflows/** 가 보호 대상이 된다
```

목표는 모든 Issue에 공통으로 적용되는 검증 기반을 먼저 만들고, 이후 Issue별 종료 조건 테스트가 같은 `npm run verify`에 자연스럽게 누적될 수 있게 하는 것이다.

```text
H1  → 공통 검증 기반 구축
H2  → Issue 종료 조건 작성 규칙 확정
H3~ → 기계화 가능한 종료 조건을 테스트로 추가 → npm run verify에 자동 포함
```

---

### H2 — Issue 템플릿

```text
착수 조건    H1 완료

읽을 것      02-contract.md      필수 항목 · 판정 가능성 · 작성 지침 배치 · 명명 규칙

만들 것      .github/ISSUE_TEMPLATE/maintenance.yml    설정

하지 않을 것  Issue별 종료 조건 테스트.
             여기서는 작성 규칙만 확정한다.

완료 조건    템플릿이 02-contract.md 4절의 필수 6항목을 모두 받는다
             작성 지침이 02-contract.md 6절의 배치 3규칙을 만족한다
             (항상 보임 · 본문 미포함 · 프리필과 흐린 예시 공존 금지)
```

빈 서식을 만드는 단계다. 계약은 실제 Issue를 열 때 성립한다 ([02-contract.md](02-contract.md) 0절).

---

### H3 — Harness Loop

```text
착수 조건    H2 완료
             + 개발용 Issue 1건이 열려 있어야 한다
               루프를 돌려볼 대상이 없으면 만든 것을 실행해 확인할 수 없다.
               측정용 Issue는 사용하지 않는다 (05-experiment.md 1절)

읽을 것      04-loop.md 1~3절    시작점 · 종료 조건 처리 · 구현 루프와 상한
             02-contract.md 2절  판정 가능성 검사의 기준
             00-ssot.md 3~4절    작업 전 확인 절차 · 충돌 처리

만들 것      .claude/skills/harness-loop/    스킬

하지 않을 것  PR 생성 · CI · Review. 그것은 H4다.
             개발용 Issue를 Merge하지 않는다.

완료 조건    개발용 Issue 1건이 루프를 통과해
             Local Verify PASS 또는 NEEDS_HUMAN으로 종료된다

완료 후 변화  PASS와 NEEDS_HUMAN은 둘 다 H3의 정상 종료다.
             SSOT 충돌처럼 NEEDS_HUMAN이 올바른 결과인 경우도 있다.
             다만 H4는 PR 이후 경로를 확인해야 하므로
             Local Verify PASS한 개발용 Issue가 따로 필요하다 (H4 착수 조건).
```

이번 하네스에서 가장 중요한 자동 반복 구간이다. 루프가 수행할 순서는 다음과 같다.

```text
[사람] 처리할 Issue 번호 전달
→ gh CLI로 해당 Issue 조회
→ 관련 SSOT 확인
→ Issue와 SSOT 충돌 검사
→ 종료 조건 확인
→ 판정 가능성 검사
→ 기계 판정 가능한 종료 조건을 Issue별 테스트로 추가
→ 계획
→ 브랜치 생성
→ 구현
→ verify
→ 실패 분석
→ 재시도
→ SUCCESS 또는 NEEDS_HUMAN
```

각 단계의 규칙은 [04-loop.md](04-loop.md)가 원본이다.

---

### H4 — Harness Ship

```text
착수 조건    H3 완료
             + Local Verify PASS한 개발용 Issue 1건

               H3의 Issue가 PASS로 끝났다면 그 Issue를 그대로 이어받는다.
               새 Issue를 열지 않는다.

               H3의 Issue가 NEEDS_HUMAN으로 끝났다면 — 그것이 올바른 종료였더라도
               PR 이후 경로를 확인할 대상이 없다. 별도의 개발용 Issue로
               PASS 경로를 확보한 뒤 착수한다.
               측정용 Issue는 사용하지 않는다 (05-experiment.md 1절).

읽을 것      04-loop.md 4~8절    PR 생성 · CI 복귀 · AI Review · 사람 게이트 · 최종 상태
             03-verify.md 3절    CI가 왜 같은 명령을 다시 도는가

만들 것      .claude/skills/harness-ship/    스킬
             .github/workflows/verify.yml    H1 산출물을 PR 트리거로 연결
             GitHub branch protection        설정

하지 않을 것  PR 이후 수정 루프의 상한값을 정하는 것.
             값은 H5 관찰 결과로 정한다. 미정 상태로 진행한다.

완료 조건    PASS한 개발용 Issue의 PR이
             CI 재검증 → AI Review → 사람 판단까지 한 번 통과한다
             사람이 승인한 경우에만 Merge한다

완료 후 변화  개발용 Issue의 종료 조건 테스트는 회귀 테스트로 남는다
             단, H5 집계에서는 제외한다 (05-experiment.md 1절)
```

CI는 로컬 DB를 가져다 사용하는 것이 아니다. **CI 실행 시 자신의 테스트 DB를 새로 만들고 같은 검증을 실행한다.**

---

### H5 — 실제 유지보수 이슈

```text
착수 조건    H4 완료
             + 하네스 개발에 사용하지 않은 측정용 Issue 확보

읽을 것      05-experiment.md    개발용/측정용 구분 · 측정 후보 · 로그 항목 · 관찰 항목 · 성공 기준

만들 것      docs/harness/06-log.md    실험 기록    문서 · AI 수정 허용
             tests/issues/issue-{번호}-{기능명}.test.ts

하지 않을 것  개발용 Issue를 집계에 포함하는 것

완료 조건    측정용 Issue 최소 1건에서 05-experiment.md 5절의 흐름을 끝까지 재현
             또는 상한 도달 후 NEEDS_HUMAN으로 정상 종료
             + 실험 로그 기록

완료 후 변화  04-loop.md 5절의 PR 이후 수정 루프 상한값을 관찰 결과로 결정할 수 있다
```

---

## 4. 산출물이 놓이는 자리

H0~H5에서 만드는 것 중 **문서는 두 개뿐**이고, 나머지는 실제로 실행되는 코드·설정이다.

| 단계 | 산출물 | 위치 | 성격 |
|---|---|---|---|
| H0 | SSOT 정책 | `docs/harness/00-ssot.md` | 문서 |
| H1 | verify 명령 | `package.json` | 설정 |
| H1 | Architecture Check | `scripts/verify/arch.ts` | 코드 |
| H1 | 보호 경로 검사 | `scripts/verify/protected.ts` | 코드 |
| H1 | 테스트 DB 초기화 | `scripts/verify/reset-db.ts` | 코드 |
| H1 | CI | `.github/workflows/verify.yml` | 설정 |
| H2 | Issue 템플릿 | `.github/ISSUE_TEMPLATE/maintenance.yml` | 설정 |
| H3~ | Issue별 종료 조건 테스트 | `tests/issues/issue-{번호}-{기능명}.test.ts` | 코드 · Merge 후 회귀 테스트로 유지 |
| H3 | 구현 루프 | `.claude/skills/harness-loop/` | 스킬 |
| H4 | PR 게이트 | `.claude/skills/harness-ship/` | 스킬 |
| H5 | 실험 로그 | `docs/harness/06-log.md` | 문서 · 수정 허용 |

> **무엇이 보호 대상인지는 이 표가 아니라 `scripts/verify/protected.ts`가 판정한다.**

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
├── 08-harness.md        ┘  ← 하네스의 배경과 원칙
├── HANDOVER.md
└── harness/                 ← 하네스 운영물
    ├── 00-ssot.md           기준 · 라우터
    ├── 01-build.md          구축 청사진 · 이 문서
    ├── 02-contract.md       계약 규칙
    ├── 03-verify.md         심판 정책
    ├── 04-loop.md           루프 · 상태
    ├── 05-experiment.md     측정 설계
    └── 06-log.md            실험 기록 · AI 수정 허용
```

번호 체계를 섞지 않는다.

```text
docs/ 루트의 번호   → 기획 Phase 순서 (01~08에서 끝)
harness/ 안의 번호  → 유지보수 작업이 흐르는 순서 (00부터 새로 시작)
```

하네스 운영물을 `docs/` 루트에 번호로 밀어 넣으면 `00`은 "가장 먼저 읽을 것"인데 **실제로는 Phase 8에서 만들어지고**, `09`는 Phase 산출물이 아니라 실행 기록인데 아홉 번째 기획 문서처럼 보인다. 번호 하나가 세 가지를 뜻하게 되므로 디렉터리로 가른다.

### 왜 단계마다 문서를 만들지 않는가

H1의 검사 규칙을 별도 문서로 또 적으면 같은 규칙이 두 곳에 존재하게 된다. 문서와 `arch.ts`가 어긋나는 순간 **어느 쪽이 기준인지 다시 정해야 한다.**

```text
문서에 적힌 규칙
      ↓
실제로 검사되는 규칙
```

따라서 H1~H4가 만드는 것 중 **검사 구성·경로·판정 방법 같은 실행 세부는 코드·설정이 원본**이고, 문서는 그 코드가 왜 그렇게 생겼는지를 설명한다. 반대로 하네스의 정책과 판단 기준은 `docs/harness/`의 해당 책임 문서가 원본이다 ([00-ssot.md](00-ssot.md) 1절).

```text
"무엇을 판정하고 언제 멈추나"  → docs/harness/02~05
"그 판정을 어떻게 실행하나"    → package.json · scripts/verify/ · .github/
"어떤 질문에 어디를 보나"      → docs/harness/00-ssot.md
"어떤 순서로 짓나"            → 이 문서
```

문서를 줄이는 것이 목적이 아니라 **같은 실행 규칙이 두 벌 생기지 않게 하는 것**이 목적이다.

---

## 5. 재구축 점검표

```text
H0  □ docs/harness/00-ssot.md 가 다섯 질문에 답한다
H1  □ main에서 npm run verify 통과
    □ CI 새 환경에서 npm run verify 통과
H2  □ 템플릿이 필수 6항목을 받는다
    □ 작성 지침이 배치 3규칙을 만족한다
H3  □ 개발용 Issue 1건이 Local Verify PASS 또는 NEEDS_HUMAN으로 종료
H4  □ PASS한 개발용 Issue가 PR → CI → AI Review → 사람 판단까지 통과
    □ 승인된 경우에만 Merge
H5  □ 측정용 Issue 최소 1건에서 전 흐름 재현 또는 NEEDS_HUMAN 정상 종료
    □ docs/harness/06-log.md 에 기록
```

---

## 6. 이 문서를 고쳐야 할 때

아래가 달라지면 사람이 이 문서를 갱신한다.

- 단계가 늘거나 줄었을 때
- 산출물의 위치가 바뀌었을 때
- 착수 조건이나 완료 조건이 바뀌었을 때
- 문서 배치가 바뀌었을 때

**규칙의 내용이 바뀐 경우에는 이 문서가 아니라 해당 책임 문서를 고친다.** 여기에는 규칙을 적지 않으므로, 이 문서만 고쳐서 규칙이 바뀌는 일은 없어야 한다.
