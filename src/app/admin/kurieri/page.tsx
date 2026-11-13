import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminSkeleton, PageTitle, Panel } from "@/components/admin/bits";
import { CourierSettingsForm } from "@/components/admin/CourierSettingsForm";
import { EcontSettingsForm } from "@/components/admin/EcontSettingsForm";
import { CourierLogo } from "@/components/couriers/CourierLogos";
import { requireAdmin } from "@/lib/auth";
import { countLocations } from "@/lib/courier-offices";
import { getActiveCouriersConfig } from "@/lib/couriers-server";
import { econtMode } from "@/lib/econt";
import { getEcontSettings } from "@/lib/econt-settings";

export const metadata: Metadata = { title: "Куриери и доставки" };

async function CouriersContent() {
  await requireAdmin();
  const [config, econt] = await Promise.all([getActiveCouriersConfig(), getEcontSettings()]);

  return (
    <div>
      <PageTitle
        title="Куриери и доставки"
        sub="Изберете с кои куриерски фирми да работи магазинът и кои да се показват в стъпка 2. Доставка."
      />
      <CourierSettingsForm initialConfig={config} locationCounts={countLocations()} />

      <Panel className="mt-10 p-5 sm:p-7">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <CourierLogo courier="econt" className="h-8 w-auto" />
          <div>
            <h2 className="font-display text-xl font-semibold">Товарителници и проследяване</h2>
            <p className="text-sm text-ink-soft">Създаване на товарителници от поръчката и автоматично следене на пратките.</p>
          </div>
        </div>
        <EcontSettingsForm initial={econt} live={econtMode().live} />
      </Panel>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <CouriersContent />
    </Suspense>
  );
}
