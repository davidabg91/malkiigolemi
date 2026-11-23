import { asc, desc, eq, sql } from "drizzle-orm";
import { ArrowLeft, ExternalLink, MessageCircleReply, Pause, Play, RotateCcw, Trash2, UserCheck, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { deleteFbPost, setClaimStatus, setFbPostClosed, setFbPostProduct } from "@/actions/facebook";
import { AdminSkeleton, Panel } from "@/components/admin/bits";
import { ClaimOrderForm, type ClaimPrefill } from "@/components/admin/ClaimOrderForm";
import { FlagBadge } from "@/components/admin/Flag";
import { btn } from "@/components/ui";
import { db } from "@/db";
import { type FbClaim, fbClaims, fbContacts, fbPosts, orders, products, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { savedOffice } from "@/lib/courier-offices";
import { isCourierId } from "@/lib/couriers";
import { fbContactKey } from "@/lib/fb-contacts";
import { findFlag, getFlagIndex } from "@/lib/flags";
import { formatDate, formatPrice } from "@/lib/format";
import { DELIVERY_METHODS, type DeliveryId } from "@/lib/site";
import { colorChoices } from "@/lib/product-colors";

export const metadata: Metadata = { title: "Пост от Facebook" };

const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
const isDelivery = (v: string | null | undefined): v is DeliveryId => DELIVERY_METHODS.some((m) => m.id === v);

async function AdminFbPost({ params }: Pick<PageProps<"/admin/facebook/[id]">, "params">) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [post] = await db.select().from(fbPosts).where(eq(fbPosts.id, id)).limit(1);
  if (!post) notFound();

  const [claims, product, people, pastOrders, flags, remembered] = await Promise.all([
    db.select().from(fbClaims).where(eq(fbClaims.postId, id)).orderBy(asc(fbClaims.id)),
    post.productId ? db.select().from(products).where(eq(products.id, post.productId)).limit(1).then((r) => r[0]) : undefined,
    db.select().from(users),
    // The newest order per name: Facebook names are matched to people who already ordered.
    db
      .select({
        name: orders.name,
        phone: orders.phone,
        email: orders.email,
        delivery: orders.delivery,
        courier: orders.courier,
        officeCode: orders.officeCode,
        city: orders.city,
        address: orders.address,
        userId: orders.userId,
      })
      .from(orders)
      .where(sql`${orders.status} != 'cancelled'`)
      .orderBy(desc(orders.createdAt))
      .limit(5000),
    getFlagIndex(),
    db.select().from(fbContacts),
  ]);
  const rememberedByKey = new Map(remembered.map((r) => [r.key, r]));
  // A post read by the extension that points to no product of the shop: the admin picks one before ordering.
  const needsProduct = !post.productId && post.price == null;
  const productChoices = needsProduct
    ? await db.select({ id: products.id, name: products.name, unit: products.unit, stock: products.stock }).from(products).where(eq(products.active, true)).orderBy(asc(products.name))
    : [];

  const userByName = new Map<string, (typeof people)[number]>();
  for (const u of people) if (!userByName.has(key(u.name))) userByName.set(key(u.name), u);
  const orderByName = new Map<string, (typeof pastOrders)[number]>();
  for (const o of pastOrders) if (!orderByName.has(key(o.name))) orderByName.set(key(o.name), o);

  /**
   * Fills the order form for a commenter: first with what was used for this Facebook name last time,
   * then from their account or last order in the shop. With nothing known it starts as store pickup.
   */
  const prefillFor = (name: string): { prefill: ClaimPrefill; known: "user" | "order" | null; userId: number | null } => {
    const fb = rememberedByKey.get(fbContactKey(name));
    const u = userByName.get(key(name));
    const o = orderByName.get(key(name));
    const known = u ? "user" : o ? "order" : null;
    const userId = u?.id ?? o?.userId ?? null;

    if (fb) {
      const delivery = isDelivery(fb.delivery) ? fb.delivery : "store";
      return {
        known,
        userId,
        prefill: {
          name: fb.name,
          phone: fb.phone,
          email: fb.email,
          delivery,
          courier: isCourierId(fb.courier) ? fb.courier : "",
          office: savedOffice(delivery, fb.courier, fb.officeCode),
          city: fb.city,
          address: fb.address,
          from: "facebook",
        },
      };
    }
    const delivery: DeliveryId = isDelivery(o?.delivery) ? o.delivery : isDelivery(u?.preferredDelivery) ? u.preferredDelivery : "store";
    const courier = o?.courier ?? u?.preferredCourier ?? "";
    const officeCode = o ? o.officeCode : (u?.preferredOfficeCode ?? null);
    return {
      known,
      userId,
      prefill: {
        name: u?.name ?? o?.name ?? name,
        phone: o?.phone ?? u?.phone ?? "",
        email: u?.email ?? o?.email ?? "",
        delivery,
        courier: isCourierId(courier) ? courier : "",
        office: savedOffice(delivery, courier || null, officeCode),
        city: o?.city ?? u?.city ?? "",
        address: o?.address ?? u?.address ?? "",
        from: o ? "order" : u ? "user" : null,
      },
    };
  };

  const active = claims.filter((c) => c.status !== "rejected");
  const wanted = active.reduce((s, c) => s + c.qty, 0);
  const pendingUnits = claims.filter((c) => c.status === "pending").reduce((s, c) => s + c.qty, 0);
  const done = claims.filter((c) => c.status === "ordered").length;
  const tiles = [
    { label: "Заявки", value: `${active.length}`, hint: `${wanted} бр общо` },
    { label: "Превърнати в поръчки", value: `${done} от ${active.length}` },
    { label: "Чакат", value: `${pendingUnits} бр`, warn: product ? pendingUnits > product.stock : false },
    product
      ? { label: "Наличност", value: `${product.stock} бр`, hint: formatPrice(product.price) }
      : post.productId
        ? { label: "Наличност", value: "—", hint: "Продуктът е изтрит от сайта" }
        : needsProduct
          ? { label: "Продукт", value: "—", hint: "Още не е избран" }
        : { label: "Ръчно въведен продукт", value: post.price != null ? formatPrice(post.price) : "—", hint: "Цена за брой · без наличност" },
  ];

  const shown = claims.filter((c) => c.status !== "rejected");
  const skipped = claims.filter((c) => c.status === "rejected");
  const renderClaim = (c: FbClaim, i: number) => {
    const match = prefillFor(c.name);
    const flag = findFlag(flags, { userId: match.userId, email: match.prefill.email, phone: match.prefill.phone });
    return (
      <li key={c.id}>
        <Panel className={`p-5 ${c.status === "rejected" ? "opacity-55" : ""} ${flag && c.status === "pending" ? "ring-2 ring-tomato" : ""}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                <span className="text-sm tabular-nums text-ink-soft">{i + 1}.</span>
                {c.name}
                <span className="rounded-full bg-lime px-2.5 py-0.5 text-xs font-bold tabular-nums">{c.qty} бр</span>
                {flag && <FlagBadge />}
                {c.repliedAt && c.status !== "rejected" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2 py-0.5 text-[0.7rem] font-semibold text-ink-soft">
                    <MessageCircleReply className="h-3 w-3" aria-hidden />
                    Отговорено във Facebook
                  </span>
                )}
                {match.known && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2 py-0.5 text-[0.7rem] font-semibold text-forest">
                    <UserCheck className="h-3 w-3" aria-hidden />
                    {match.known === "user" ? "Регистриран клиент" : "Поръчвал преди"}
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-ink-soft">„{c.comment}“</p>
            </div>
            {c.status === "pending" && (
              <form action={setClaimStatus.bind(null, c.id, "rejected")}>
                <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-soft transition hover:bg-sand hover:text-tomato">
                  <X className="h-4 w-4" aria-hidden />
                  Пропусни
                </button>
              </form>
            )}
            {c.status === "rejected" && (
              <form action={setClaimStatus.bind(null, c.id, "pending")}>
                <button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-soft transition hover:bg-sand hover:text-ink">
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Върни
                </button>
              </form>
            )}
            {c.status === "ordered" && c.orderId && (
              <Link href={`/admin/porachki/${c.orderId}`} className="rounded-full bg-[#cdebd3] px-3 py-1.5 text-sm font-semibold text-[#0f3d26] hover:underline">
                Поръчката е създадена
              </Link>
            )}
          </div>
          {c.status === "pending" && !needsProduct && (
            <div className="mt-4 border-t border-line pt-4">
              <ClaimOrderForm claimId={c.id} qty={c.qty} prefill={match.prefill} colors={product ? colorChoices({ colors: product.colorOptions, colorStock: product.colorStock, colorPrices: product.colorPrices }) : []} />
            </div>
          )}
        </Panel>
      </li>
    );
  };

  return (
    <>
      <Link href="/admin/facebook" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" />
        Всички постове
      </Link>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{post.productName}</h1>
          <p className="mt-1 text-ink-soft">
            Добавен на {formatDate(post.createdAt)}
            {post.syncedAt && <> · коментарите са четени на {formatDate(post.syncedAt)}</>}
            {post.url && (
              <>
                {" · "}
                <a href={post.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-forest hover:underline">
                  Постът във Facebook <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {post.fbId && (
            <form action={setFbPostClosed.bind(null, post.id, !post.closedAt)}>
              <button
                type="submit"
                title={post.closedAt ? "Разширението пак ще чете коментарите под този пост" : "Разширението спира да чете коментарите под този пост"}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm font-semibold text-ink-soft transition hover:border-ink/40 hover:text-ink"
              >
                {post.closedAt ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
                {post.closedAt ? "Събирай отново" : "Спри събирането"}
              </button>
            </form>
          )}
          <form action={deleteFbPost.bind(null, post.id)}>
            <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm font-semibold text-ink-soft transition hover:border-tomato hover:text-tomato">
              <Trash2 className="h-4 w-4" aria-hidden />
              Изтрий поста
            </button>
          </form>
        </div>
      </header>

      {post.closedAt && (
        <p className="mb-4 rounded-2xl bg-sand px-4 py-3 text-sm text-ink-soft">Събирането от този пост е спряно. Новите коментари под него не се добавят.</p>
      )}

      {needsProduct && (
        <form action={setFbPostProduct.bind(null, post.id)} className="mb-6 rounded-card border-2 border-sun bg-sun/15 p-5">
          <p className="font-semibold">Кой продукт от сайта е в този пост?</p>
          <p className="mt-1 text-sm text-ink-soft">В поста няма линк към продукт от сайта, затова не е разпознат сам. Избери го, за да правиш поръчки от заявките.</p>
          {post.text && <p className="mt-3 line-clamp-3 whitespace-pre-line rounded-2xl bg-paper px-4 py-3 text-sm text-ink-soft">{post.text}</p>}
          <div className="mt-3 flex flex-wrap gap-3">
            <select name="productId" required defaultValue="" aria-label="Продукт" className="field min-w-0 flex-1 sm:max-w-md">
              <option value="" disabled>
                Избери продукт…
              </option>
              {productChoices.map((p) => (
                <option key={p.id} value={p.id}>
                  {`${p.name} ${p.unit}`.trim()} · {p.stock} бр
                </option>
              ))}
            </select>
            <button type="submit" className={btn.primary}>
              Запази продукта
            </button>
          </div>
        </form>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.label} className={`rounded-card p-5 shadow-soft ${t.warn ? "bg-tomato/10 ring-2 ring-tomato" : "bg-paper"}`}>
            <p className="text-sm text-ink-soft">{t.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{t.value}</p>
            {t.hint && <p className="mt-1 text-xs text-ink-soft">{t.hint}</p>}
            {t.warn && <p className="mt-1 text-xs font-semibold text-tomato">Заявени са повече, отколкото има</p>}
          </li>
        ))}
      </ul>

      <ol className="mt-6 space-y-4">{shown.map(renderClaim)}</ol>

      {skipped.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer rounded-full px-1 py-2 text-sm font-semibold text-ink-soft hover:text-ink">
            Пропуснати коментари ({skipped.length}): въпроси, отговори и отказани заявки
          </summary>
          <ol className="mt-3 space-y-4">{skipped.map(renderClaim)}</ol>
        </details>
      )}
    </>
  );
}

export default function Page({ params }: PageProps<"/admin/facebook/[id]">) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminFbPost params={params} />
    </Suspense>
  );
}
