import { eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "Админ панел", template: "%s · Админ" },
  robots: { index: false, follow: false },
};

async function Shell({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(orders).where(eq(orders.status, "new"));
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <AdminNav name={session.name} newOrders={n} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-ink-soft">Зареждане…</div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
