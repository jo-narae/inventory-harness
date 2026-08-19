'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PickerRow } from './PickerRow'
import { QtyInput } from './QtyInput'
import { ProductPicker, type PickProduct } from './ProductPicker'
import { ExpiryBadge } from './StatusBadge'
import { Qty } from './Qty'
import { saveOutbound } from '@/actions/outbound'
import { ALLOCATION_REASON, planFefo } from '@/lib/fefo'
import { dateOnly, formatDate, humanizeRemaining } from '@/lib/date'
import { expiryStatus } from '@/lib/expiry'
import { OUTBOUND_REASONS, REASON_LABEL, type ReasonCode } from '@/lib/constants'

export type OutLot = {
  id: number
  productId: number
  locationId: number
  expiry: string // ISO
  quantity: number
  alertDays: number
}

export function OutboundForm({
  products,
  locations,
  lots,
}: {
  products: PickProduct[]
  locations: { id: number; name: string }[]
  lots: OutLot[]
}) {
  const router = useRouter()
  const [product, setProduct] = useState<PickProduct | null>(null)
  const [locationId, setLocationId] = useState(String(locations[0]?.id ?? ''))
  const [reason, setReason] = useState<ReasonCode>('SALE')
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [manual, setManual] = useState(false)
  const [manualQty, setManualQty] = useState<Record<number, string>>({})
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const myLots = useMemo(
    () =>
      lots
        .filter((l) => l.productId === product?.id && l.locationId === Number(locationId))
        .map((l) => ({ ...l, expiryDate: dateOnly(l.expiry) })),
    [lots, product, locationId]
  )
  const stock = myLots.reduce((s, l) => s + l.quantity, 0)

  // 화면 미리보기와 서버가 같은 함수를 쓴다
  const { plan, shortage } = useMemo(
    () => planFefo(myLots, Number(qty) || 0),
    [myLots, qty]
  )

  const manualTotal = Object.values(manualQty).reduce((s, v) => s + (Number(v) || 0), 0)

  const submit = async () => {
    if (!product) return
    setError(null)
    setPending(true)
    const res = await saveOutbound({
      productId: product.id,
      locationId: Number(locationId),
      reason,
      note: note || undefined,
      quantity: manual ? manualTotal : Number(qty),
      manual: manual
        ? Object.entries(manualQty)
            .filter(([, v]) => Number(v) > 0)
            .map(([id, v]) => ({ lotId: Number(id), qty: Number(v) }))
        : undefined,
    })
    setPending(false)
    if (!res.ok) return setError(res.error)

    setSaved(res.message)
    setProduct(null)
    setQty('')
    setNote('')
    setManual(false)
    setManualQty({})
    router.refresh()
  }

  if (!product) {
    return (
      <main className="pb-10">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <Link href="/" className="text-[14.5px] font-extrabold">
            ‹ 출고
          </Link>
        </header>
        {saved && (
          <p className="border-b border-ok-bg bg-ok-bg px-4 py-2.5 text-[12px] font-bold text-ok">
            ✓ {saved} — 저장했습니다
          </p>
        )}
        <ProductPicker products={products} onPick={setProduct} title="상품 검색" />
      </main>
    )
  }

  const need = Number(qty) || 0

  return (
    <main className="pb-32">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <button onClick={() => setProduct(null)} className="text-[14.5px] font-extrabold">
          ‹ 출고
        </button>
        <span className="text-[11px] text-sub">FEFO 자동</span>
      </header>

      <PickerRow
        items={[
          {
            label: '빼는 곳',
            value: locationId,
            options: locations.map((l) => ({ value: String(l.id), label: `📍 ${l.name}` })),
            onChange: setLocationId,
          },
          {
            label: '사유',
            value: reason,
            options: OUTBOUND_REASONS.map((r) => ({ value: r, label: REASON_LABEL[r] })),
            onChange: (v) => setReason(v as ReasonCode),
          },
        ]}
      />

      <div className="mx-4 mt-3 flex items-center justify-between rounded-xl border border-acc-line bg-acc-soft px-3.5 py-2.5">
        <b className="text-[13px] text-acc">🦴 {product.name}</b>
        <span className="text-[11.5px] font-bold text-acc">이 거점 보유 {stock}{product.unit}</span>
      </div>

      {!manual ? (
        <>
          <div className="mx-4 mt-3">
            <label className="mb-1 block text-[10.5px] text-sub">출고 수량</label>
            <QtyInput autoFocus value={qty} onChange={setQty} unit={product.unit} />
          </div>

          {need > 0 && (
            <>
              <p className="px-4 pb-1 pt-4 text-[10.5px] font-extrabold tracking-wider text-sub">
                자동 선택 — 유통기한 빠른 순
              </p>
              {plan.map((a) => {
                const lot = myLots.find((l) => l.id === a.lotId)!
                const st = expiryStatus(new Date(a.expiryDate), lot.alertDays)
                return (
                  <div
                    key={a.lotId}
                    className={`mx-4 mt-2 rounded-2xl border px-3.5 py-2.5 ${
                      st === 'OK' ? 'border-line' : 'border-[#f0dcc0] bg-[#fffdf8]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13.5px] font-extrabold tnum">
                          {formatDate(new Date(a.expiryDate))}
                        </p>
                        <p className="mt-[2px] text-[10.5px] text-sub">
                          📍 {locations.find((l) => l.id === Number(locationId))?.name} · 보유{' '}
                          {a.lotQuantity}{product.unit} · {humanizeRemaining(new Date(a.expiryDate))} ·{' '}
                          {a.qty === a.lotQuantity ? '전부 사용' : `${a.qty}${product.unit}만 사용`}
                        </p>
                      </div>
                      <div className="text-right">
                        <Qty value={a.qty} unit={product.unit} size="lg" />
                        <ExpiryBadge status={st} />
                      </div>
                    </div>
                  </div>
                )
              })}
              {shortage > 0 && (
                <p className="mx-4 mt-2 rounded-xl bg-red-bg px-3.5 py-2.5 text-[12px] font-bold text-red">
                  재고가 {shortage}개 부족합니다 (보유 {stock}개)
                </p>
              )}
              <p className="mx-4 mt-3 text-[11.5px] text-[#5b5570]">
                {ALLOCATION_REASON.FEFO} ·{' '}
                <button onClick={() => setManual(true)} className="font-extrabold text-acc">
                  변경
                </button>
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <div className="mx-4 mt-4 flex items-center justify-between">
            <p className="text-[10.5px] font-extrabold tracking-wider text-sub">
              직접 선택 — 사유 입력 필수
            </p>
            <button
              onClick={() => {
                setManual(false)
                setManualQty({})
              }}
              className="text-[11.5px] font-extrabold text-acc"
            >
              자동으로 되돌리기
            </button>
          </div>
          {myLots
            .slice()
            .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime())
            .map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between border-b border-line px-4 py-2.5"
              >
                <div>
                  <p className="text-[12.5px] font-bold tnum">{formatDate(l.expiryDate)}</p>
                  <p className="text-[10.5px] text-sub">
                    보유 {l.quantity}{product.unit} · {humanizeRemaining(l.expiryDate)}
                  </p>
                </div>
                <QtyInput
                  size="sm"
                  className="w-24"
                  value={manualQty[l.id] ?? ''}
                  onChange={(v) => setManualQty((p) => ({ ...p, [l.id]: v }))}
                  unit={product.unit}
                />
              </div>
            ))}
          <p className="px-4 py-2 text-[12px] font-bold text-acc">합계 {manualTotal}{product.unit}</p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="FEFO와 다르게 내보내는 사유 (필수)"
            className="mx-4 w-[calc(100%-2rem)] rounded-xl border border-amber px-3.5 py-2.5 text-[12.5px] outline-none"
          />
        </>
      )}

      {reason === 'OTHER' && !manual && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="메모 (사유가 기타일 때 필수)"
          className="mx-4 mt-3 w-[calc(100%-2rem)] rounded-xl border border-[#e2ddec] px-3.5 py-2.5 text-[12.5px] outline-none"
        />
      )}

      {error && (
        <p className="mx-4 mt-3 rounded-xl bg-red-bg px-3.5 py-2.5 text-[12px] font-bold text-red">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-[560px] border-t border-line bg-white p-3 lg:max-w-[960px]">
        <button
          onClick={submit}
          disabled={pending || (manual ? manualTotal <= 0 : need <= 0 || shortage > 0)}
          className="acc-grad w-full rounded-xl py-3.5 text-[14.5px] font-extrabold text-white disabled:opacity-40"
        >
          {pending ? '저장 중…' : `${manual ? manualTotal : need}${product.unit} 출고`}
        </button>
      </div>
    </main>
  )
}
