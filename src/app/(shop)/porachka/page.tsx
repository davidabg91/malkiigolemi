import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutForm, type CheckoutDefaults } from "@/components/checkout/CheckoutForm";
import { Breadcrumbs } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { savedOffice } from "@/lib/courier-offices";
import { getLoyaltySettings, pointsBalance } from "@/lib/loyalty";

export const metadata: Metadata = { title: "Поръчка", robots: { index: false } };

const EMPTY: CheckoutDefaults = {
  name: "",
  phone: "",
  email: "",
  city: "",
  address: "",
  delivery: null,
  courier: null,
  office: null,
  signedIn: false,
};

/** Signed-in customers get their saved details and preferred delivery prefilled. */
async function Form() {
  const session = await getSession();
  let defaults = EMPTY;
  if (session) {
    const [[u], loyaltySettings, balance] = await Promise.all([
      db.select().from(users).where(eq(users.id, session.uid)).limit(1),
      getLoyaltySettings(),
      pointsBalance(session.uid),
    ]);
    if (u) {
      defaults = {
        name: u.name,
        phone: u.phone ?? "",
        email: u.email,
        city: u.city ?? "",
        address: u.address ?? "",
        delivery: (u.preferredDelivery as CheckoutDefaults["delivery"]) ?? null,
        courier: (u.preferredCourier as CheckoutDefaults["courier"]) ?? null,
        office: savedOffice(u.preferredDelivery, u.preferredCourier, u.preferredOfficeCode),
        signedIn: true,
        loyalty: loyaltySettings.enabled ? { balance, settings: loyaltySettings } : null,
      };
    }
  }
  return <CheckoutForm defaults={defaults} />;
}

export default function Page() {
  return (
    <div className="container-shop pt-6 sm:pt-8">
      <Breadcrumbs items={[{ label: "Количка", href: "/kolichka" }, { label: "Поръчка" }]} />
      <h1 className="mb-8 mt-4 font-display text-3xl font-semibold tracking-tight sm:text-[2.6rem]">Завърши поръчката</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-tile bg-sand" aria-hidden />}>
        <Form />
      </Suspense>
    </div>
  );
}
