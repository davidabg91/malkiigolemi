import { AlertTriangle, CheckCircle2, CircleSlash, ExternalLink, Hand, MessageCircle, RefreshCw, Timer, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { AdminSkeleton, PageTitle, Panel, td, th } from "@/components/admin/bits";
import { Columns, StatTile } from "@/components/admin/charts";
import { FbAutoReplyForm } from "@/components/admin/FbAutoReplyForm";
import { FbExtensionCard } from "@/components/admin/FbExtensionCard";
import { FbOrdersForm } from "@/components/admin/FbOrdersForm";
import { FbOutboxMarker } from "@/components/admin/FbOutboxMarker";
import { FbReviewItem } from "@/components/admin/FbReviewItem";
import { requireAdmin } from "@/lib/auth";
import { fbExtensionToken } from "@/lib/fb-ingest";
import { ago, FB_PERIODS, fbDashboard, fbHealth, type FbPeriodId, runProblem } from "@/lib/fb-monitor";
import { fbMessageError, getFbOrderSettings } from "@/lib/fb-orders";
import { FB_REPLY_LIMITS, getFbReplySettings } from "@/lib/fb-reply";
import { formatDate, formatPrice } from "@/lib/format";
import extension from "../../../../extension/manifest.json";

export const metadata: Metadata = { title: "Поръчки от Facebook" };

const clock = new Intl.DateTimeFormat("bg-BG", { timeZone: "Europe/Sofia", hour: "2-digit", minute: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("bg-BG", { timeZone: "Europe/Sofia", day: "numeric", month: "numeric" });
const sameDay = (a: number, b: number) => dayLabel.format(a) === dayLabel.format(b);
/** "14:35", or "утре в 08:10" / "12.11 в 08:10" when it is not today. */
const whenAt = (at: number, now: number) => (sameDay(at, now) ? clock.format(at) : `${sameDay(at, now + 86400000) ? "утре" : dayLabel.format(at)} в ${clock.format(at)}`);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const bgDay = (day: string) => day.split("-").reverse().join(".");
/** "на 20.11.2026", "от 20.11.2026 до 22.11.2026", "от 25.11.2026 нататък" */
const collectDays = (p: { from: string; to: string | null }) => (!p.to ? `от ${bgDay(p.from)} нататък` : p.to === p.from ? `на ${bgDay(p.from)}` : `от ${bgDay(p.from)} до ${bgDay(p.to)}`);

const RUN_KIND = { auto: "Автоматично", manual: "На ръка, всички постове", post: "На ръка, един пост" } as const;
const MESSAGE_PROBLEMS: Record<string, string> = {
  "no-button": "човекът не приема съобщения от този профил",
  "no-box": "чатът не се отвори",
  "wrong-person": "отвори се чат с друг човек",
  draft: "в чата има започнато съобщение",
  "not-sent": "Facebook не прие съобщението",
  "no-type": "текстът не можа да се напише в чата",
  "no-focus": "прозорецът на скрипта остана зад друг прозорец",
  "no-send": "бутонът за изпращане не се появи",
  "no-profile": "профилът на човека не се отвори",
  timeout: "страницата не се зареди навреме",
  unsure: "не е сигурно дали е тръгнало",
};

const HEALTH_STYLE = {
  ok: { box: "bg-[#cdebd3] text-[#0f3d26]", Icon: CheckCircle2 },
  warn: { box: "bg-sun/40 text-ink", Icon: AlertTriangle },
  bad: { box: "bg-tomato/15 text-ink ring-2 ring-tomato", Icon: XCircle },
  idle: { box: "bg-paper text-ink", Icon: CircleSlash },
} as const;

async function AdminFacebook({ searchParams }: Pick<PageProps<"/admin/facebook">, "searchParams">) {
  await requireAdmin();
  const asked = String((await searchParams).period ?? "");
  const period: FbPeriodId = FB_PERIODS.some((p) => p.id === asked) ? (asked as FbPeriodId) : "7";
  const [data, reply, orderSettings] = await Promise.all([fbDashboard(period), getFbReplySettings(), getFbOrderSettings()]);
  const { now, state, lastRun, stats } = data;
  const failedMessages = data.openMessages.filter((m) => m.message.status === "failed").length;
  const waitingMessages = data.openMessages.filter((m) => m.message.status === "pending").length;
  const health = fbHealth({ state, lastRun, latestVersion: extension.version, failedMessages, waitingMessages, now });
  const style = HEALTH_STYLE[health.level];
  // Posts read by an older extension leave no run behind: the last reading of any post still tells when it last worked.
  const lastRead = lastRun?.finishedAt.getTime() ?? Math.max(0, ...data.posts.map((p) => p.syncedAt?.getTime() ?? 0));
  const periodLabel = FB_PERIODS.find((p) => p.id === period)!.label.toLowerCase();

  const customerComments = stats.comments - stats.answers;
  const bySelf = customerComments > 0 ? Math.round((stats.orderedAuto / customerComments) * 100) : null;
  const pendingNow = data.review.filter((r) => !r.unclear).length;
  const unclearNow = data.review.length - pendingNow;
  const demandTotal = data.demand.reduce((sum, d) => sum + d.ordered, 0);

  return (
    <>
      <AutoRefresh seconds={60} />
      <PageTitle
        title="Поръчки от Facebook"
        sub="Какво е събрал скриптът от групата, колко да се поръча и кои коментари чакат човек."
        action={
          <nav aria-label="Период" className="flex rounded-full bg-paper p-1 shadow-soft">
            {FB_PERIODS.map((p) => (
              <Link
                key={p.id}
                href={p.id === "7" ? "/admin/facebook" : `/admin/facebook?period=${p.id}`}
                aria-current={p.id === period ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${p.id === period ? "bg-forest text-cream" : "text-ink-soft hover:text-ink"}`}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        }
      />
      <FbOutboxMarker pending={waitingMessages} />

      {/* Is the script all right? */}
      <section className={`mb-6 rounded-card p-5 shadow-soft sm:p-6 ${style.box}`} aria-label="Състояние на скрипта">
        <div className="flex flex-wrap items-start gap-4">
          <style.Icon className="mt-0.5 h-8 w-8 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-semibold">{health.title}</h2>
            {health.notes.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.95rem]">
                {health.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[0.95rem]">Събира по график, постовете се отварят и няма неизпратени съобщения.</p>
            )}
          </div>
        </div>
        <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="opacity-70">Последно събиране</dt>
            <dd className="font-semibold">{lastRead > 0 ? `${ago(now - lastRead)}${lastRun ? ` · ${RUN_KIND[lastRun.kind].toLowerCase()}` : ""}` : "още няма"}</dd>
          </div>
          <div>
            <dt className="opacity-70">Следващо автоматично</dt>
            <dd className="font-semibold">
              {!state ? "няма данни" : !state.auto.enabled ? "изключено" : state.nextAt ? `около ${whenAt(state.nextAt, now)}` : "няма насрочено"}
              {state?.auto.enabled && <span className="font-normal opacity-70"> · през {state.auto.min}–{state.auto.max} мин, {state.auto.from}–{state.auto.to} ч</span>}
            </dd>
          </div>
          <div>
            <dt className="opacity-70">Разширение</dt>
            <dd className="font-semibold">
              {state ? `версия ${state.version}` : "не се е обаждало"}
              {state && <span className="font-normal opacity-70"> · обади се {ago(now - state.at)}</span>}
            </dd>
          </div>
          <div>
            <dt className="opacity-70">Съобщения до клиенти</dt>
            <dd className="font-semibold">{waitingMessages + failedMessages === 0 ? "няма чакащи" : `${waitingMessages} чакат${failedMessages > 0 ? ` · ${failedMessages} неуспешни` : ""}`}</dd>
          </div>
        </dl>
      </section>

      {/* The period's numbers */}
      <ul className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={`Прочетени коментари (${periodLabel})`} value={String(stats.comments)} hint={`Отговори на магазина и под други коментари: ${stats.answers}`} />
        <StatTile
          label="Станали поръчки"
          value={String(stats.orderedAll)}
          hint={`${stats.orderedAuto} сами · ${stats.orderedByHand} добавени от човек${bySelf != null ? ` · ${bySelf}% от коментарите на клиенти минават без човек` : ""}`}
        />
        <li className={`rounded-card p-5 shadow-soft ${data.review.length > 0 ? "bg-sun/30 ring-2 ring-sun" : "bg-paper"}`}>
          <p className="text-sm text-ink-soft">За проверка сега</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{data.review.length}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {data.review.length === 0 ? "Всеки коментар е или в поръчка, или отметнат." : `${pendingNow} чакат · ${unclearNow} не са разпознати като поръчка`}
          </p>
        </li>
        <StatTile label="Клиенти с поръчка" value={String(stats.people)} hint={`${plural(stats.orders, "поръчка", "поръчки")} · ${stats.pieces} бр · ${formatPrice(stats.total)}`} />
        <StatTile label="Отговори под коментари" value={String(stats.replied)} hint={reply.enabled ? "„Записвам си“ от скрипта или отговор на ръка" : "Автоматичният отговор е изключен"} />
        <StatTile label="Готови за взимане" value={String(stats.readyOrders)} hint={`${plural(stats.messages.sent, "съобщение изпратено", "съобщения изпратени")} в чата${stats.messages.failed > 0 ? ` · ${stats.messages.failed} неуспешни` : ""}`} />
        <StatTile label="Постове, които скриптът следи" value={String(data.posts.filter((p) => !p.closedAt).length)} hint={`${data.posts.filter((p) => p.closedAt).length} спрени · следи пост 14 дни`} />
        <StatTile label="Пропуснати от човек" value={String(stats.dismissed)} hint="Коментари, отметнати като „не е поръчка“" />
      </ul>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {/* Comments a person should look at */}
        <Panel>
          <div className="px-5 pt-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Hand className="h-5 w-5 text-forest" aria-hidden />
              За проверка
              {data.review.length > 0 && <span className="rounded-full bg-sun/60 px-2.5 py-0.5 text-sm font-bold tabular-nums">{data.review.length}</span>}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">Коментари, които скриптът не е сложил сам в поръчка. Виж какво пише и реши: добави го към поръчката на човека с нужния брой, или го отметни.</p>
          </div>
          {data.review.length === 0 ? (
            <p className="px-5 py-10 text-center text-ink-soft">Няма коментари за проверка.</p>
          ) : (
            <ul className="mt-3 max-h-[46rem] divide-y divide-line overflow-y-auto border-t border-line">
              {data.review.map((r) => (
                <FbReviewItem
                  key={r.claim.id}
                  row={{
                    id: r.claim.id,
                    name: r.claim.name,
                    comment: r.claim.comment,
                    qty: r.claim.qty,
                    postId: r.post.id,
                    postName: r.post.name,
                    link: r.post.url && r.claim.fbCommentId ? `${r.post.url}${r.post.url.includes("?") ? "&" : "?"}comment_id=${r.claim.fbCommentId}` : r.post.url,
                    hasProduct: r.post.hasProduct,
                    colors: r.colors,
                    stock: r.stock,
                    why: r.why,
                    unclear: r.unclear,
                    when: formatDate(r.claim.createdAt),
                  }}
                />
              ))}
            </ul>
          )}
        </Panel>

        {/* How much of each product people asked for */}
        <Panel>
          <div className="px-5 pt-5">
            <h2 className="font-display text-lg font-semibold">Колко да се поръча</h2>
            <p className="mt-1 text-sm text-ink-soft">Бройките по продукти в отворените поръчки от групата, които още чакат стоката. Общо {demandTotal} бр.</p>
          </div>
          {data.demand.length === 0 ? (
            <p className="px-5 py-10 text-center text-ink-soft">Още няма поръчки от групата.</p>
          ) : (
            <div className="mt-2 overflow-x-auto p-1">
              <table className="w-full min-w-[34rem] text-[0.95rem]">
                <thead>
                  <tr>
                    <th className={th}>Продукт</th>
                    <th className={`${th} text-right`}>Поръчани</th>
                    <th className={`${th} text-right`}>Чакат проверка</th>
                    <th className={`${th} text-right`}>Готови</th>
                    <th className={`${th} text-right`}>В сайта</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.demand.map((d) => (
                    <tr key={d.key}>
                      <td className={td}>
                        {d.productId != null ? (
                          <Link href={`/admin/produkti/${d.productId}`} className="font-medium hover:text-forest">
                            {d.name}
                          </Link>
                        ) : (
                          <span className="font-medium">{d.name}</span>
                        )}
                      </td>
                      <td className={`${td} text-right tabular-nums`}>
                        <span className="text-lg font-bold">{d.ordered}</span> бр
                        <p className="text-xs text-ink-soft">{plural(d.people, "човек", "души")}</p>
                      </td>
                      <td className={`${td} text-right tabular-nums ${d.waiting > 0 ? "font-semibold" : "text-ink-soft"}`}>{d.waiting > 0 ? `${d.waiting} бр` : "—"}</td>
                      <td className={`${td} text-right tabular-nums text-ink-soft`}>{d.ready > 0 ? `${d.ready} бр` : "—"}</td>
                      <td className={`${td} text-right tabular-nums`}>
                        {d.stock == null ? <span className="text-ink-soft">—</span> : <span className={d.stock < d.waiting ? "font-semibold text-tomato" : ""}>{d.stock} бр</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-line px-5 py-3 text-xs text-ink-soft">
            „Поръчани“ вече са извадени от наличността в сайта. „Чакат проверка“ са бройки от коментари, които още не са в поръчка. „Готови“ са в поръчки, отбелязани „Готова за взимане“.
          </p>
        </Panel>
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* The posts the script walks through */}
        <Panel>
          <div className="px-5 pt-5">
            <h2 className="font-display text-lg font-semibold">Постове</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Всеки пост, който скриптът е обходил, с продукта му и какво е станало с коментарите.
              {data.periods.length > 0 && (
                <>
                  {" "}
                  Събира от постове, публикувани <span className="font-semibold text-ink">{data.periods.map(collectDays).join("; ")}</span>; останалите подминава.
                </>
              )}
            </p>
          </div>
          {data.posts.length === 0 ? (
            <p className="px-5 py-10 text-center text-ink-soft">Скриптът още не е прочел нито един пост.</p>
          ) : (
            <div className="mt-2 overflow-x-auto p-1">
              <table className="w-full min-w-[36rem] text-[0.95rem]">
                <thead>
                  <tr>
                    <th className={th}>Продукт в поста</th>
                    <th className={`${th} text-right`}>Коментари</th>
                    <th className={`${th} text-right`}>Поръчки</th>
                    <th className={`${th} text-right`}>За проверка</th>
                    <th className={`${th} text-right`}>Четен</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.posts.map((p) => {
                    const toCheck = p.pending + p.unclear;
                    return (
                      <tr key={p.id} className="transition hover:bg-sand/60">
                        <td className={td}>
                          <Link href={`/admin/facebook/${p.id}`} className="font-semibold hover:text-forest">
                            {p.productName}
                          </Link>
                          <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
                            {!p.productId && p.price == null ? <span className="font-semibold text-tomato">няма избран продукт</span> : <span>{p.productId ? "продукт от сайта" : "ръчно въведен продукт"}</span>}
                            {p.closedAt && <span className="rounded bg-sand px-1.5 py-0.5 font-semibold">спрян</span>}
                            {p.url && (
                              <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                                във Facebook <ExternalLink className="h-3 w-3" aria-hidden />
                              </a>
                            )}
                          </p>
                        </td>
                        <td className={`${td} text-right tabular-nums`}>{p.comments}</td>
                        <td className={`${td} text-right tabular-nums`}>
                          <span className="font-semibold">{p.ordered}</span>
                          <p className="text-xs text-ink-soft">{p.orderedQty} бр</p>
                        </td>
                        <td className={`${td} text-right`}>
                          {toCheck > 0 ? <span className="rounded-full bg-sun/50 px-2.5 py-1 text-xs font-bold tabular-nums">{toCheck}</span> : <span className="text-xs font-semibold text-forest">няма</span>}
                        </td>
                        <td className={`${td} whitespace-nowrap text-right text-xs text-ink-soft`}>{p.syncedAt ? ago(now - p.syncedAt.getTime()) : "на ръка"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel className="p-5">
            <h2 className="font-display text-lg font-semibold">Коментари по дни</h2>
            <p className="mb-4 mt-1 text-sm text-ink-soft">Последните 14 дни. Посочи колона, за да видиш колко от коментарите са станали поръчки.</p>
            <Columns
              height="h-36"
              points={data.days.map((d) => ({
                key: d.day,
                label: `${Number(d.day.slice(8))}.${Number(d.day.slice(5, 7))}`,
                value: d.comments,
                tip: `${plural(d.comments, "коментар", "коментара")}, ${plural(d.ordered, "поръчка", "поръчки")}`,
              }))}
            />
          </Panel>

          {/* What the script did, run by run */}
          <Panel>
            <h2 className="flex items-center gap-2 px-5 pt-5 font-display text-lg font-semibold">
              <RefreshCw className="h-5 w-5 text-forest" aria-hidden />
              Дневник на скрипта
            </h2>
            {data.runs.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-soft">Още няма записани събирания. Записват се от версия 1.4.0 на разширението нататък.</p>
            ) : (
              <ol className="mt-3 divide-y divide-line border-t border-line">
                {data.runs.map((r) => {
                  const took = Math.max(1, Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000));
                  const problem = runProblem(r.problem);
                  return (
                    <li key={r.id} className="px-5 py-3 text-sm">
                      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="font-semibold">
                          {RUN_KIND[r.kind]}
                          {r.stopped && <span className="ml-2 rounded bg-sand px-1.5 py-0.5 text-xs">прекъснато</span>}
                        </span>
                        <span className="text-xs text-ink-soft">
                          {formatDate(r.finishedAt)} · <Timer className="inline h-3 w-3" aria-hidden /> {took >= 60 ? `${Math.round(took / 60)} мин` : `${took} сек`}
                        </span>
                      </p>
                      <p className="mt-0.5 text-ink-soft">
                        {plural(r.visited, "пост", "поста")}
                        {r.failed > 0 && <span className="font-semibold text-tomato"> ({r.failed} {r.failed === 1 ? "не се отвори" : "не се отвориха"})</span>} · {plural(r.added, "нова заявка", "нови заявки")} · {r.ordered} в поръчки
                        {r.replied > 0 && ` · ${plural(r.replied, "отговор", "отговора")}`}
                        {r.skippedOld > 0 && ` · ${plural(r.skippedOld, "пост извън датите подминат", "поста извън датите подминати")}`}
                      </p>
                      {problem && <p className="mt-0.5 font-medium text-tomato">{problem}</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          {data.openMessages.length > 0 && (
            <Panel>
              <h2 className="flex items-center gap-2 px-5 pt-5 font-display text-lg font-semibold">
                <MessageCircle className="h-5 w-5 text-forest" aria-hidden />
                Съобщения до клиенти
              </h2>
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {data.openMessages.map(({ message, order }) => (
                  <li key={message.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-5 py-3 text-sm">
                    <span>
                      <span className="font-semibold">{message.name}</span>{" "}
                      <span className={message.status === "failed" ? "font-medium text-tomato" : "text-ink-soft"}>
                        {message.status === "failed" ? `не е изпратено: ${MESSAGE_PROBLEMS[fbMessageError(message.error).code] ?? message.error}` : "чака разширението"}
                      </span>
                    </span>
                    <Link href={`/admin/porachki/${order.id}`} className="font-semibold text-forest hover:underline">
                      {order.number}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>

      <h2 className="mb-4 mt-10 font-display text-xl font-semibold">Настройки и инсталация</h2>
      <div className="space-y-6">
        <FbExtensionCard token={fbExtensionToken()} latest={extension.version} />
        <FbOrdersForm auto={orderSettings.auto} message={orderSettings.message} periods={orderSettings.periods} />
        <FbAutoReplyForm enabled={reply.enabled} text={reply.text} pauseSeconds={FB_REPLY_LIMITS.pauseMs / 1000} perRun={FB_REPLY_LIMITS.perRun} maxAgeHours={FB_REPLY_LIMITS.maxAgeHours} />
      </div>
    </>
  );
}

export default function Page({ searchParams }: PageProps<"/admin/facebook">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminFacebook searchParams={searchParams} />
    </Suspense>
  );
}
