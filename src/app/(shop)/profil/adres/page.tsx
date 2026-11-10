import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DeliveryPrefsForm } from "@/components/account/AccountForms";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Адрес за доставка", robots: { index: false } };

async function Form() {
  const session = await getSession();
  if (!session) redirect("/vhod?next=/profil/adres");
  const [u] = await db.select().from(users).where(eq(users.id, session.uid)).limit(1);
  if (!u) redirect("/vhod?next=/profil/adres");
  return <DeliveryPrefsForm initial={{ delivery: u.preferredDelivery, city: u.city ?? "", address: u.address ?? "" }} />;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="h-80 animate-pulse rounded-tile bg-sand" aria-hidden />}>
      <Form />
    </Suspense>
  );
}
