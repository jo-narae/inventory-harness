# 유지보수 하네스 — 진입 규칙

이 저장소는 AI 유지보수 하네스로 운영된다. 규칙 본문은 여기에 적지 않는다. 아래 원본에서 확인한다.

| 알아야 할 것 | 원본 |
| --- | --- |
| 어떤 질문에 어떤 문서를 봐야 하는가 | `docs/harness/00-ssot.md` |
| 하네스 정책 — 검증 구성, 루프 상한, 보호 규칙, PR 게이트 | `docs/08-harness.md` |
| 이번 작업에서 무엇을 바꾸고 무엇이 참이면 완료인가 | 해당 GitHub Issue (`gh issue view <번호>`) |
| 실행되는 검사 규칙 그 자체 | `scripts/verify/` |
| Next.js 사용법 | `node_modules/next/dist/docs/` — 설치된 버전(16.3.1)의 문서 |

완료 판정은 설명이 아니라 `npm run verify`의 실행 결과가 한다.

작업을 시작하기 전에 `docs/harness/00-ssot.md`를 읽는다. 확인 절차와 충돌 처리는 그 문서 3~4절에 있다.
