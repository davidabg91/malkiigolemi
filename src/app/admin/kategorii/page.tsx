import { asc, sql } from "drizzle-orm";
import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { IconPicker } from "@/components/admin/IconPicker";
import { AdminSkeleton, PageTitle, Panel } from "@/components/admin/bits";
import { DeleteButton, MoveCategory, ToggleCategoryActive } from "@/components/admin/RowActions";
import { db } from "@/db";
import { categories, products, type Category } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

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
    const n = countOf(c.id);
    const hasChildren = all.some((x) => x.parentId === c.id);
    const isActive = c.active !== false;
    // The categories shown next to this one, in order: the arrows swap it with its neighbours.
    const siblings = all.filter((x) => x.parentId === c.parentId).map((x) => x.id);
    return (
      <details className={`group border-line ${child ? "border-t" : ""}`}>
        <summary className={`flex min-h-14 list-none items-center gap-3 px-4 py-2 transition hover:bg-sand/60 [&::-webkit-details-marker]:hidden ${child ? "pl-12" : ""}`}>
          {!child && (
            <IconPicker value={c.icon} categoryId={c.id} categoryName={c.name} />
          )}
          <span className={`min-w-0 flex-1 truncate ${child ? "" : "font-semibold"} ${!isActive ? "text-ink-soft opacity-60" : ""}`}>
            {c.name}
            {!isActive && <span className="ml-2 text-xs font-normal text-tomato">(неактивна)</span>}
          </span>
          <MoveCategory ids={siblings} index={siblings.indexOf(c.id)} name={c.name} />
          <ToggleCategoryActive id={c.id} active={isActive} />
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
      <PageTitle title="Категории" sub="Две нива: основни категории и подкатегории. Натисни ред, за да го редактираш, иконата, за да я смениш, или стрелките, за да го преместиш." />

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
