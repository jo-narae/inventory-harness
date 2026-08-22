import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../helpers'
import { applyMovement } from '@/lib/stock'
import { getProductDetail } from '@/lib/inventory'
import { LOCATION_TYPES, MOVEMENT_TYPES, REASON_CODES } from '@/lib/constants'
import { addDays, dateOnly, today } from '@/lib/date'

/**
 * Issue #2 — 상품 상세의 '총 재고'와 '현재 출고 가능 재고'
 *
 * 여러 거점의 재고를 모두 더한 값은 지금 뺄 수 있는 양이 아니다.
 * 풀필먼트에 있는 재고는 남이 세는 곳에 있어 지금 이쪽 출고에 쓸 수 없다.
 * 두 숫자가 실제로 갈라지는지를 화면이 읽는 함수에서 확인한다.
 *
 * 화면(src/app/products/[id]/page.tsx)은 이 함수가 준 total·shippable을
 * 그대로 '총 재고'·'현재 출고 가능'으로 출력한다.
 */
const PREFIX = '__가용표시'
const SKU = '__ISSUE2-AVAIL'
const EXPIRY = dateOnly(addDays(today(), 600))

const OWN_QTY = 146
const FULFILLMENT_QTY = 44
const EXTRA_FULFILLMENT_QTY = 30

let productId = 0

async function cleanup() {
  const product = await db.product.findUnique({ where: { sku: SKU } })
  if (product) {
    await db.movement.deleteMany({ where: { productId: product.id } })
    await db.lot.deleteMany({ where: { productId: product.id } })
    await db.product.delete({ where: { id: product.id } })
  }
  await db.location.deleteMany({ where: { name: { startsWith: PREFIX } } })
}

describe('Issue #2 — 총 재고와 현재 출고 가능 재고를 구분한다', () => {
  beforeAll(async () => {
    await cleanup()

    const userId = (await db.user.findFirstOrThrow()).id
    const product = await db.product.create({ data: { sku: SKU, name: '__가용표시 상품' } })
    productId = product.id

    // 시드 거점을 쓰면 다른 상품의 로트가 섞인다 — 이 테스트 전용 거점을 만든다
    const own = await db.location.create({
      data: { name: `${PREFIX} 자사창고`, type: LOCATION_TYPES.OWN },
    })
    const fulfillment = await db.location.create({
      data: { name: `${PREFIX} 풀필먼트`, type: LOCATION_TYPES.FULFILLMENT },
    })

    await db.$transaction(async (tx) => {
      for (const [locationId, quantity] of [
        [own.id, OWN_QTY],
        [fulfillment.id, FULFILLMENT_QTY],
      ] as const) {
        await applyMovement(tx, {
          type: MOVEMENT_TYPES.INBOUND,
          reason: REASON_CODES.PURCHASE,
          productId: product.id,
          expiryDate: EXPIRY,
          quantity,
          toLocationId: locationId,
          userId,
        })
      }
    })
  })

  afterAll(async () => {
    await cleanup()
    await db.$disconnect()
  })

  it('총 재고는 모든 거점의 합계다 — 자사창고 146 + 풀필먼트 44 = 190', async () => {
    const detail = await getProductDetail(productId)
    expect(detail?.total).toBe(OWN_QTY + FULFILLMENT_QTY)
  })

  it('현재 출고 가능 재고는 지금 뺄 수 있는 146이다', async () => {
    const detail = await getProductDetail(productId)
    expect(detail?.shippable).toBe(OWN_QTY)
  })

  it('풀필먼트 재고는 현재 출고 가능 재고에 들어가지 않는다', async () => {
    const before = await getProductDetail(productId)

    const userId = (await db.user.findFirstOrThrow()).id
    const fulfillment = await db.location.findFirstOrThrow({
      where: { name: `${PREFIX} 풀필먼트` },
    })
    await db.$transaction(async (tx) => {
      await applyMovement(tx, {
        type: MOVEMENT_TYPES.INBOUND,
        reason: REASON_CODES.PURCHASE,
        productId,
        expiryDate: EXPIRY,
        quantity: EXTRA_FULFILLMENT_QTY,
        toLocationId: fulfillment.id,
        userId,
      })
    })

    const after = await getProductDetail(productId)
    // 풀필먼트만 늘렸다 — 총 재고는 따라 오르지만 출고 가능은 그대로여야 한다
    expect(after?.total).toBe((before?.total ?? 0) + EXTRA_FULFILLMENT_QTY)
    expect(after?.shippable).toBe(OWN_QTY)
  })
})
