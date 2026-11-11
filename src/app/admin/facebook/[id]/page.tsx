import { asc, desc, eq, sql } from "drizzle-orm";
import { ArrowLeft, ExternalLink, RotateCcw, Trash2, UserCheck, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { deleteFbPost, setClaimStatus } from "@/actions/facebook";
import { AdminSkeleton, Panel } from "@/components/admin/bits";
import { ClaimOrderForm, type ClaimPrefill } from "@/components/admin/ClaimOrderForm";
import { FlagBadge } from "@/components/admin/Flag";
import { db } from "@/db";
import { fbClaims, fbPosts, orders, products, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { isCourierId } from "@/lib/couriers";
import { findFlag, getFlagIndex } from "@/lib/flags";
import { formatDate, formatPrice } from "@/lib/format";
import { DELIVERY_METHODS, type DeliveryId } from "@/lib/site";

export const metadata: Metadata = { title: "Пост от Facebook" };

const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
const isDelivery = (v: string | null | undefined): v is DeliveryId => DELIVERY_METHODS.some((m) => m.id === v);

async function AdminFbPost({ params }: Pick<PageProps<"/admin/facebook/[id]">, "params">) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [post] = await db.select().from(fbPosts).where(eq(fbPosts.id, id)).limit(1);
  if (!post) notFound();

  const [claims, product, people, pastOrders, flags] = await Promise.all([
    db.select().from(fbClaims).where(eq(fbClaims.postId, id)).orderBy(asc(fbClaims.id)),
    post.productId ? db.select().from(products).where(eq(products.id, post.productId)).limit(1).then((r) => r[0]) : undefined,
    db.select().from(users),
    // The newest order per name: Facebook names are matched to people who already ordered.
    db
      .select({ name: orders.name, phone: orders.phone, email: orders.email, delivery: orders.delivery, courier: orders.courier, city: orders.city, address: orders.address, userId: orders.userId })
      .from(orders)
      .where(sql`${orders.status} != 'cancelled'`)
      .orderBy(desc(orders.createdAt))
      .limit(5000),
    getFlagIndex(),
  ]);

  const userByName = new Map<string, (typeof people)[number]>();
  for (const u of people) if (!userByName.has(key(u.name))) userByName.set(key(u.name), u);
  const orderByName = new Map<string, (typeof pastOrders)[number]>();
  for (const o of pastOrders) if (!orderByName.has(key(o.name))) orderByName.set(key(o.name), o);

  const prefillFor = (name: string): { prefill: ClaimPrefill; known: "user" | "order" | null; userId: number | null } => {
    const u = userByName.get(key(name));
    const o = orderByName.get(key(name));
    const known = u ? "user" : o ? "order" : null;
    const courier = o?.courier ?? u?.preferredCourier ?? "";
    return {
      known,
      userId: u?.id ?? o?.userId ?? null,
      prefill: {
        name: u?.name ?? o?.name ?? name,
        phone: o?.phone ?? u?.phone ?? "",
        email: u?.email ?? o?.email ?? "",
        delivery: isDelivery(o?.delivery) ? o.delivery : isDelivery(u?.preferredDelivery) ? u.preferredDelivery : "office",
        courier: isCourierId(courier) ? courier : "",
        city: o?.city ?? u?.city ?? "",
        address: o?.address ?? u?.address ?? "",
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
    { label: "Наличност", value: product ? `${product.stock} бр` : "—", hint: product ? formatPrice(product.price) : "Продуктът е изтрит" },
  ];

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
        <form action={deleteFbPost.bind(null, post.id)}>
          <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm font-semibold text-ink-soft transition hover:border-tomato hover:text-tomato">
            <Trash2 className="h-4 w-4" aria-hidden />
            Изтрий поста
          </button>
        </form>
      </header>

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

      <ol className="mt-6 space-y-4">
        {claims.map((c, i) => {
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
                {c.status === "pending" && (
                  <div className="mt-4 border-t border-line pt-4">
                    <ClaimOrderForm claimId={c.id} qty={c.qty} prefill={match.prefill} />
                  </div>
                )}
              </Panel>
            </li>
          );
        })}
      </ol>
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
