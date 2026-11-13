import { desc, eq } from "drizzle-orm";
import { Check, Mail, RotateCcw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { markWithdrawalConfirmed, toggleWithdrawalHandled } from "@/actions/withdrawal";
import { AdminSkeleton, PageTitle, Panel } from "@/components/admin/bits";
import { db } from "@/db";
import { orders, withdrawals } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatTimestamp } from "@/lib/format";
import { mailConfigured } from "@/lib/mail";
import { confirmationMailto, statementText } from "@/lib/withdrawals";

export const metadata: Metadata = { title: "Откази от договор" };

const action = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-sand hover:text-ink";

async function AdminWithdrawals() {
  await requireAdmin();
  const list = await db
    .select({ w: withdrawals, orderNumber: orders.number })
    .from(withdrawals)
    .leftJoin(orders, eq(orders.id, withdrawals.orderId))
    .orderBy(desc(withdrawals.createdAt))
    .limit(300);

  return (
    <>
      <PageTitle
        title="Откази от договор"
        sub="Подадени от „Откажете се от договора тук“. Законът изисква потвърждение до клиента по имейл до края на работния ден."
      />
      {!mailConfigured() && (
        <p className="mb-5 rounded-2xl bg-sun/30 px-4 py-3 text-sm">
          Автоматичните имейли не са настроени, затова изпращай потвърждението сам с „Изпрати потвърждение“ — отваря се готово писмо в пощата ти.
        </p>
      )}
      {list.length === 0 ? (
        <Panel>
          <p className="px-5 py-14 text-center text-ink-soft">Няма подадени откази.</p>
        </Panel>
      ) : (
        <ul className="space-y-3">
          {list.map(({ w, orderNumber }) => (
            <li key={w.id}>
              <Panel className={`p-5 ${w.handledAt ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{w.name}</span>
                      {w.handledAt ? (
                        <span className="rounded-full bg-sand px-2 py-0.5 text-xs font-semibold">Приключен</span>
                      ) : w.confirmedAt ? (
                        <span className="rounded-full bg-lime/50 px-2 py-0.5 text-xs font-semibold">Потвърден</span>
                      ) : (
                        <span className="rounded-full bg-tomato px-2 py-0.5 text-xs font-semibold text-white">Изпрати потвърждение</span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-ink-soft">
                      Получен {formatTimestamp(w.createdAt)} · {w.email}
                      {w.confirmedAt && <> · потвърден {formatTimestamp(w.confirmedAt)}</>}
                    </p>
                    <p className="mt-1 text-sm">
                      Поръчка{" "}
                      {w.orderId && orderNumber ? (
                        <Link href={`/admin/porachki/${w.orderId}`} className="font-semibold hover:text-forest">
                          {orderNumber}
                        </Link>
                      ) : (
                        <>
                          <span className="font-semibold">{w.orderNumber}</span> <span className="text-tomato">(няма такава поръчка — провери номера)</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {!w.confirmedAt && (
                      <>
                        <a href={confirmationMailto(w)} className={action}>
                          <Mail className="h-4 w-4" aria-hidden />
                          Изпрати потвърждение
                        </a>
                        <form action={markWithdrawalConfirmed.bind(null, w.id)}>
                          <button type="submit" className={action}>
                            <Check className="h-4 w-4" aria-hidden />
                            Изпратено
                          </button>
                        </form>
                      </>
                    )}
                    <form action={toggleWithdrawalHandled.bind(null, w.id, !w.handledAt)}>
                      <button type="submit" className={action}>
                        {w.handledAt ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                        {w.handledAt ? "Върни като открит" : "Приключи"}
                      </button>
                    </form>
                  </div>
                </div>
                <p className="mt-3 rounded-2xl bg-sand px-4 py-3 text-sm">{statementText(w)}</p>
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
      <AdminWithdrawals />
    </Suspense>
  );
}
