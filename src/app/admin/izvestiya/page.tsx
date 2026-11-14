import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminSkeleton, PageTitle, Panel } from "@/components/admin/bits";
import { NoticeSettings } from "@/components/admin/NoticeSettings";
import { PushToggle } from "@/components/PushToggle";
import { requireAdmin } from "@/lib/auth";
import { getAdminNoticePrefs, pushConfigured, vapidPublicKey } from "@/lib/push";

export const metadata: Metadata = { title: "Известия" };

async function Notices() {
  await requireAdmin();
  const prefs = await getAdminNoticePrefs();

  return (
    <>
      <PageTitle title="Известия" sub="Кое да звъни на телефона ти. Известията идват като от всяко друго приложение и с докосване отварят точното място в админ панела." />
      {pushConfigured() ? (
        <PushToggle publicKey={vapidPublicKey()} audience="admin" className="mb-6" />
      ) : (
        <p className="mb-6 rounded-2xl bg-sun/30 px-4 py-3 text-sm">Известията не са настроени на сървъра (липсват ключовете VAPID).</p>
      )}
      <Panel className="overflow-hidden">
        <h2 className="px-5 pt-5 font-display text-lg font-semibold">За какво да получавам известие</h2>
        <p className="px-5 pb-2 pt-1 text-sm text-ink-soft">Важи за всички админи и за всяко устройство, на което известията са включени.</p>
        <NoticeSettings prefs={prefs} />
      </Panel>
      <p className="mt-4 text-sm text-ink-soft">
        На iPhone известията работят, след като магазинът е добавен на началния екран и отворен оттам. На Android работят и в браузъра Chrome.
      </p>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Notices />
    </Suspense>
  );
}
