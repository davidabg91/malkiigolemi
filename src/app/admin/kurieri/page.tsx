import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminSkeleton, PageTitle } from "@/components/admin/bits";
import { CourierSettingsForm } from "@/components/admin/CourierSettingsForm";
import { requireAdmin } from "@/lib/auth";
import { countLocations } from "@/lib/courier-offices";
import { getActiveCouriersConfig } from "@/lib/couriers-server";

export const metadata: Metadata = { title: "Куриери и доставки" };

async function CouriersContent() {
  await requireAdmin();
  const config = await getActiveCouriersConfig();

  return (
    <div>
      <PageTitle
        title="Куриери и доставки"
        sub="Изберете с кои куриерски фирми да работи магазинът и кои да се показват в стъпка 2. Доставка."
      />
      <CourierSettingsForm initialConfig={config} locationCounts={countLocations()} />
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
