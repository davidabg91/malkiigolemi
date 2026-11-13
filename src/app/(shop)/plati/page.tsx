import type { Metadata } from "next";
import { StorePayForm } from "@/components/pay/StorePayForm";
import { STORE } from "@/lib/site";
import { stripeConfigured } from "@/lib/stripe";

export const metadata: Metadata = { title: "Плащане в магазина", robots: { index: false } };

/** Where the QR code at the till leads: the customer types the sum and pays with a phone or a card. */
export default function Page() {
  return (
    <div className="container-shop max-w-md pb-6 pt-8 sm:pt-12">
      <h1 className="text-center font-display text-3xl font-semibold leading-tight tracking-tight">Плащане в магазина</h1>
      <p className="mt-2 text-center text-ink-soft">{STORE.address}</p>
      <div className="mt-6">
        {stripeConfigured() ? (
          <StorePayForm />
        ) : (
          <p className="rounded-card bg-paper p-6 text-center shadow-soft">Плащането с карта не е включено в момента. Моля, плати на касата.</p>
        )}
      </div>
    </div>
  );
}
