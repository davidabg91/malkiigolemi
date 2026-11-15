import { asc, sql } from "drizzle-orm";
import { ChevronDown, CornerDownRight, Plus } from "lucide-react";
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
    const canDelete = n === 0 && !hasChildren;
    return (
      <details className={`group border-line ${child ? "border-t" : ""}`}>
        {/* On a phone the name comes first, on a line of its own if it has to, with the status under it; on a wide screen all of it is one line. */}
        <summary
          className={`flex min-h-16 cursor-pointer list-none items-center gap-2 py-2 pr-3 transition hover:bg-sand/60 group-open:bg-sand/60 sm:min-h-14 sm:gap-3 sm:pr-4 [&::-webkit-details-marker]:hidden ${
            child ? "pl-4 sm:pl-12" : "pl-3 sm:pl-4"
          }`}
        >
          {child ? (
            <CornerDownRight className="h-4 w-4 shrink-0 text-ink-soft/60 sm:hidden" aria-hidden />
          ) : (
            <IconPicker value={c.icon} categoryId={c.id} categoryName={c.name} />
          )}
          <span className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
            <span className={`line-clamp-2 leading-snug sm:line-clamp-none sm:min-w-0 sm:flex-1 sm:truncate ${child ? "" : "font-semibold"} ${isActive ? "" : "text-ink-soft"}`}>
              {c.name}
            </span>
            <span className="mt-1 flex items-center gap-2 sm:mt-0 sm:gap-3">
              <ToggleCategoryActive id={c.id} active={isActive} />
              <span className="whitespace-nowrap text-sm text-ink-soft tabular-nums">{n} прод.</span>
            </span>
          </span>
          <MoveCategory ids={siblings} index={siblings.indexOf(c.id)} name={c.name} />
          {/* On a phone "delete" lives in the opened panel, away from the arrows. */}
          <span className="hidden w-9 shrink-0 sm:block">{canDelete && <DeleteButton id={c.id} name={c.name} kind="category" />}</span>
          <ChevronDown className="h-5 w-5 shrink-0 text-ink-soft transition-transform group-open:rotate-180 sm:h-4 sm:w-4" aria-hidden />
        </summary>
        <div className="border-t border-line bg-sand/40 p-3 sm:p-4">
          <CategoryForm category={c} roots={rootOptions} />
          <div className="mt-3 border-t border-line pt-2 sm:hidden">
            {canDelete ? (
              <DeleteButton id={c.id} name={c.name} kind="category" label="Изтрий категорията" />
            ) : (
              <p className="px-1 py-2 text-xs text-ink-soft">Категория с продукти или подкатегории не може да се изтрие.</p>
            )}
          </div>
        </div>
      </details>
    );
  };

  return (
    <>
      <PageTitle title="Категории" sub="Натисни категория, за да я редактираш. Стрелките я местят нагоре и надолу, а иконата се сменя с едно докосване." />

      {/* Closed until asked for, so the list itself starts at the top of a phone's screen. */}
      <Panel className="mb-4 overflow-hidden sm:mb-6">
        <details className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 font-display text-lg font-semibold transition hover:bg-sand/60 [&::-webkit-details-marker]:hidden">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest text-white">
              <Plus className="h-5 w-5" aria-hidden />
            </span>
            <span className="flex-1">Нова категория</span>
            <ChevronDown className="h-5 w-5 shrink-0 text-ink-soft transition-transform group-open:rotate-180 sm:h-4 sm:w-4" aria-hidden />
          </summary>
          <div className="border-t border-line p-3 sm:p-5">
            <CategoryForm roots={rootOptions} />
          </div>
        </details>
      </Panel>

      <div className="space-y-3 sm:space-y-4">
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
