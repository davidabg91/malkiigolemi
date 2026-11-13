import { Check, CheckCheck, Download, ExternalLink, RotateCcw } from "lucide-react";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { Suspense } from "react";
import { markAllStorePaymentsSeen, markStorePaymentSeen } from "@/actions/store-pay";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { AdminSkeleton, PageTitle, Panel } from "@/components/admin/bits";
import { btn } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatPrice, formatTimestamp } from "@/lib/format";
import { getStorePayments, STORE_PAY_URL } from "@/lib/store-payments";
import { stripeConfigured, stripePaymentUrl } from "@/lib/stripe";

export const metadata: Metadata = { title: "Плащания в магазина" };

const action = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-sand hover:text-ink";

async function StorePayments() {
  await requireAdmin();
  const [{ list, today, month, unseen }, qrSvg, qrPng] = await Promise.all([
    getStorePayments(),
    QRCode.toString(STORE_PAY_URL, { type: "svg", margin: 1, errorCorrectionLevel: "M" }),
    QRCode.toDataURL(STORE_PAY_URL, { width: 1200, margin: 3, errorCorrectionLevel: "M" }),
  ]);

  return (
    <>
      <AutoRefresh seconds={8} />
      <PageTitle
        title="Плащания в магазина"
        sub="Клиентът сканира QR кода, въвежда сумата и плаща с Apple Pay, Google Pay или карта. Плащането излиза тук до няколко секунди."
      />
      {!stripeConfigured() && (
        <p className="mb-5 rounded-2xl bg-sun/30 px-4 py-3 text-sm">Stripe не е настроен, затова страницата за плащане не приема плащания.</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Panel className="p-5 text-center">
          <div className="mx-auto w-full max-w-56 rounded-2xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label="QR код за плащане в магазина" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="mt-3 break-all text-sm font-semibold">{STORE_PAY_URL.replace("https://", "")}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <a href={qrPng} download="qr-plashtane-v-magazina.png" className={btn.smPrimary}>
              <Download className="h-4 w-4" aria-hidden />
              Свали QR кода
            </a>
            <a href={STORE_PAY_URL} target="_blank" rel="noopener noreferrer" className={btn.sm}>
              <ExternalLink className="h-4 w-4" aria-hidden />
              Отвори
            </a>
          </div>
          <p className="mt-4 text-left text-sm text-ink-soft">Разпечатай кода и го сложи до касата. Той е винаги един и същ.</p>
        </Panel>

        <div className="grid content-start gap-4 sm:grid-cols-2">
          <Panel className="p-5">
            <p className="text-sm text-ink-soft">Днес</p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{formatPrice(today.sum)}</p>
            <p className="mt-1 text-sm text-ink-soft">{today.n === 1 ? "1 плащане" : `${today.n} плащания`}</p>
          </Panel>
          <Panel className="p-5">
            <p className="text-sm text-ink-soft">Последните 30 дни</p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{formatPrice(month.sum)}</p>
            <p className="mt-1 text-sm text-ink-soft">{month.n === 1 ? "1 плащане" : `${month.n} плащания`}</p>
          </Panel>
          <p className="rounded-2xl bg-sand px-4 py-3 text-sm sm:col-span-2">
            Преди да дадеш стоката, виж плащането тук със същата сума и номер като на телефона на клиента. Връщане на пари се прави от Stripe (връзката
            „Stripe“ до плащането).
          </p>
        </div>
      </div>

      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Получени плащания</h2>
        {unseen > 0 && (
          <form action={markAllStorePaymentsSeen}>
            <button type="submit" className={btn.sm}>
              <CheckCheck className="h-4 w-4" aria-hidden />
              Отбележи всички като видени
            </button>
          </form>
        )}
      </div>
      {list.length === 0 ? (
        <Panel>
          <p className="px-5 py-14 text-center text-ink-soft">Още няма плащания през QR кода.</p>
        </Panel>
      ) : (
        <ul className="space-y-3">
          {list.map((p) => (
            <li key={p.id}>
              <Panel className={`flex flex-wrap items-center justify-between gap-3 p-5 ${p.seenAt ? "" : "ring-2 ring-tomato/40"}`}>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-2xl font-semibold tabular-nums">{formatPrice(p.amount)}</span>
                    {!p.seenAt && <span className="rounded-full bg-tomato px-2 py-0.5 text-xs font-semibold text-white">Ново</span>}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">
                    Плащане № {p.id} · {formatTimestamp(p.createdAt)} ч.
                  </p>
                  {p.note && <p className="mt-1 text-sm">Бележка: {p.note}</p>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {p.stripePaymentIntent && (
                    <a href={stripePaymentUrl(p.stripePaymentIntent)} target="_blank" rel="noopener noreferrer" className={action}>
                      <ExternalLink className="h-4 w-4" aria-hidden />
                      Stripe
                    </a>
                  )}
                  <form action={markStorePaymentSeen.bind(null, p.id, !p.seenAt)}>
                    <button type="submit" className={action}>
                      {p.seenAt ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                      {p.seenAt ? "Върни като ново" : "Видяно"}
                    </button>
                  </form>
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <StorePayments />
    </Suspense>
  );
}
