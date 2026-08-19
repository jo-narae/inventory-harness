'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BulkInputRow } from './BulkInputRow'
import { shipOutPopup } from '@/actions/popup'
import { ALLOCATION, planAllocation } from '@/lib/fefo'
import { dateOnly, formatDate } from '@/lib/date'

export type ShipRow = {
  productId: number
  name: string
  sku: string
  unit: string
  planned: number
  shipped: number
  sourceStock: number
  lots: { id: number; expiry: string; quantity: number }[]
}

/**
 * 실제 반출 (S7) · 추가 반출 (S8)
 *
 * 계획과 실제는 다를 수 있다 — 재고가 모자라거나 현장 판단이 바뀐다.
 * 그래서 예정 수량은 채워만 두고, 실제로 꺼낸 수량을 확인해서 저장한다.
 * 로트는 FEFO. 팝업 물건은 며칠 안에 팔리므로 임박분부터 밀어내는 것이 맞다.
 */
export function PopupShipOut({
  popupId,
  rows,
  sourceName,
  prefillPlan,
}: {
  popupId: number
  rows: ShipRow[]
  sourceName: string
  /** 반출서가 있는 첫 반출에서는 예정 수량을 미리 채워 준다 */
  prefillPlan: boolean
}) {
  const router = useRouter()
  const [values, setValues] = useState<Record<number, string>>(() =>
    prefillPlan
      ? Object.fromEntries(
          rows.filter((r) => r.planned > 0).map((r) => [r.productId, String(r.planned)])
        )
      : {}
  )
  const [showAll, setShowAll] = useState(!rows.some((r) => r.planned > 0))
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const computed = useMemo(
    () =>
      rows.map((row) => {
        const qty = Number(values[row.productId] ?? '') || 0
        const { plan, shortage } = planAllocation(
          row.lots.map((l) => ({ id: l.id, expiryDate: dateOnly(l.expiry), quantity: l.quantity })),
          qty,
          ALLOCATION.FEFO
        )
        return {
          row,
          qty,
          shortage,
          plan: plan.map((p) => ({ expiry: formatDate(new Date(p.expiryDate)), qty: p.qty })),
        }
      }),
    [rows, values]
  )

  const filled = computed.filter((c) => c.qty > 0)
  const total = filled.reduce((s, c) => s + c.qty, 0)
  const hasShortage = computed.some((c) => c.shortage > 0)
  const visible = showAll ? computed : computed.filter((c) => c.row.planned > 0 || c.qty > 0)

  const submit = async () => {
    if (hasShortage || filled.length === 0) return
    setPending(true)
    setError(null)
    const res = await shipOutPopup({
      popupId,
      lines: filled.map((c) => ({ productId: c.row.productId, quantity: c.qty })),
    })
    setPending(false)
    if (!res.ok) return setError(res.error)
    setValues({})
    router.refresh()
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 pb-1 pt-5">
        <p className="text-[10.5px] font-extrabold tracking-wider text-sub">
          {sourceName}에서 실제로 꺼낸 수량
        </p>
        <button onClick={() => setShowAll((v) => !v)} className="text-[11px] font-bold text-acc">
          {showAll ? '반출서 상품만' : '전체 상품 보기'}
        </button>
      </div>

      <div className="hidden border-y border-line bg-dim px-4 py-1.5 text-[10.5px] font-extrabold tracking-wider text-sub lg:grid lg:grid-cols-[minmax(0,1.4fr)_112px_112px_minmax(0,1.6fr)] lg:gap-x-3">
        <span>상품</span>
        <span className="text-right">창고 보유</span>
        <span className="text-center">반출 수량</span>
        <span>FEFO 로트</span>
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-10 text-center text-[12.5px] text-sub">
          자사창고에 재고가 있는 상품이 없습니다
        </p>
      ) : (
        visible.map((c) => (
          <BulkInputRow
            key={c.row.productId}
            name={c.row.name}
            sub={
              c.row.planned > 0
                ? `예정 ${c.row.planned}${c.row.unit}${c.row.shipped > 0 ? ` · 누적 반출 ${c.row.shipped}${c.row.unit}` : ''}`
                : c.row.shipped > 0
                  ? `누적 반출 ${c.row.shipped}${c.row.unit}`
                  : c.row.sku
            }
            unit={c.row.unit}
            ariaLabel={`${c.row.name} 반출 수량`}
            value={values[c.row.productId] ?? ''}
            onChange={(v) => setValues((p) => ({ ...p, [c.row.productId]: v }))}
            onEnter={submit}
            tone={c.shortage > 0 ? 'error' : c.qty > 0 ? 'filled' : 'idle'}
            info={<>보유 {c.row.sourceStock.toLocaleString()}</>}
            result={
              c.shortage > 0 ? (
                <b className="text-red">창고 보유보다 {c.shortage}개 많습니다</b>
              ) : c.qty > 0 ? (
                c.plan.map((p) => `${p.expiry}에서 ${p.qty}${c.row.unit}`).join(' · ')
              ) : (
                <span className="hidden text-[#c9c4d6] lg:inline">—</span>
              )
            }
          />
        ))
      )}

      {error && (
        <p className="mx-4 mt-3 rounded-xl bg-red-bg px-3.5 py-2.5 text-[12px] font-bold text-red">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[560px] border-t border-line bg-white p-3 lg:max-w-[960px]">
        <div className="mb-2 px-1 text-[11.5px] font-bold text-[#5b5570] tnum">
          {filled.length > 0 ? `${filled.length}종 ${total}개 반출` : '반출할 수량을 입력하세요'}
        </div>
        <button
          onClick={submit}
          disabled={pending || hasShortage || filled.length === 0}
          className="acc-grad w-full rounded-xl py-3.5 text-[14.5px] font-extrabold text-white disabled:opacity-40"
        >
          {pending ? '반출 중…' : `반출 확정${total > 0 ? ` · ${total}개` : ''}`}
        </button>
      </div>
    </>
  )
}
