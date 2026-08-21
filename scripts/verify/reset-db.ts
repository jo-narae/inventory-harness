/**
 * 테스트 DB 초기화 — 검증할 때마다 같은 출발점에서 다시 채점한다.
 *
 * 개발용 dev.db를 그대로 쓰면 이전 실행에 남은 데이터 때문에
 * 우연히 통과할 수 있다. 그래서 verify는 전용 DB를 매번 새로 만든다.
 *
 * 로컬과 CI는 같은 파일을 공유하지 않는다.
 * 같은 '방법'으로 각자 독립된 DB를 만들 뿐이다 (docs/harness/03-verify.md 5절).
 */
import { existsSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const DB_URL = process.env.HARNESS_DATABASE_URL ?? 'file:./prisma/harness.db'
const ROOT = process.cwd()
const dbPath = path.resolve(ROOT, DB_URL.replace(/^file:/, ''))

const env = { ...process.env, DATABASE_URL: DB_URL }
const run = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { stdio: 'inherit', env, cwd: ROOT })

// 1) 이전 검증에서 남은 DB는 재사용하지 않는다 (WAL 부산물까지 함께 지운다)
let removed = 0
for (const suffix of ['', '-journal', '-wal', '-shm']) {
  const f = dbPath + suffix
  if (existsSync(f)) {
    rmSync(f)
    removed++
  }
}
console.log(removed > 0 ? `▸ 기존 테스트 DB 제거 (${removed}개 파일)` : '▸ 기존 테스트 DB 없음')

// 2) Prisma 클라이언트 — 생성물은 커밋하지 않으므로 CI에는 항상 없다
if (!existsSync(path.join(ROOT, 'src/generated/prisma/client.ts'))) {
  console.log('▸ Prisma 클라이언트 생성')
  run('npx', ['prisma', 'generate'])
}

// 3) 스키마 적용
console.log(`▸ 새 테스트 DB 생성 — ${DB_URL}`)
run('npx', ['prisma', 'migrate', 'deploy'])

// 4) 테스트 데이터 준비
//    기존 테스트가 시드의 거점·상품·계정을 전제로 하므로 시드까지 돌린다.
//    시드는 앱과 같은 함수(applyMovement/allocateLots)를 쓰므로 규칙을 어길 수 없다.
console.log('▸ 테스트 데이터 준비')
run('npx', ['tsx', 'prisma/seed.ts'])

console.log('✔ 테스트 DB 준비 완료\n')
