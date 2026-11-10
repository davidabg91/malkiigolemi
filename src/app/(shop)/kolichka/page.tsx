import type { Metadata } from "next";
import { CartPage } from "@/components/checkout/CartPage";
import { Breadcrumbs } from "@/components/ui";

export const metadata: Metadata = { title: "Количка", robots: { index: false } };

export default function Page() {
  return (
    <div className="container-shop pt-6 sm:pt-8">
      <Breadcrumbs items={[{ label: "Количка" }]} />
      <h1 className="mb-8 mt-4 font-display text-3xl font-semibold tracking-tight sm:text-[2.6rem]">Количка</h1>
      <CartPage />
    </div>
  );
}
