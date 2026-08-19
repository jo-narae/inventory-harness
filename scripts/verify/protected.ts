/**
 * 보호 경로 검사 — AI가 심판과 기준을 고치지 못하게 막는다.
 *
 * "고치지 마"라는 지시만으로는 부족하다. 실제 Git 변경 내역으로 판정한다.
 * (docs/08-harness.md §14~15, docs/harness/00-ssot.md §5)
 *
 * 판정 기준선은 main이다. main 자체에서는 검사하지 않는다 —
 * 기준을 세우는 것은 사람의 일이고, 그 작업은 main에서 일어난다.
 */
import { execFileSync } from 'node:child_process'

const git = (args: string[]) =>
  execFileSync('git', args, { encoding: 'utf8' }).trim()

const branch = process.env.HARNESS_BRANCH ?? git(['rev-parse', '--abbrev-ref', 'HEAD'])

if (branch === 'main' || branch === 'HEAD') {
  console.log('✔ 보호 경로 검사 — main에서는 검사하지 않는다 (사람이 기준을 세우는 자리)')
  process.exit(0)
}

// ───────── 보호 대상
const PROTECTED = [
  { pattern: /^docs\/01-requirements\.md$/,   why: '제품 요구사항 SSOT' },
  { pattern: /^docs\/06-architecture\.md$/,   why: '아키텍처 SSOT' },
  { pattern: /^docs\/08-harness\.md$/,        why: '하네스 정책 SSOT' },
  { pattern: /^docs\/harness\/00-ssot\.md$/,  why: 'SSOT 정책' },
  { pattern: /^scripts\/verify\//,            why: '심판 자신' },
  { pattern: /^\.github\/workflows\//,        why: 'CI 정의' },
  { pattern: /invariant.*\.test\.ts$/,        why: '불변식 테스트' },
]

/**
 * 현재 작업 중인 Issue 번호 — 브랜치명에서 읽는다.
 *   23-expiry-dispose / issue-23-dispose / feat/issue-23-x  →  23
 */
function currentIssue(): number | null {
  const m = branch.match(/(?:^|\/)(?:issue-)?(\d+)(?:-|$)/)
  return m ? Number(m[1]) : null
}
const issueNo = currentIssue()

// ───────── 변경 내역 수집 (커밋된 것 · 스테이지 · 작업트리 · 미추적)
type Change = { status: string; file: string }

function parseNameStatus(raw: string): Change[] {
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split('\t')
      return { status: status[0], file: rest[rest.length - 1] }
    })
}

const base = process.env.HARNESS_DIFF_BASE ?? 'main'
let mergeBase = base
try {
  mergeBase = git(['merge-base', base, 'HEAD'])
} catch {
  console.error(`✖ 기준 브랜치를 찾을 수 없습니다: ${base}`)
  process.exit(1)
}

const changes: Change[] = [
  ...parseNameStatus(git(['diff', '--name-status', mergeBase, 'HEAD'])),
  ...parseNameStatus(git(['diff', '--name-status', '--cached'])),
  ...parseNameStatus(git(['diff', '--name-status'])),
  ...git(['ls-files', '--others', '--exclude-standard'])
    .split('\n')
    .filter(Boolean)
    .map((file) => ({ status: 'A', file })),
]

// 같은 파일이 여러 목록에 나오면 한 번만 본다
const seen = new Map<string, Change>()
for (const c of changes) if (!seen.has(c.file)) seen.set(c.file, c)

// ───────── 판정
type Block = { file: string; why: string }
const blocked: Block[] = []

for (const { status, file } of seen.values()) {
  // 1) 보호 목록
  const hit = PROTECTED.find((p) => p.pattern.test(file))
  if (hit) {
    blocked.push({ file, why: hit.why })
    continue
  }

  // 2) 기존 migration은 고칠 수 없다. 새로 추가하는 것은 허용한다
  if (/^prisma\/migrations\//.test(file) && status !== 'A') {
    blocked.push({ file, why: '기존 migration (추가는 허용, 수정·삭제는 금지)' })
    continue
  }

  // 3) Issue별 테스트 — 내 Issue 것만 쓸 수 있다.
  //    과거 Issue의 종료 조건을 느슨하게 만들면 회귀 방지가 무너진다.
  const m = file.match(/^tests\/issues\/issue-(\d+)-/)
  if (m && issueNo !== null && Number(m[1]) !== issueNo) {
    blocked.push({ file, why: `Issue #${m[1]}의 종료 조건 테스트 (현재 작업: #${issueNo})` })
  }
}

if (blocked.length === 0) {
  console.log(`✔ 보호 경로 검사 — 위반 없음 (기준: ${base}${issueNo ? `, Issue #${issueNo}` : ''})`)
  process.exit(0)
}

console.error(`\n✖ 보호 경로 변경 감지 — ${blocked.length}건\n`)
console.error('  Event : PROTECTED_PATH_CHANGE')
console.error('  Result: BLOCKED\n')
for (const b of blocked) console.error(`  ${b.file}\n      ${b.why}`)
console.error('\n기준과 심판은 코드로 바꾸지 않는다. 변경이 필요하면 NEEDS_HUMAN으로 넘긴다.\n')
process.exit(1)
