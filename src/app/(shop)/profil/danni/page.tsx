import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PasswordForm, ProfileDetailsForm } from "@/components/account/AccountForms";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Лични данни", robots: { index: false } };

async function Forms() {
  const session = await getSession();
  if (!session) redirect("/vhod?next=/profil/danni");
  const [u] = await db.select().from(users).where(eq(users.id, session.uid)).limit(1);
  if (!u) redirect("/vhod?next=/profil/danni");
  return (
    <div className="space-y-6">
      <ProfileDetailsForm initial={{ name: u.name, phone: u.phone ?? "", email: u.email }} />
      <PasswordForm />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-tile bg-sand" aria-hidden />}>
      <Forms />
    </Suspense>
  );
}
