"use client";

import { Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteCategory, deleteProduct, toggleProduct } from "@/actions/admin";

const icon = "grid h-9 w-9 place-items-center rounded-full text-ink-soft transition hover:bg-sand disabled:opacity-50";

export function ToggleActive({ id, active, name }: { id: number; active: boolean; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => toggleProduct(id))}
      className={`${icon} hover:text-ink`}
      aria-label={active ? `Скрий от магазина: ${name}` : `Покажи в магазина: ${name}`}
      title={active ? "Скрий от магазина" : "Покажи в магазина"}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </button>
  );
}

export function DeleteButton({ id, name, kind }: { id: number; name: string; kind: "product" | "category" }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Изтриване на „${name}“? Действието е необратимо.`)) return;
        start(async () => {
          try {
            await (kind === "product" ? deleteProduct(id) : deleteCategory(id));
            toast.success("Изтрито");
          } catch {
            toast.error("Неуспешно изтриване");
          }
        });
      }}
      className={`${icon} hover:text-tomato`}
      aria-label={`Изтрий: ${name}`}
      title="Изтрий"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}
