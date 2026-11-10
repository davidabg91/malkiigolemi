import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/actions/auth";
import { ProfileNav } from "@/components/account/ProfileNav";
import { btn } from "@/components/ui";
import { getSession } from "@/lib/auth";

async function Greeting() {
  const session = await getSession();
  // Each page redirects with its own ?next=, so the visitor lands back on the tab they asked for.
  if (!session) return null;
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-sm text-ink-soft">{session.email}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-[2.6rem]">Здравей, {session.name.split(" ")[0]}</h1>
      </div>
      <div className="flex gap-2">
        {session.role === "admin" && (
          <Link href="/admin" className={btn.sm}>
            <Settings className="h-4 w-4" />
            Админ панел
          </Link>
        )}
        <form action={logout}>
          <button type="submit" className={btn.sm}>
            <LogOut className="h-4 w-4" />
            Изход
          </button>
        </form>
      </div>
    </header>
  );
}

export default function ProfileLayout({ children }: LayoutProps<"/profil">) {
  return (
    <div className="container-shop max-w-4xl pt-8 sm:pt-12">
      <Suspense fallback={<div className="h-16 w-72 animate-pulse rounded-2xl bg-sand" aria-hidden />}>
        <Greeting />
      </Suspense>
      <ProfileNav />
      <div className="mt-8">{children}</div>
    </div>
  );
}
