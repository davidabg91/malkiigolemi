"use client";

import { AlertTriangle, Edit3, Eye, EyeOff, Loader2, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { deleteProduct, toggleProduct } from "@/actions/admin";

interface ProductAdminActionsProps {
  product: {
    id: number;
    slug: string;
    name: string;
    active: boolean;
  };
}

export function ProductAdminActions({ product }: ProductAdminActionsProps) {
  const router = useRouter();
  const [isActive, setIsActive] = useState(product.active);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isPendingToggle, startTransitionToggle] = useTransition();
  const [isPendingDelete, startTransitionDelete] = useTransition();

  // Sync state if prop changes
  useEffect(() => {
    setIsActive(product.active);
  }, [product.active]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!showDeleteModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPendingDelete) {
        setShowDeleteModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showDeleteModal, isPendingDelete]);

  const handleToggle = () => {
    startTransitionToggle(async () => {
      try {
        await toggleProduct(product.id);
        const nextState = !isActive;
        setIsActive(nextState);
        toast.success(
          nextState ? "Обявата вече е видима за клиенти." : "Обявата беше скрита от клиенти."
        );
      } catch (err) {
        console.error("Failed to toggle product:", err);
        toast.error("Възникна грешка при промяна на статуса.");
      }
    });
  };

  const handleDelete = () => {
    startTransitionDelete(async () => {
      try {
        await deleteProduct(product.id);
        toast.success(`Обявата "${product.name}" беше изтрита.`);
        setShowDeleteModal(false);
        router.push("/produkti");
      } catch (err) {
        console.error("Failed to delete product:", err);
        toast.error("Възникна грешка при изтриване на обявата.");
      }
    });
  };

  const editUrl = `/admin/produkti/${product.id}?returnUrl=${encodeURIComponent(`/produkt/${product.slug}`)}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* Status indicator when hidden */}
        {!isActive && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-900">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse" />
            Скрита от клиенти
          </span>
        )}

        {/* Edit Button */}
        <Link
          href={editUrl}
          className="inline-flex items-center gap-1.5 rounded-full border border-forest/30 bg-forest/10 px-3.5 py-1.5 text-xs font-semibold text-forest shadow-soft transition hover:bg-forest hover:text-white"
        >
          <Edit3 className="h-3.5 w-3.5" />
          <span>Редактирай артикула</span>
        </Link>

        {/* Hide / Show Button */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPendingToggle}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-soft transition disabled:opacity-50 ${
            isActive
              ? "border border-amber-600/30 bg-amber-500/10 text-amber-800 hover:bg-amber-600 hover:text-white"
              : "border border-emerald-600/30 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-600 hover:text-white"
          }`}
          title={isActive ? "Скрий обявата от клиенти" : "Покажи обявата на клиенти"}
        >
          {isPendingToggle ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isActive ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          <span>{isActive ? "Скрий обявата" : "Покажи обявата"}</span>
        </button>

        {/* Red X Delete Button */}
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-bold text-red-600 shadow-soft transition hover:bg-red-600 hover:text-white active:scale-95"
          title="Изтрий тази обява"
          aria-label="Изтрий тази обява"
        >
          <X className="h-3.5 w-3.5 stroke-[2.75]" />
          <span>Изтрий</span>
        </button>
      </div>

      {/* Confirmation Modal */}
      {showDeleteModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
          >
            <div
              className="w-full max-w-md rounded-3xl bg-paper p-6 shadow-lift border border-line animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-500/10 text-red-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isPendingDelete}
                  className="grid h-8 w-8 place-items-center rounded-full text-ink-soft hover:bg-sand hover:text-ink disabled:opacity-50"
                  aria-label="Затвори"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4">
                <h3 id="delete-dialog-title" className="font-display text-lg font-semibold text-ink">
                  Изтриване на обявата?
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Сигурни ли сте, че искате да изтриете{" "}
                  <strong className="text-ink font-semibold">„{product.name}“</strong>? Това действие
                  е окончателно и артикулът ще бъде премахнат напълно от магазина.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isPendingDelete}
                  className="rounded-full border border-line bg-paper px-4 py-2 text-xs font-semibold text-ink-soft transition hover:bg-sand hover:text-ink disabled:opacity-50"
                >
                  Отказ
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPendingDelete}
                  className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-soft transition hover:bg-red-700 active:scale-95 disabled:opacity-50"
                >
                  {isPendingDelete ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  <span>{isPendingDelete ? "Изтриване..." : "Да, изтрий обявата"}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
