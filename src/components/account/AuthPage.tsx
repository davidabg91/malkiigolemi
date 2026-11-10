import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession, safeNext } from "@/lib/auth";
import { LoginForm, RegisterForm } from "./AuthForms";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Form({ mode, searchParams }: { mode: "login" | "register"; searchParams: SearchParams }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeNext(sp.next, "") : "";
  const session = await getSession();
  if (session) redirect(next || (session.role === "admin" ? "/admin" : "/profil"));
  return mode === "login" ? <LoginForm next={next || undefined} /> : <RegisterForm next={next || undefined} />;
}

export function AuthPage({
  mode,
  title,
  text,
  searchParams,
}: {
  mode: "login" | "register";
  title: string;
  text: string;
  searchParams: SearchParams;
}) {
  return (
    <div className="container-shop pt-10 sm:pt-16">
      <div className="mx-auto max-w-md rounded-tile bg-paper p-7 shadow-soft sm:p-9">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mb-6 mt-2 text-ink-soft">{text}</p>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-sand" aria-hidden />}>
          <Form mode={mode} searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
