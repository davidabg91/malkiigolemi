import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { FreshOnReturn } from "@/components/FreshOnReturn";
import { getAdminAlerts } from "@/lib/admin-alerts";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "Админ панел", template: "%s · Админ" },
  robots: { index: false, follow: false },
};

async function Shell({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const alerts = await getAdminAlerts();
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip lg:flex-row">
      <FreshOnReturn always />
      <AdminNav name={session.name} alerts={alerts} />
      {/* Grid cells may shrink below their content, so a wide table scrolls inside its panel instead of widening the page on a phone. */}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8 [&_.grid>*]:min-w-0">{children}</main>
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
