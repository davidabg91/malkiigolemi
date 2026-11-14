"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { chatDelete } from "@/actions/chat";

/** Deletes a whole conversation, after asking. */
export function DeleteChat({ threadId }: { threadId: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Изтриване на целия разговор? Действието е необратимо.")) start(() => chatDelete(threadId));
      }}
      className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-soft hover:bg-sand hover:text-tomato"
      title="Изтрий разговора"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
      <span className="hidden sm:inline">Изтрий</span>
    </button>
  );
}
