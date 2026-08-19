'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BulkInputRow } from './BulkInputRow'
import { saveFulfillmentReflection } from '@/actions/fulfillment'
import { ALLOCATION, planAllocation } from '@/lib/fefo'
import { dateOnly, formatDate } from '@/lib/date'
import type { SheetRow } from '@/lib/inventory'

type Filter = 'recent' | 'all' | 'filled'

const FILTER_LABEL: Record<Filter, string> = {
  recent: '최근 움직임',
  all: '전체',
  filled: '입력한 것',
}

/**
 * 풀필먼트 일일 반영 (S5) — 매일 3사 × 1회 반복되는 화면이다.
 * 여기서 검색을 시키면 하루 30번 검색이 되므로, 목록에 나열하고 수량칸만 채운다.
 */
export function FulfillmentSheet({
  location,
  rows,
  lastReflectedLabel,
}: {
  location: { id: number; name: string }
  rows: SheetRow[]
  lastReflectedLabel: string
}) {
  const router = useRouter()
  const [values, setValues] = useState<Record<number, string>>({})
  const [filter, setFilter] = useState<Filter>(rows.some((r) => r.recent) ? 'recent' : 'all')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  /** 입력할 때마다 FEFO 배분을 다시 계산한다 — 서버와 같은 순수 함수를 쓴다 */
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

  const filledCount = computed.filter((c) => c.qty > 0).length
  const totalQty = computed.reduce((s, c) => s + c.qty, 0)
  const hasShortage = computed.some((c) => c.shortage > 0)

  const visible = computed.filter((c) => {
    if (filter === 'all') return true
    if (filter === 'filled') return c.qty > 0
    return c.row.recent || c.qty > 0 // 입력한 줄은 필터와 무관하게 남는다
  })

  const submit = async () => {
    if (hasShortage) return
    setPending(true)
    setError(null)
    const res = await saveFulfillmentReflection({
      locationId: location.id,
      lines: computed.filter((c) => c.qty > 0).map((c) => ({ productId: c.row.productId, qty: c.qty })),
    })
    setPending(false)
    if (!res.ok) return setError(res.error)
    router.push('/fulfillment')
    router.refresh()
  }

  return (
    <main className="pb-28">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <Link href="/fulfillment" className="text-[14.5px] font-extrabold">
          ‹ {location.name} 일일 반영
        </Link>
        <span className="text-[11px] text-sub">마지막 반영 {lastReflectedLabel}</span>
      </header>

      <p className="border-b border-line bg-dim px-4 py-2.5 text-[11.5px] leading-relaxed text-[#5b5570]">
        {location.name} 관리자 페이지의 <b>어제 고객 출고 수량</b>을 옮겨 적습니다. 나가지 않은
        상품은 비워 두세요. 로트는 유통기한이 빠른 것부터 자동으로 차감됩니다.
      </p>

      <div className="flex gap-1.5 overflow-x-auto px-4 py-2.5">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => {
          const count =
            f === 'all' ? rows.length : f === 'recent' ? rows.filter((r) => r.recent).length : filledCount
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11.5px] ${
                filter === f
                  ? 'bg-acc-soft font-extrabold text-acc'
                  : 'bg-dim font-semibold text-sub'
              }`}
            >
              {FILTER_LABEL[f]} {count}
            </button>
          )
        })}
      </div>

      {/* PC에서만 보이는 표 머리 — 같은 행이 넓은 폭에서 표로 펼쳐진다 */}
      <div className="hidden border-y border-line bg-dim px-4 py-1.5 text-[10.5px] font-extrabold tracking-wider text-sub lg:grid lg:grid-cols-[minmax(0,1.4fr)_112px_112px_minmax(0,1.6fr)] lg:gap-x-3">
        <span>상품</span>
        <span className="text-right">현재 → 변경 후</span>
        <span className="text-center">어제 출고</span>
        <span>FEFO 차감</span>
      </div>

      {visible.length === 0 ? (
        <p className="px-4 py-14 text-center text-[13px] text-sub">
          {filter === 'filled' ? '아직 입력한 상품이 없습니다' : '이 거점에 남은 재고가 없습니다'}
        </p>
      ) : (
        visible.map((c) => {
          const filled = c.qty > 0
          return (
            <BulkInputRow
              key={c.row.productId}
              name={c.row.name}
              sub={c.row.sku}
              unit={c.row.unit}
              ariaLabel={`${c.row.name} 어제 출고 수량`}
              value={values[c.row.productId] ?? ''}
              onChange={(v) => setValues((p) => ({ ...p, [c.row.productId]: v }))}
              onEnter={submit}
              tone={c.shortage > 0 ? 'error' : filled ? 'filled' : 'idle'}
              info={
                filled ? (
                  <>
                    {c.row.current.toLocaleString()} <span className="text-[#c9c4d6]">→</span>{' '}
                    <b className={c.shortage > 0 ? 'text-red' : 'text-acc'}>
                      {(c.row.current - c.qty).toLocaleString()}
                    </b>
                  </>
                ) : (
                  <>보유 {c.row.current.toLocaleString()}</>
                )
              }
              result={
                c.shortage > 0 ? (
                  <b className="text-red">보유보다 {c.shortage.toLocaleString()}개 많습니다</b>
                ) : filled ? (
                  `${c.plan.map((p) => `${p.expiry}에서 ${p.qty}${c.row.unit}`).join(' · ')} 차감`
                ) : (
                  <span className="hidden text-[#c9c4d6] lg:inline">—</span>
                )
              }
            />
          )
        })
      )}

      {error && (
        <p className="mx-4 mt-3 rounded-xl bg-red-bg px-3.5 py-2.5 text-[12px] font-bold text-red">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[560px] border-t border-line bg-white p-3 lg:max-w-[960px]">
        <div className="mb-2 flex items-center justify-between px-1 text-[11.5px]">
          <span className="font-bold text-[#5b5570] tnum">
            {filledCount > 0 ? `입력 ${filledCount}건 · 총 ${totalQty}개 차감` : '입력한 상품 없음'}
          </span>
          {hasShortage && <span className="font-extrabold text-red">보유보다 많은 줄이 있습니다</span>}
        </div>
        <button
          onClick={submit}
          disabled={pending || hasShortage}
          className="acc-grad w-full rounded-xl py-3.5 text-[14.5px] font-extrabold text-white disabled:opacity-40"
        >
          {pending
            ? '반영 중…'
            : filledCount > 0
              ? `반영 저장 · ${totalQty}개 차감`
              : '어제 출고 없음으로 반영'}
        </button>
      </div>
    </main>
  )
}
