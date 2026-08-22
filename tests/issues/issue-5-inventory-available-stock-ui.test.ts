import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db } from '../helpers'
import { applyMovement } from '@/lib/stock'
import { getProductDetail } from '@/lib/inventory'
import { LOCATION_TYPES, MOVEMENT_TYPES, REASON_CODES } from '@/lib/constants'
import { addDays, dateOnly, today } from '@/lib/date'

/**
 * Issue #5 — 상품 상세의 '가용 재고'
 *
 * '현재 출고 가능'은 지금 이 자리에서 뺄 수 있는 양이고(자사창고),
 * '가용 재고'는 운영이 굴릴 수 있는 양이다(자사창고 + 풀필먼트).
 * 팝업은 오프라인 판매라 언제 얼마가 빠질지 즉시 알 수 없어 가용에서 뺀다.
 *
 * 화면(src/app/products/[id]/page.tsx)은 이 함수가 준 shippable·available·total을
 * 그대로 '현재 출고 가능'·'가용 재고'·'총 재고'로 출력하고,
 * 팝업 수량은 excluded('가용에서 제외')에서 따로 읽는다.
 */
const PREFIX = '__가용재고'
const SKU = '__ISSUE5-AVAILABLE'
const EXPIRY = dateOnly(addDays(today(), 600))

const OWN_QTY = 156
const FULFILLMENT_QTY = 44
const POPUP_QTY = 130

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

describe('Issue #5 — 가용 재고는 자사창고 + 풀필먼트다', () => {
  beforeAll(async () => {
    await cleanup()

    const userId = (await db.user.findFirstOrThrow()).id
    const product = await db.product.create({ data: { sku: SKU, name: '__가용재고 상품' } })
    productId = product.id

    // 시드 거점을 쓰면 다른 상품의 로트가 섞인다 — 이 테스트 전용 거점을 만든다
    const own = await db.location.create({
      data: { name: `${PREFIX} 자사창고`, type: LOCATION_TYPES.OWN },
    })
    const fulfillment = await db.location.create({
      data: { name: `${PREFIX} 풀필먼트`, type: LOCATION_TYPES.FULFILLMENT },
    })
    const popup = await db.location.create({
      data: { name: `${PREFIX} 팝업`, type: LOCATION_TYPES.POPUP },
    })

    await db.$transaction(async (tx) => {
      // 팝업 재고는 자사창고에서 반출된 것이다 (01 F5-1 「사유가 붙지 않는 것 — 위치 이동」)
      await applyMovement(tx, {
        type: MOVEMENT_TYPES.INBOUND,
        reason: REASON_CODES.PURCHASE,
        productId: product.id,
        expiryDate: EXPIRY,
        quantity: OWN_QTY + POPUP_QTY,
        toLocationId: own.id,
        userId,
      })
      await applyMovement(tx, {
        type: MOVEMENT_TYPES.INBOUND,
        reason: REASON_CODES.PURCHASE,
        productId: product.id,
        expiryDate: EXPIRY,
        quantity: FULFILLMENT_QTY,
        toLocationId: fulfillment.id,
        userId,
      })
      await applyMovement(tx, {
        type: MOVEMENT_TYPES.POPUP_OUT,
        productId: product.id,
        expiryDate: EXPIRY,
        quantity: POPUP_QTY,
        fromLocationId: own.id,
        toLocationId: popup.id,
        userId,
      })
    })
  })

  afterAll(async () => {
    await cleanup()
    await db.$disconnect()
  })

  it('가용 재고는 자사창고 156 + 풀필먼트 44 = 200이다', async () => {
    const detail = await getProductDetail(productId)
    expect(detail?.available).toBe(OWN_QTY + FULFILLMENT_QTY)
  })

  it('같은 조건에서 현재 출고 가능은 자사창고 156 그대로다', async () => {
    const detail = await getProductDetail(productId)
    expect(detail?.shippable).toBe(OWN_QTY)
  })

  it('팝업 재고 130은 가용 재고에 들어가지 않는다', async () => {
    const detail = await getProductDetail(productId)
    // 총 재고에는 들어 있는데 가용에는 없다 — 그 차이가 곧 팝업 수량이다
    expect(detail?.total).toBe(OWN_QTY + FULFILLMENT_QTY + POPUP_QTY)
    expect((detail?.total ?? 0) - (detail?.available ?? 0)).toBe(POPUP_QTY)
  })

  it('팝업 재고는 가용에서 제외 목록에서 따로 조회된다', async () => {
    const detail = await getProductDetail(productId)
    const popupRows = (detail?.excluded ?? []).filter((e) => e.type === LOCATION_TYPES.POPUP)
    expect(popupRows.map((e) => e.locationName)).toEqual([`${PREFIX} 팝업`])
    expect(popupRows.reduce((s, e) => s + e.qty, 0)).toBe(POPUP_QTY)
  })
})
