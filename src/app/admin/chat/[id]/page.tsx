import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminChat } from "@/components/admin/AdminChat";
import { AdminSkeleton } from "@/components/admin/bits";
import { DeleteChat } from "@/components/admin/DeleteChat";
import { requireAdmin } from "@/lib/auth";
import { loadChatThread } from "@/lib/chat";

export const metadata: Metadata = { title: "Разговор" };

type Props = PageProps<"/admin/chat/[id]">;

async function Conversation({ params }: Pick<Props, "params">) {
  await requireAdmin();
  const { id } = await params;
  const chat = await loadChatThread(Number(id) || 0, true);
  if (!chat) notFound();
  const { thread, lines } = chat;
  const name = thread.userName ?? thread.name ?? "Гост";

  return (
    <>
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/admin/chat" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-sand hover:text-ink" aria-label="Към всички разговори">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-semibold sm:text-2xl">{name}</h1>
          <p className="truncate text-sm text-ink-soft">
            {thread.userId ? (
              <>
                Клиент с профил · {thread.userEmail} ·{" "}
                <Link href={`/admin/potrebiteli?q=${encodeURIComponent(thread.userEmail ?? "")}`} className="font-medium text-forest hover:underline">
                  виж профила
                </Link>
              </>
            ) : (
              "Посетител без профил"
            )}
          </p>
        </div>
        <DeleteChat threadId={thread.id} />
      </header>
      <AdminChat threadId={thread.id} initial={lines} />
    </>
  );
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Conversation params={params} />
    </Suspense>
  );
}
