import { asc, sql } from "drizzle-orm";
import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { toggleCategoryActive } from "@/actions/admin";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { AdminSkeleton, PageTitle, Panel } from "@/components/admin/bits";
import { DeleteButton } from "@/components/admin/RowActions";
import { CategoryIcon } from "@/components/ui";
import { db } from "@/db";
import { categories, products, type Category } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { TONES } from "@/lib/site";

export const metadata: Metadata = { title: "Категории" };

async function AdminCategories() {
  await requireAdmin();
  const [all, counts] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sort), asc(categories.id)),
    db.select({ id: products.categoryId, n: sql<number>`count(*)` }).from(products).groupBy(products.categoryId),
  ]);
  const countOf = (id: number) => counts.find((c) => c.id === id)?.n ?? 0;
  const roots = all.filter((c) => c.parentId === null);
  const rootOptions = roots.map((r) => ({ id: r.id, name: r.name }));

  const Row = ({ c, child }: { c: Category; child?: boolean }) => {
    const tone = TONES[c.tone] ?? TONES.cream;
    const n = countOf(c.id);
    const hasChildren = all.some((x) => x.parentId === c.id);
    return (
      <details className={`group border-line ${child ? "border-t" : ""}`}>
        <summary className={`flex min-h-14 list-none items-center gap-3 px-4 py-2 transition hover:bg-sand/60 [&::-webkit-details-marker]:hidden ${child ? "pl-12" : ""}`}>
          {!child && (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: tone.bg, color: tone.ink }}>
              <CategoryIcon name={c.icon} className="h-5 w-5" />
            </span>
          )}
          <span className={`min-w-0 flex-1 truncate ${child ? "" : "font-semibold"} ${!c.active ? "text-ink-soft opacity-60" : ""}`}>
            {c.name}
            {!c.active && <span className="ml-2 text-xs font-normal text-tomato">(неактивна)</span>}
          </span>
          <form action={toggleCategoryActive.bind(null, c.id)} onClick={(e) => e.stopPropagation()}>
            <button
              type="submit"
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
                c.active
                  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
              title={c.active ? "Натисни за деактивиране" : "Натисни за активиране"}
            >
              {c.active ? "Активна" : "Неактивна"}
            </button>
          </form>
          <span className="text-sm text-ink-soft tabular-nums">{n} прод.</span>
          {n === 0 && !hasChildren ? <DeleteButton id={c.id} name={c.name} kind="category" /> : <span className="w-9" aria-hidden />}
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-soft transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="border-t border-line bg-sand/40 p-4">
          <CategoryForm category={c} roots={rootOptions} />
        </div>
      </details>
    );
  };

  return (
    <>
      <PageTitle title="Категории" sub="Две нива: основни категории и подкатегории. Натисни ред, за да го редактираш." />

      <Panel className="mb-6 p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">Нова категория</h2>
        <CategoryForm roots={rootOptions} />
      </Panel>

      <div className="space-y-4">
        {roots.map((r) => (
          <Panel key={r.id} className="overflow-hidden">
            <Row c={r} />
            {all
              .filter((c) => c.parentId === r.id)
              .map((c) => (
                <Row key={c.id} c={c} child />
              ))}
          </Panel>
        ))}
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminCategories />
    </Suspense>
  );
}
