"use client";

import { ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteCategory, deleteProduct, reorderCategories, toggleCategoryActive, toggleProduct } from "@/actions/admin";

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

export function ToggleCategoryActive({ id, active }: { id: number; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        start(async () => {
          try {
            await toggleCategoryActive(id);
            toast.success(active ? "Категорията е деактивирана" : "Категорията е активирана");
          } catch {
            toast.error("Неуспешна промяна на статуса");
          }
        });
      }}
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
        active
          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
      } ${pending ? "opacity-60 pointer-events-none" : ""}`}
      title={active ? "Натисни за деактивиране" : "Натисни за активиране"}
    >
      {pending ? "..." : active ? "Активна" : "Неактивна"}
    </button>
  );
}

/** Up and down arrows in the list of categories: swaps a category with its neighbour and saves the order. */
export function MoveCategory({ ids, index, name }: { ids: number[]; index: number; name: string }) {
  const [pending, start] = useTransition();
  const move = (to: number) => (e: React.MouseEvent) => {
    // The buttons sit in the row's <summary>; moving must not open or close the row.
    e.preventDefault();
    e.stopPropagation();
    const next = [...ids];
    [next[index], next[to]] = [next[to], next[index]];
    start(async () => {
      try {
        await reorderCategories(next);
      } catch {
        toast.error("Подредбата не беше запазена");
      }
    });
  };
  const arrow = "grid h-8 w-8 place-items-center rounded-full text-ink-soft transition hover:bg-sand hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent";
  return (
    <span className="flex shrink-0 items-center">
      <button type="button" onClick={move(index - 1)} disabled={pending || index === 0} className={arrow} aria-label={`Премести нагоре: ${name}`} title="Премести нагоре">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronUp className="h-4 w-4" />}
      </button>
      <button type="button" onClick={move(index + 1)} disabled={pending || index === ids.length - 1} className={arrow} aria-label={`Премести надолу: ${name}`} title="Премести надолу">
        <ChevronDown className="h-4 w-4" />
      </button>
    </span>
  );
}
