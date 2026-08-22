import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { db } from './helpers'
import { applyMovement } from '@/lib/stock'
import { LOCATION_TYPES, MOVEMENT_TYPES, POPUP_STATUS, REASON_CODES } from '@/lib/constants'
import { addDays, dateOnly, today } from '@/lib/date'

/**
 * 배분 경로 — 각 서버 경로가 '정해진 전략을 실제로 쓰는가'를 본다.
 *
 * tests/fefo.test.ts는 배분 계산 자체가 맞는지 본다(순수 함수).
 * 여기서는 계산이 아니라 **연결**을 본다. 계산이 완벽해도 경로가 반대 전략을
 * 넘기면 재고는 틀리게 빠지고, 그 오류는 순수 함수 테스트로는 잡히지 않는다.
 *
 * 전략의 근거: docs/01-requirements.md F5·F6, docs/06-architecture.md 4.2
 *
 * 실제 서버 액션을 그대로 호출한다. 요청 스코프가 없으면 동작하지 않는
 * auth·cache만 대체하고, DB·배분·Movement는 전부 실제 구현이 돈다.
 */
let userId = 0
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/auth', () => ({
  requireUser: async () => ({ id: userId, name: '테스트', email: 't@test', role: 'ADMIN' }),
  SessionExpiredError: class SessionExpiredError extends Error {},
}))

const { saveOutbound } = await import('@/actions/outbound')
const { shipOutPopup } = await import('@/actions/popup')
const { saveFulfillmentReflection } = await import('@/actions/fulfillment')
const { sendTransfer } = await import('@/actions/transfer')

/**
 * 시드에는 이미 여러 유통기한의 로트가 있다. 그 거점을 그대로 쓰면
 * 시드 로트가 먼저 배분되어 순서가 흔들린다 — 거점을 새로 만들어 격리한다.
 */
const PREFIX = '__배분경로'
const SOON = dateOnly(addDays(today(), 700)) // 임박분
const LATE = dateOnly(addDays(today(), 800)) // 넉넉한 분

/** 임박 90 + 넉넉 100에서 100개를 빼면 두 전략의 결과가 정반대가 된다 */
const SOON_QTY = 90
const LATE_QTY = 100
const TAKE = 100
const FEFO_LEFT = { soon: 0, late: 90 } // 임박분을 다 쓰고 모자란 10개만 넉넉한 쪽에서
const LEFO_LEFT = { soon: 90, late: 0 } // 넉넉한 쪽만 쓰고 임박분은 그대로 남는다

/**
 * 자기가 만든 것만 지운다. 거점만 보고 지우면 부족하다 — 발송은 재고를
 * 시드의 '배송 중' 거점으로 옮기므로, 유통기한 기준으로 함께 지워야
 * Lot 합계와 Movement 합계가 다시 맞는다.
 */
async function cleanup() {
  const mine = { expiryDate: { in: [SOON, LATE] } }

  await db.movement.deleteMany({ where: mine })
  const lines = await db.transferLine.findMany({ where: mine, select: { transferId: true } })
  await db.transfer.deleteMany({ where: { id: { in: lines.map((l) => l.transferId) } } }) // lines는 cascade
  await db.popup.deleteMany({ where: { name: { startsWith: PREFIX } } }) // planLines는 cascade
  await db.lot.deleteMany({ where: mine })
  await db.location.deleteMany({ where: { name: { startsWith: PREFIX } } })
}

/** 테스트 전용 거점 + 두 로트 — 다른 테스트와 로트를 공유하지 않는다 */
async function stocked(type: string, label: string) {
  const location = await db.location.create({ data: { name: `${PREFIX} ${label}`, type } })
  const product = await db.product.findFirstOrThrow({ where: { sku: 'DOG-CHEESE-200' } })

  await db.$transaction(async (tx) => {
    for (const [expiryDate, quantity] of [
      [SOON, SOON_QTY],
      [LATE, LATE_QTY],
    ] as const) {
      await applyMovement(tx, {
        type: MOVEMENT_TYPES.INBOUND,
        reason: REASON_CODES.PURCHASE,
        productId: product.id,
        expiryDate,
        quantity,
        toLocationId: location.id,
        userId,
      })
    }
  })
  return { location, product }
}

async function left(productId: number, locationId: number) {
  const qty = async (expiryDate: Date) =>
    (
      await db.lot.findUnique({
        where: { productId_locationId_expiryDate: { productId, locationId, expiryDate } },
      })
    )?.quantity ?? 0
  return { soon: await qty(SOON), late: await qty(LATE) }
}

describe('배분 경로 — 서버 경로가 정해진 전략을 쓴다', () => {
  beforeAll(async () => {
    userId = (await db.user.findFirstOrThrow()).id
    await cleanup()
  })
  afterAll(async () => {
    await cleanup()
    await db.$disconnect()
  })

  it('일반 출고는 임박한 로트부터 뺀다 (FEFO)', async () => {
    const { location, product } = await stocked(LOCATION_TYPES.OWN, '출고 자사창고')

    const result = await saveOutbound({
      productId: product.id,
      locationId: location.id,
      reason: REASON_CODES.SALE,
      quantity: TAKE,
    })

    expect(result.ok).toBe(true)
    expect(await left(product.id, location.id)).toEqual(FEFO_LEFT)
  })

  it('팝업 반출은 임박한 로트부터 뺀다 (FEFO)', async () => {
    const { location: source, product } = await stocked(LOCATION_TYPES.OWN, '팝업 자사창고')
    const site = await db.location.create({
      data: { name: `${PREFIX} 팝업 현장`, type: LOCATION_TYPES.POPUP },
    })
    const popup = await db.popup.create({
      data: {
        name: `${PREFIX} 팝업`,
        status: POPUP_STATUS.PREP,
        startDate: today(),
        endDate: addDays(today(), 3),
        locationId: site.id,
        sourceLocationId: source.id,
      },
    })

    const result = await shipOutPopup({
      popupId: popup.id,
      lines: [{ productId: product.id, quantity: TAKE }],
    })

    expect(result.ok).toBe(true)
    expect(await left(product.id, source.id)).toEqual(FEFO_LEFT)
    // 반출은 위치 이동이다 — 나간 만큼 팝업 거점에 그대로 있어야 한다
    expect(await left(product.id, site.id)).toEqual({ soon: SOON_QTY, late: TAKE - SOON_QTY })
  })

  it('풀필먼트 일일 반영은 임박한 로트부터 뺀다 (FEFO)', async () => {
    const { location, product } = await stocked(LOCATION_TYPES.FULFILLMENT, '풀필먼트 A')

    const result = await saveFulfillmentReflection({
      locationId: location.id,
      lines: [{ productId: product.id, qty: TAKE }],
    })

    expect(result.ok).toBe(true)
    expect(await left(product.id, location.id)).toEqual(FEFO_LEFT)
  })

  it('풀필먼트 발송은 기한이 넉넉한 로트부터 보낸다 (LEFO)', async () => {
    const { location: source, product } = await stocked(LOCATION_TYPES.OWN, '발송 자사창고')
    const destination = await db.location.create({
      data: { name: `${PREFIX} 풀필먼트 B`, type: LOCATION_TYPES.FULFILLMENT },
    })

    const result = await sendTransfer({
      fromLocationId: source.id,
      toLocationId: destination.id,
      lines: [{ productId: product.id, quantity: TAKE }],
    })

    expect(result.ok).toBe(true)
    // ★ 출고와 정반대다 — 임박분은 자사창고에 남겨 직접 빠르게 소진한다
    expect(await left(product.id, source.id)).toEqual(LEFO_LEFT)
  })
})
