import { ArrowDown, Lightbulb, Monitor, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminSkeleton, PageTitle, Panel, td, th } from "@/components/admin/bits";
import { BarList, Columns, Delta, StatTile } from "@/components/admin/charts";
import { getVisitStats, KEEP_DAYS, VISIT_PERIODS, type VisitPeriodId, type VisitStats } from "@/lib/analytics";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Посетители" };

const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");
const people = (n: number) => (n === 1 ? "човек" : "души");

/** 95 → "1 мин 35 сек". */
function duration(seconds: number) {
  const s = Math.round(seconds);
  if (s < 60) return `${s} сек`;
  return `${Math.floor(s / 60)} мин ${s % 60} сек`;
}

function Section({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <Panel className={`p-5 sm:p-6 ${className}`}>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {sub && <p className="mt-1 text-sm text-ink-soft">{sub}</p>}
      <div className="mt-5">{children}</div>
    </Panel>
  );
}

/** The path from a visit to an order, each step with how many of the previous one made it. */
function Funnel({ f }: { f: VisitStats["funnel"] }) {
  const steps = [
    { label: "Посетиха сайта", n: f.visitors },
    { label: "Разгледаха продукт", n: f.product },
    { label: "Сложиха в количката", n: f.cart },
    { label: "Стигнаха до поръчката", n: f.checkout },
    { label: "Поръчаха", n: f.order },
  ];
  return (
    <ol className="space-y-1.5">
      {steps.map((s, i) => (
        <li key={s.label}>
          {i > 0 && (
            <p className="flex items-center gap-1.5 py-1 pl-1 text-xs text-ink-soft">
              <ArrowDown className="h-3.5 w-3.5" aria-hidden />
              {percent(s.n, steps[i - 1].n)} продължават
            </p>
          )}
          <div className="relative overflow-hidden rounded-xl bg-sand">
            <div className="absolute inset-y-0 left-0 rounded-xl bg-lime" style={{ width: `${f.visitors ? Math.max(2, (s.n / f.visitors) * 100) : 0}%` }} />
            <div className="relative flex items-baseline justify-between gap-3 px-4 py-3">
              <span className="font-medium">{s.label}</span>
              <span className="font-bold tabular-nums">
                {s.n} <span className="text-xs font-normal text-ink-soft">{percent(s.n, f.visitors)}</span>
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Plain-language takeaways from the numbers, so the manager does not have to read every chart. */
function insights(s: VisitStats) {
  const out: string[] = [];
  const { funnel: f, kpis } = s;
  if (f.cart > 0) {
    out.push(
      f.abandoned > 0
        ? `${f.abandoned} от ${f.cart} ${people(f.cart)}, сложили нещо в количката, не са поръчали (${percent(f.abandoned, f.cart)}). Виж кои продукти остават в количката по-долу.`
        : "Всички, които сложиха нещо в количката, поръчаха.",
    );
  }
  if (f.cart > 0 && f.checkout < f.cart * 0.6) out.push("Много хора пълнят количката, но не отварят страницата за поръчка. Провери дали цената на доставката и бутонът „Поръчай“ се виждат ясно.");
  if (f.checkout > 0 && f.order < f.checkout * 0.5) out.push("Повече от половината, стигнали до поръчката, се отказват там. Формата или начините на плащане вероятно ги спират.");
  const peak = s.hours.reduce((a, b) => (b.views > a.views ? b : a), s.hours[0]);
  if (peak.views > 0) out.push(`Най-много хора разглеждат около ${peak.hour}:00 ч. — добър час за пост във Facebook групата или за пускане на промоция.`);
  const looked = s.products.find((p) => p.views >= 10 && p.adds === 0);
  if (looked) out.push(`„${looked.name}“ е разгледан ${looked.views} пъти, но никой не го е сложил в количката. Провери цената, снимката и описанието му.`);
  const mobile = s.devices.find((d) => d.device === "mobile")?.visitors ?? 0;
  const all = s.devices.reduce((a, d) => a + d.visitors, 0);
  if (all > 0 && mobile / all >= 0.6) out.push(`${percent(mobile, all)} от посетителите са на телефон — преглеждай новите продукти и снимки първо на телефон.`);
  if (kpis.bounce >= 0.5) out.push(`${Math.round(kpis.bounce * 100)}% от посещенията траят под 10 секунди. Първото, което виждат хората, не ги задържа.`);
  return out;
}

async function Visitors({ searchParams }: Pick<PageProps<"/admin/posetiteli">, "searchParams">) {
  await requireAdmin();
  const sp = await searchParams;
  const periodId = (VISIT_PERIODS.find((p) => p.id === sp.period)?.id ?? "7") as VisitPeriodId;
  const s = await getVisitStats(periodId);
  const { kpis, funnel } = s;
  const tab = (active: boolean) =>
    `inline-flex h-10 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition ${active ? "bg-ink text-cream" : "bg-paper shadow-soft hover:bg-lime"}`;
  const tips = insights(s);
  const deviceTotal = s.devices.reduce((a, d) => a + d.visitors, 0);

  return (
    <>
      <PageTitle
        title="Посетители"
        sub={`Какво правят хората в магазина. Анонимно и без бисквитки; твоите посещения като админ не се броят. Пази се ${KEEP_DAYS} дни назад.`}
        action={
          <p className="inline-flex items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm font-semibold shadow-soft">
            <span className={`h-2.5 w-2.5 rounded-full ${s.live > 0 ? "bg-forest motion-safe:animate-pulse" : "bg-line"}`} aria-hidden />
            В момента: {s.live} {people(s.live)}
          </p>
        }
      />

      <ul className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1" aria-label="Период">
        {VISIT_PERIODS.map((p) => (
          <li key={p.id}>
            <Link href={`/admin/posetiteli?period=${p.id}`} className={tab(p.id === periodId)} aria-current={p.id === periodId ? "true" : undefined}>
              {p.label}
            </Link>
          </li>
        ))}
      </ul>

      {!s.hasData ? (
        <Panel>
          <p className="px-5 py-14 text-center text-ink-soft">
            Още няма събрани посещения за този период. Броенето започва от пускането на тази страница — данните се появяват с първите посетители.
          </p>
        </Panel>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatTile
              label={s.period.days === 1 ? "Посетители днес" : "Посетители"}
              value={String(kpis.visitors)}
              hint={s.period.days > 1 ? `Средно ${kpis.perDay.toFixed(1).replace(".", ",")} на ден` : undefined}
            >
              <Delta now={kpis.visitors} prev={kpis.prevVisitors} />
            </StatTile>
            <StatTile
              label="Разгледани страници"
              value={String(kpis.views)}
              hint={kpis.visitors ? `Средно ${(kpis.views / kpis.visitors).toFixed(1).replace(".", ",")} страници на посещение` : undefined}
            />
            <StatTile label="Средно време в сайта" value={kpis.avgSeconds ? duration(kpis.avgSeconds) : "—"} hint={`${Math.round(kpis.bounce * 100)}% си тръгват до 10 секунди`} />
            <StatTile label="Сложиха в количката" value={`${funnel.cart} (${percent(funnel.cart, funnel.visitors)})`} hint="от всички посетители" />
            <StatTile
              label="Изоставени колички"
              value={funnel.cart ? `${funnel.abandoned} (${percent(funnel.abandoned, funnel.cart)})` : "—"}
              hint="сложиха продукт, но не поръчаха"
            />
            <StatTile
              label="Поръчаха"
              value={`${funnel.order} (${percent(funnel.order, funnel.visitors)})`}
              hint={kpis.orderValue ? `от посетителите · ${formatPrice(kpis.orderValue)} общо` : "от посетителите"}
            />
          </ul>

          <div className="mt-6 space-y-6">
            {tips.length > 0 && (
              <Section title="Какво показват числата">
                <ul className="space-y-2.5">
                  {tips.map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-[0.95rem]">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden />
                      {t}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {s.period.days > 1 && (
              <Section title="Посетители по дни" sub="Колко различни души са влизали всеки ден.">
                <Columns points={s.series.map((d) => ({ key: d.key, label: d.label, value: d.visitors, tip: `${d.visitors} ${people(d.visitors)} · ${d.views} страници` }))} />
              </Section>
            )}

            <div className="grid gap-6 xl:grid-cols-2">
              <Section title="От посещение до поръчка" sub="Къде по пътя се губят хората.">
                <Funnel f={funnel} />
              </Section>
              <Section title="В кои часове разглеждат" sub="Разгледани страници по час от денонощието (българско време).">
                <Columns points={s.hours.map((h) => ({ key: String(h.hour), label: `${h.hour}ч`, value: h.views, tip: `${h.views} страници` }))} labelEvery={3} />
              </Section>
            </div>

            <Section title="Най-гледани продукти" sub="Колко пъти е отворена страницата на продукта и колко пъти е сложен в количката.">
              {s.products.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-soft">Няма отворени продукти за този период.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-[0.95rem]">
                    <thead>
                      <tr>
                        <th className={th}>Продукт</th>
                        <th className={`${th} text-right`}>Гледания</th>
                        <th className={`${th} text-right`}>Души</th>
                        <th className={`${th} text-right`}>В количката</th>
                        <th className={`${th} text-right`}>Слагат го</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {s.products.map((p) => (
                        <tr key={p.id}>
                          <td className={td}>
                            <Link href={`/admin/produkti/${p.id}`} className="font-medium hover:text-forest hover:underline">
                              {p.name}
                            </Link>
                          </td>
                          <td className={`${td} text-right font-semibold tabular-nums`}>{p.views}</td>
                          <td className={`${td} text-right tabular-nums`}>{p.visitors}</td>
                          <td className={`${td} text-right tabular-nums`}>{p.adds}</td>
                          <td className={`${td} text-right tabular-nums`}>{percent(p.adds, p.views)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <div className="grid gap-6 xl:grid-cols-2">
              <Section title="Най-гледани категории" sub="Страницата на категорията плюс продуктите в нея.">
                <BarList
                  rows={s.categories.map((c) => ({ key: String(c.id), label: c.name, value: c.value, sub: `${c.pages} категория · ${c.products} продукти`, href: `/kategoria/${c.slug}` }))}
                />
              </Section>
              <Section title="Остават в количката" sub="Най-често слагани продукти и колко бройки реално са продадени за същия период.">
                <BarList
                  rows={s.cartAdds.map((c) => ({ key: String(c.id), label: c.name, value: c.adds, sub: `сложен · ${c.sold} продадени`, href: `/admin/produkti/${c.id}` }))}
                  empty="Никой не е слагал продукт в количката за този период."
                />
              </Section>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Section title="Къде натискат най-много" sub="Бутони и връзки, подредени по брой натискания.">
                <BarList rows={s.clicks.map((c) => ({ key: c.label, label: c.label, value: c.value, sub: `от ${c.visitors} ${people(c.visitors)}` }))} empty="Няма записани натискания за този период." />
              </Section>
              <Section title="Какво търсят" sub="Думите, които хората пишат в търсачката. Ако търсят нещо, което нямаш — добра идея за нов продукт.">
                <BarList rows={s.searches.map((q) => ({ key: q.label, label: q.label, value: q.value, href: `/tarsene?q=${encodeURIComponent(q.label)}` }))} empty="Никой не е търсил за този период." />
              </Section>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Section title="Кои части на сайта се гледат" sub="Разгледани страници по вид.">
                <BarList rows={s.kinds.map((k) => ({ key: k.key, label: k.label, value: k.value, sub: `от ${k.visitors} ${people(k.visitors)}` }))} />
              </Section>
              <Section title="Колко се задържат" sub="Средно време на екрана за едно отваряне на страница.">
                <BarList rows={s.timeByKind.map((k) => ({ key: k.key, label: k.label, value: k.value }))} format={duration} empty="Още няма измерено време." />
              </Section>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Section title="Откъде идват" sub="Сайтът, от който посетителят е дошъл. „директно“ значи написан адрес, отметка или приложение.">
                <BarList rows={s.sources.map((x) => ({ key: x.label, label: x.label, value: x.value }))} />
              </Section>
              <Section title="Телефон или компютър">
                <ul className="grid gap-3 sm:grid-cols-2">
                  {(["mobile", "desktop"] as const).map((kind) => {
                    const v = s.devices.find((d) => d.device === kind)?.visitors ?? 0;
                    const Icon = kind === "mobile" ? Smartphone : Monitor;
                    return (
                      <li key={kind} className="rounded-2xl bg-sand p-4">
                        <p className="flex items-center gap-2 text-sm text-ink-soft">
                          <Icon className="h-4 w-4" aria-hidden />
                          {kind === "mobile" ? "Телефон" : "Компютър и таблет"}
                        </p>
                        <p className="mt-1 text-2xl font-bold tabular-nums">{percent(v, deviceTotal)}</p>
                        <p className="text-xs text-ink-soft">
                          {v} {people(v)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function Page({ searchParams }: PageProps<"/admin/posetiteli">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Visitors searchParams={searchParams} />
    </Suspense>
  );
}
