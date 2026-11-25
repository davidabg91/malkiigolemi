import type { Metadata } from "next";
import { StorePayForm } from "@/components/pay/StorePayForm";
import { ShareButton } from "@/components/ShareButton";
import { site, STORE } from "@/lib/site";
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
      {/* The same address as the QR code at the till, for sending to a customer who is not in the shop. */}
      <ShareButton
        url="/plati"
        title={`Плащане с карта · ${site.name}`}
        label="Сподели страницата за плащане"
        className="mx-auto mt-5 w-fit"
        menuClassName="left-1/2 top-full mt-2 -translate-x-1/2"
      />
    </div>
  );
}
