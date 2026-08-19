/**
 * Architecture Check — 테스트로는 잡히지 않는 구조 규칙을 정적으로 검사한다.
 *
 * 테스트는 "숫자가 맞는가"를 본다. 우회해도 숫자는 맞을 수 있다.
 * 여기서는 "정해진 통로로 지나갔는가"를 본다.
 *
 * 규칙의 근거: docs/06-architecture.md (아키텍처 SSOT)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

type Rule = {
  id: string
  title: string
  why: string
  /** 검사 대상 (경로 접두사). 비우면 src 전체 */
  scope?: string[]
  /** 이 파일들은 규칙의 구현 주체이므로 예외 */
  allow?: string[]
  pattern: RegExp
}

const RULES: Rule[] = [
  {
    id: 'A1',
    title: '재고 수량은 applyMovement()로만 바꾼다',
    why: 'Lot을 직접 고치면 Movement 이력이 남지 않아 총량 검증이 무너진다 (06 §4.1)',
    allow: ['src/lib/stock.ts'],
    pattern: /\blot\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/,
  },
  {
    id: 'A2',
    title: '이력은 applyMovement()로만 남긴다',
    why: '재고 변경과 이력 기록은 같은 트랜잭션에서 함께 일어나야 한다 (06 §4.1)',
    allow: ['src/lib/stock.ts'],
    pattern: /\bmovement\.(create|createMany|update|updateMany|delete|deleteMany)\s*\(/,
  },
  {
    id: 'A3',
    title: '유통기한은 dateOnly()를 통과시킨다',
    why: '시각이 붙으면 같은 날짜가 다른 로트로 갈라진다 (UTC 자정 고정)',
    allow: ['src/lib/date.ts'],
    pattern: /\bexpiryDate\s*[:=]\s*new Date\s*\(/,
  },
  {
    id: 'A4',
    title: 'proxy.ts는 Prisma에 닿지 않는다',
    why: '미들웨어는 Edge에서 돈다. DB 클라이언트를 물면 기동 자체가 깨진다 (HANDOVER §4)',
    scope: ['src/proxy.ts'],
    pattern: /from\s+['"]@\/lib\/(db|auth)['"]/,
  },
]

const ROOT = process.cwd()
const SKIP_DIRS = new Set(['node_modules', '.next', 'generated', '.git'])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(path.relative(ROOT, full))
  }
  return out
}

type Violation = { rule: Rule; file: string; line: number; text: string }

function check(): Violation[] {
  const files = walk(path.join(ROOT, 'src'))
  const found: Violation[] = []

  for (const rule of RULES) {
    const targets = files.filter((f) => {
      if (rule.allow?.includes(f)) return false
      if (rule.scope) return rule.scope.some((s) => f === s || f.startsWith(s + '/'))
      return true
    })

    for (const file of targets) {
      const lines = readFileSync(path.join(ROOT, file), 'utf8').split('\n')
      lines.forEach((text, i) => {
        if (rule.pattern.test(text)) found.push({ rule, file, line: i + 1, text: text.trim() })
      })
    }
  }
  return found
}

const violations = check()

if (violations.length === 0) {
  console.log(`✔ Architecture Check — 규칙 ${RULES.length}개 통과`)
  process.exit(0)
}

console.error(`\n✖ Architecture Check 실패 — 위반 ${violations.length}건\n`)

for (const rule of RULES) {
  const mine = violations.filter((v) => v.rule.id === rule.id)
  if (mine.length === 0) continue
  console.error(`[${rule.id}] ${rule.title}`)
  console.error(`     ${rule.why}`)
  for (const v of mine) console.error(`     ${v.file}:${v.line}  ${v.text}`)
  console.error('')
}

process.exit(1)
