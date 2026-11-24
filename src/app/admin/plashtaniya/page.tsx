import { Check, CheckCheck, ChevronDown, Download, ExternalLink, QrCode, Receipt, RefreshCw, RotateCcw, Search, ShoppingBag, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import QRCode from "qrcode";
import { Suspense, type ReactNode } from "react";
import { markAllStorePaymentsSeen, markStorePaymentSeen, refreshStripeLedger } from "@/actions/store-pay";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { AdminSkeleton, PageTitle, Panel } from "@/components/admin/bits";
import { btn } from "@/components/ui";
import type { StorePayment } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatPrice, formatTimestamp } from "@/lib/format";
import { getStorePayments, STORE_PAY_URL } from "@/lib/store-payments";
import { stripeConfigured, stripePaymentUrl } from "@/lib/stripe";
import {
  cardBrand,
  checkLabel,
  countryName,
  disputeReason,
  disputeStatus,
  failureText,
  feeLabel,
  fundingLabel,
  methodLabel,
  methodSummary,
  parseDetails,
  refundReason,
  refundStatus,
  riskLabel,
  threeDSLabel,
  walletLabel,
} from "@/lib/stripe-labels";
import { getLedger, getUnsyncedStorePayments, LEDGER_KINDS, LEDGER_STATUSES, syncStripeIfStale, type LedgerFilter, type LedgerRow } from "@/lib/stripe-ledger";
import { sofiaInputToDate } from "@/lib/time";

export const metadata: Metadata = { title: "Плащания в магазина" };

const action = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-sand hover:text-ink";
const PAGE = 50;

const KIND_LABELS: Record<LedgerFilter["kind"], string> = { store: "В магазина", order: "Онлайн поръчки", all: "Всички" };
const STATUS_LABELS: Record<LedgerFilter["status"], string> = { all: "Всички", paid: "Успешни", refunded: "Върнати", failed: "Неуспешни" };

const dayFmt = new Intl.DateTimeFormat("bg-BG", { timeZone: "Europe/Sofia", day: "2-digit", month: "2-digit", year: "numeric" });
const stamp = (unixSeconds: number) => `${formatTimestamp(unixSeconds * 1000)} ч.`;
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

function StatusBadge({ row }: { row: LedgerRow["p"] }) {
  const pill = "rounded-full px-2 py-0.5 text-xs font-semibold";
  if (row.status === "failed") return <span className={`${pill} bg-tomato/15 text-tomato`}>Неуспешно</span>;
  if (row.status !== "succeeded") return <span className={`${pill} bg-sun/40 text-[#5a4300]`}>Обработва се</span>;
  return (
    <>
      {row.disputed && <span className={`${pill} bg-tomato text-white`}>Оспорено</span>}
      {row.amountRefunded >= row.amount ? (
        <span className={`${pill} bg-sand text-ink`}>Върнато</span>
      ) : row.amountRefunded > 0 ? (
        <span className={`${pill} bg-sand text-ink`}>Върнати {formatPrice(row.amountRefunded)}</span>
      ) : (
        !row.disputed && <span className={`${pill} bg-[#cdebd3] text-[#0f3d26]`}>Платено</span>
      )}
    </>
  );
}

/** Where the money came from: the QR code at the till (/plati) or an order placed on the site. */
function SourceBadge({ kind }: { kind: string }) {
  const pill = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold";
  if (kind === "store")
    return (
      <span className={`${pill} bg-[#e2d8f7] text-[#2f1f5c]`}>
        <QrCode className="h-3.5 w-3.5" aria-hidden />
        В магазина, с QR кода
      </span>
    );
  if (kind === "order")
    return (
      <span className={`${pill} bg-[#cde5f6] text-[#0c3350]`}>
        <ShoppingBag className="h-3.5 w-3.5" aria-hidden />
        Поръчка от сайта
      </span>
    );
  return <span className={`${pill} bg-sand text-ink`}>Друго плащане</span>;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-soft">{title}</h4>
      <dl className="mt-2 space-y-1.5 text-sm">{children}</dl>
    </div>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "" || children === false) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-soft">{k}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function SeenButton({ store }: { store: StorePayment }) {
  return (
    <form action={markStorePaymentSeen.bind(null, store.id, !store.seenAt)}>
      <button type="submit" className={action}>
        {store.seenAt ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
        {store.seenAt ? "Върни като ново" : "Видяно"}
      </button>
    </form>
  );
}

/** A payment with everything Stripe says about it. */
function PaymentCard({ row }: { row: LedgerRow }) {
  const { p, store } = row;
  const d = parseDetails(p.data);
  const ok = p.status === "succeeded";
  const unseen = ok && store && !store.seenAt;
  const paidWith = methodSummary(p.last4, d);
  const who = [p.name, p.email].filter(Boolean).join(" · ");
  const note = store?.note ?? d.note;
  const fees = d.fees ?? [];
  const left = p.net === null ? null : p.net - p.amountRefunded;

  return (
    <Panel className={`p-5 ${unseen ? "ring-2 ring-tomato/40" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className={`font-display text-2xl font-semibold tabular-nums ${ok ? "" : "text-ink-soft"}`}>{formatPrice(p.amount)}</span>
            {unseen && <span className="rounded-full bg-tomato px-2 py-0.5 text-xs font-semibold text-white">Ново</span>}
            <StatusBadge row={p} />
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
            <SourceBadge kind={p.kind} />
            <span>
              {row.orderId ? (
                <Link href={`/admin/porachki/${row.orderId}`} className="font-medium text-ink underline underline-offset-2">
                  Поръчка {row.orderNumber}
                </Link>
              ) : p.kind === "order" ? (
                <>Поръчка {d.orderNumber ?? ""}</>
              ) : p.kind === "store" ? (
                <>{store ? `Плащане № ${store.id}` : "Без номер"}</>
              ) : (
                <>Не е от сайта</>
              )}{" "}
              · {formatTimestamp(p.created)} ч.
            </span>
          </p>
          {(paidWith || who) && <p className="mt-1 text-sm">{[paidWith, who].filter(Boolean).join(" · ")}</p>}
          {note && <p className="mt-1 text-sm">Бележка: {note}</p>}
          {d.failure && <p className="mt-1 text-sm text-tomato">{failureText(d.failure)}</p>}
        </div>
        <div className="flex flex-wrap gap-1">
          {row.orderId && (
            <Link href={`/admin/porachki/${row.orderId}`} className={btn.sm}>
              <ShoppingBag className="h-4 w-4" aria-hidden />
              Виж поръчката
            </Link>
          )}
          {ok && store && <SeenButton store={store} />}
        </div>
      </div>

      <details className="group mt-3 border-t border-line pt-3">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink [&::-webkit-details-marker]:hidden">
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden />
          Всички данни
        </summary>
        <div className="mt-4 grid gap-x-10 gap-y-6 md:grid-cols-2 2xl:grid-cols-3">
          <Group title="Пари">
            <Row k="Платена сума">{formatPrice(p.amount)}</Row>
            {fees.length > 1 ? (
              fees.map((f, i) => (
                <Row key={i} k={feeLabel(f.type)}>
                  − {formatPrice(f.amount)}
                </Row>
              ))
            ) : (
              <Row k="Такса на Stripe">{p.fee === null ? (ok ? "още не е начислена" : "") : `− ${formatPrice(p.fee)}`}</Row>
            )}
            <Row k="Върнати на клиента">{p.amountRefunded > 0 && `− ${formatPrice(p.amountRefunded)}`}</Row>
            <Row k="Остава за магазина">{left !== null && formatPrice(left)}</Row>
            <Row k="По сметката от">{ok && d.availableOn ? dayFmt.format(d.availableOn * 1000) : ""}</Row>
            <Row k="Валута">{p.currency !== "eur" && p.currency.toUpperCase()}</Row>
          </Group>

          <Group title="Начин на плащане">
            <Row k="Платено с">{d.card ? [walletLabel(d.card.wallet), "карта"].filter(Boolean).join(", ") : methodLabel(d.method)}</Row>
            {d.card && (
              <>
                <Row k="Карта">{[cardBrand(d.card.brand), fundingLabel(d.card.funding).toLowerCase()].filter(Boolean).join(", ")}</Row>
                <Row k="Номер">{p.last4 && `•••• ${p.last4}`}</Row>
                <Row k="Номер в телефона">{d.card.walletLast4 && `•••• ${d.card.walletLast4}`}</Row>
                <Row k="Валидна до">{`${String(d.card.expMonth).padStart(2, "0")}/${d.card.expYear}`}</Row>
                <Row k="Банка">{d.card.issuer}</Row>
                <Row k="Държава на картата">{countryName(d.card.country)}</Row>
                <Row k="3D Secure">{threeDSLabel(d.card.threeDS)}</Row>
                <Row k="Код CVC">{checkLabel(d.card.cvc)}</Row>
                <Row k="Пощенски код">{checkLabel(d.card.postal)}</Row>
              </>
            )}
            <Row k="Риск (Stripe)">{d.risk && [riskLabel(d.risk.level), d.risk.score !== null ? `${d.risk.score} от 100` : ""].filter(Boolean).join(", ")}</Row>
          </Group>

          <Group title="Клиент">
            <Row k="Име">{p.name}</Row>
            <Row k="Имейл">{p.email}</Row>
            <Row k="Телефон">{d.phone}</Row>
            <Row k="Адрес">{d.address}</Row>
            <Row k="Държава">{countryName(d.country)}</Row>
            {!p.name && !p.email && !d.phone && !d.address && !d.country && <p className="text-ink-soft">Stripe няма данни за клиента.</p>}
          </Group>

          {d.failure && (
            <Group title="Защо не мина">
              <Row k="Причина">{failureText(d.failure)}</Row>
              <Row k="Съобщение от Stripe">{d.failure.message}</Row>
              <Row k="Код">{[d.failure.code, d.failure.reason].filter(Boolean).join(" / ")}</Row>
              <Row k="Код от банката">{d.failure.bank}</Row>
            </Group>
          )}

          {(d.refunds?.length ?? 0) > 0 && (
            <Group title="Връщания на пари">
              {d.refunds!.map((r) => (
                <Row key={r.id} k={stamp(r.created)}>
                  {formatPrice(r.amount)}
                  <span className="block font-normal text-ink-soft">{[refundStatus(r.status), refundReason(r.reason)].filter(Boolean).join(" · ")}</span>
                </Row>
              ))}
            </Group>
          )}

          {d.dispute && (
            <Group title="Спор с банката">
              <Row k="Сума">{formatPrice(d.dispute.amount)}</Row>
              <Row k="Състояние">{disputeStatus(d.dispute.status)}</Row>
              <Row k="Причина">{disputeReason(d.dispute.reason)}</Row>
              <Row k="Открит на">{stamp(d.dispute.created)}</Row>
              <Row k="Отговор до">{d.dispute.dueBy && stamp(d.dispute.dueBy)}</Row>
            </Group>
          )}

          <Group title="Запис в Stripe">
            <Row k="Описание">{d.description}</Row>
            <Row k="В извлечението">{d.statement}</Row>
            <Row k="Плащане">{p.paymentIntent && <span className="break-all font-mono text-xs">{p.paymentIntent}</span>}</Row>
            <Row k="Транзакция">
              <span className="break-all font-mono text-xs">{p.id}</span>
            </Row>
          </Group>
        </div>
        <div className="mt-4 flex flex-wrap gap-1">
          {ok && d.receiptUrl && (
            <a href={d.receiptUrl} target="_blank" rel="noopener noreferrer" className={action}>
              <Receipt className="h-4 w-4" aria-hidden />
              Разписка за клиента
            </a>
          )}
          {p.paymentIntent && (
            <a href={stripePaymentUrl(p.paymentIntent)} target="_blank" rel="noopener noreferrer" className={action}>
              <ExternalLink className="h-4 w-4" aria-hidden />
              Отвори в Stripe
            </a>
          )}
        </div>
      </details>
    </Panel>
  );
}

/** A shop payment whose details have not come from Stripe yet. */
function PlainCard({ p }: { p: StorePayment }) {
  return (
    <Panel className={`flex flex-wrap items-center justify-between gap-3 p-5 ${p.seenAt ? "" : "ring-2 ring-tomato/40"}`}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-display text-2xl font-semibold tabular-nums">{formatPrice(p.amount)}</span>
          {!p.seenAt && <span className="rounded-full bg-tomato px-2 py-0.5 text-xs font-semibold text-white">Ново</span>}
          <span className="rounded-full bg-[#cdebd3] px-2 py-0.5 text-xs font-semibold text-[#0f3d26]">Платено</span>
        </p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-soft">
          <SourceBadge kind="store" />
          <span>
            Плащане № {p.id} · {formatTimestamp(p.createdAt)} ч.
          </span>
        </p>
        {p.note && <p className="mt-1 text-sm">Бележка: {p.note}</p>}
        {stripeConfigured() && <p className="mt-1 text-sm text-ink-soft">Картата и клиентът ще се покажат до минута.</p>}
      </div>
      <div className="flex flex-wrap gap-1">
        {p.stripePaymentIntent && (
          <a href={stripePaymentUrl(p.stripePaymentIntent)} target="_blank" rel="noopener noreferrer" className={action}>
            <ExternalLink className="h-4 w-4" aria-hidden />
            Stripe
          </a>
        )}
        <SeenButton store={p} />
      </div>
    </Panel>
  );
}

async function StorePayments({ searchParams }: Pick<PageProps<"/admin/plashtaniya">, "searchParams">) {
  await requireAdmin();
  const sp = await searchParams;
  const fromDay = isDay(sp.od) ? sp.od : "";
  const toDay = isDay(sp.do) ? sp.do : "";
  const until = toDay ? sofiaInputToDate(`${toDay}T23:59`) : null;
  const filter: LedgerFilter = {
    kind: LEDGER_KINDS.find((k) => k === sp.vid) ?? "store",
    status: LEDGER_STATUSES.find((s) => s === sp.status) ?? "all",
    q: (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80),
    from: fromDay ? sofiaInputToDate(`${fromDay}T00:00`) : null,
    to: until && new Date(until.getTime() + 60_000),
    limit: Math.min(Math.max(Number(sp.n) || PAGE, PAGE), 2000),
  };
  const narrowed = Boolean(filter.q || fromDay || toDay || filter.status !== "all");

  const [{ today, month, unseen }, ledger, plain, qrSvg, qrPng] = await Promise.all([
    getStorePayments(),
    getLedger(filter),
    getUnsyncedStorePayments(filter),
    QRCode.toString(STORE_PAY_URL, { type: "svg", margin: 1, errorCorrectionLevel: "M" }),
    QRCode.toDataURL(STORE_PAY_URL, { width: 1200, margin: 3, errorCorrectionLevel: "M" }),
  ]);
  // Bring Stripe's details up to date for the next look (the page reloads itself), sooner when a payment waits for them.
  after(() => syncStripeIfStale(plain.length ? 10 : 60));

  const href = (change: Partial<Record<"vid" | "status" | "q" | "od" | "do" | "n", string>>) => {
    const next = { vid: filter.kind === "store" ? "" : filter.kind, status: filter.status === "all" ? "" : filter.status, q: filter.q, od: fromDay, do: toDay, n: "", ...change };
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v));
    const str = qs.toString();
    return str ? `/admin/plashtaniya?${str}` : "/admin/plashtaniya";
  };
  const tab = (active: boolean) =>
    `inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition ${active ? "bg-ink text-cream" : "bg-paper shadow-soft hover:bg-lime"}`;
  const chip = (active: boolean) =>
    `inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 text-sm font-medium transition ${active ? "bg-forest text-white" : "text-ink-soft hover:bg-sand hover:text-ink"}`;
  const t = ledger.totals;
  const shown = ledger.rows.length + plain.length;

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
            Преди да дадеш стоката, виж плащането тук със същата сума и номер като на телефона на клиента. Връщане на пари се прави от Stripe: отвори
            „Всички данни“ на плащането и натисни „Отвори в Stripe“.
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

      <ul className="no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
        {LEDGER_KINDS.map((k) => (
          <li key={k}>
            <Link href={href({ vid: k === "store" ? "" : k })} scroll={false} className={tab(filter.kind === k)}>
              {KIND_LABELS[k]}
            </Link>
          </li>
        ))}
      </ul>

      <form action="/admin/plashtaniya" role="search" className="mb-3 flex flex-wrap items-end gap-2">
        {filter.kind !== "store" && <input type="hidden" name="vid" value={filter.kind} />}
        {filter.status !== "all" && <input type="hidden" name="status" value={filter.status} />}
        <div className="relative min-w-56 flex-1">
          <label htmlFor="pay-q" className="sr-only">
            Търсене в плащанията
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-soft" aria-hidden />
          <input
            id="pay-q"
            name="q"
            type="search"
            defaultValue={filter.q}
            placeholder="Сума, име, имейл, последните 4 цифри на картата, бележка…"
            autoComplete="off"
            className="field h-11 bg-paper pl-11"
          />
        </div>
        <label className="text-sm text-ink-soft">
          От дата
          <input name="od" type="date" defaultValue={fromDay} className="field mt-1 block h-11 bg-paper" />
        </label>
        <label className="text-sm text-ink-soft">
          До дата
          <input name="do" type="date" defaultValue={toDay} className="field mt-1 block h-11 bg-paper" />
        </label>
        <button type="submit" className={`${btn.primary} h-11 px-5`}>
          Покажи
        </button>
        {(filter.q || fromDay || toDay) && (
          <Link href={href({ q: "", od: "", do: "" })} scroll={false} className={`${btn.ghost} h-11 px-4`} aria-label="Изчисти търсенето и датите">
            <X className="h-4 w-4" />
          </Link>
        )}
      </form>

      <ul className="no-scrollbar mb-4 flex gap-1 overflow-x-auto">
        {LEDGER_STATUSES.map((s) => (
          <li key={s}>
            <Link href={href({ status: s === "all" ? "" : s })} scroll={false} className={chip(filter.status === s)}>
              {STATUS_LABELS[s]}
            </Link>
          </li>
        ))}
      </ul>

      {t.paidN > 0 && (
        <Panel className="mb-4 grid grid-cols-2 gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-4">
          <div>
            <p className="text-ink-soft">Платени{narrowed || filter.kind !== "all" ? " в този избор" : ""}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatPrice(t.gross)}</p>
            <p className="text-ink-soft">
              {t.paidN === 1 ? "1 плащане" : `${t.paidN} плащания`}
              {t.n > t.paidN ? ` и ${t.n - t.paidN === 1 ? "1 неуспешен опит" : `${t.n - t.paidN} неуспешни опита`}` : ""}
            </p>
          </div>
          <div>
            <p className="text-ink-soft">Върнати на клиенти</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatPrice(t.refunded)}</p>
          </div>
          <div>
            <p className="text-ink-soft">Такси на Stripe</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatPrice(t.fee)}</p>
          </div>
          <div>
            <p className="text-ink-soft">Остават за магазина</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatPrice(t.gross - t.refunded - t.fee)}</p>
          </div>
        </Panel>
      )}

      {shown === 0 ? (
        <Panel>
          <p className="px-5 py-14 text-center text-ink-soft">
            {narrowed ? "Няма плащания за това търсене." : filter.kind === "store" ? "Още няма плащания през QR кода." : "Още няма плащания с карта."}
          </p>
        </Panel>
      ) : (
        <ul className="space-y-3">
          {plain.map((p) => (
            <li key={`s${p.id}`}>
              <PlainCard p={p} />
            </li>
          ))}
          {ledger.rows.map((row) => (
            <li key={row.p.id}>
              <PaymentCard row={row} />
            </li>
          ))}
        </ul>
      )}
      {ledger.more && (
        <p className="mt-4 text-center">
          <Link href={href({ n: String(filter.limit + PAGE * 2) })} scroll={false} className={btn.sm}>
            Покажи по-стари плащания
          </Link>
        </p>
      )}

      {stripeConfigured() && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
          <p>
            {ledger.synced ? `Данните от Stripe са към ${formatTimestamp(ledger.synced)} ч.` : "Историята от Stripe се зарежда за първи път, до минута ще е тук."}
            {ledger.syncError && <span className="mt-1 block text-tomato">Stripe не можа да се прочете: {ledger.syncError}</span>}
          </p>
          <form action={refreshStripeLedger}>
            <button type="submit" className={action}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Прочети всичко от Stripe отново
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default function Page({ searchParams }: PageProps<"/admin/plashtaniya">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <StorePayments searchParams={searchParams} />
    </Suspense>
  );
}
