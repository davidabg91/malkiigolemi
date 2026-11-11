import { eq } from "drizzle-orm";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { deletePromotion } from "@/actions/promotions";
import { AdminSkeleton, PageTitle, Panel } from "@/components/admin/bits";
import { PromotionForm, type PromotionInitial } from "@/components/admin/PromotionForm";
import { db } from "@/db";
import { promotionProducts, promotions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { newPromotionWindow, promotionFormOptions } from "@/lib/promotions-admin";
import { dateToSofiaInput } from "@/lib/time";

export const metadata: Metadata = { title: "Промоция" };

async function EditPromotion({ params }: Pick<PageProps<"/admin/promocii/[id]">, "params">) {
  await requireAdmin();
  const raw = (await params).id;
  const isNew = raw === "nova";
  const id = isNew ? null : Number(raw);
  if (!isNew && !Number.isInteger(id)) notFound();

  const [options, promo, items] = await Promise.all([
    promotionFormOptions(),
    id ? db.select().from(promotions).where(eq(promotions.id, id)).limit(1).then((r) => r[0]) : undefined,
    id ? db.select({ productId: promotionProducts.productId }).from(promotionProducts).where(eq(promotionProducts.promotionId, id)) : [],
  ]);
  if (id && !promo) notFound();

  const { start, end } = newPromotionWindow();
  const initial: PromotionInitial = promo
    ? {
        name: promo.name,
        percent: promo.percent,
        startsAt: dateToSofiaInput(promo.startsAt),
        endsAt: dateToSofiaInput(promo.endsAt),
        enabled: promo.enabled,
        categoryId: promo.categoryId,
        productIds: items.map((i) => i.productId),
      }
    : { name: "", percent: 10, startsAt: dateToSofiaInput(start), endsAt: dateToSofiaInput(end), enabled: true, categoryId: null, productIds: [] };

  return (
    <>
      <Link href="/admin/promocii" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Всички промоции
      </Link>
      <PageTitle
        title={promo ? promo.name : "Нова промоция"}
        action={
          promo && (
            <form action={deletePromotion.bind(null, promo.id)}>
              <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm font-semibold text-ink-soft transition hover:border-tomato hover:text-tomato">
                <Trash2 className="h-4 w-4" aria-hidden />
                Изтрий
              </button>
            </form>
          )
        }
      />
      <Panel className="max-w-3xl p-5 sm:p-6">
        <PromotionForm id={id} initial={initial} products={options.products} categories={options.categories} />
      </Panel>
    </>
  );
}

export default function Page({ params }: PageProps<"/admin/promocii/[id]">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <EditPromotion params={params} />
    </Suspense>
  );
}
