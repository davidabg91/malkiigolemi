import { MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { AdminSkeleton, PageTitle, Panel } from "@/components/admin/bits";
import { requireAdmin } from "@/lib/auth";
import { listChatThreads } from "@/lib/chat";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Чат" };

async function Chats() {
  await requireAdmin();
  const threads = await listChatThreads();

  return (
    <>
      <AutoRefresh seconds={10} />
      <PageTitle title="Чат" sub="Въпроси от клиенти през чата на сайта. Непрочетените са най-отгоре с червено число." />
      {threads.length === 0 ? (
        <Panel className="flex flex-col items-center px-5 py-14 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-sand text-ink-soft">
            <MessagesSquare className="h-6 w-6" strokeWidth={1.5} aria-hidden />
          </span>
          <p className="mt-4 text-ink-soft">Още никой не е писал в чата.</p>
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <ul className="divide-y divide-line">
            {threads.map((t) => {
              const name = t.userName ?? t.name ?? "Гост";
              return (
                <li key={t.id}>
                  <Link href={`/admin/chat/${t.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-sand/60">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full font-semibold uppercase ${t.adminUnread > 0 ? "bg-forest text-white" : "bg-sand text-ink-soft"}`} aria-hidden>
                      {name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={`truncate ${t.adminUnread > 0 ? "font-bold" : "font-semibold"}`}>
                          {name}
                          {!t.userId && <span className="ml-2 text-xs font-normal text-ink-soft">без профил</span>}
                        </span>
                        <span className="shrink-0 text-xs text-ink-soft">{t.lastMessageAt ? formatDate(t.lastMessageAt) : ""}</span>
                      </span>
                      <span className={`mt-0.5 block truncate text-sm ${t.adminUnread > 0 ? "font-medium text-ink" : "text-ink-soft"}`}>
                        {t.lastFrom === "admin" && "Ти: "}
                        {t.lastBody}
                      </span>
                    </span>
                    {t.adminUnread > 0 && (
                      <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-tomato px-1.5 text-xs font-bold text-white">{t.adminUnread}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Chats />
    </Suspense>
  );
}
