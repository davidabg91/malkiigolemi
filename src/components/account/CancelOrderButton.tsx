"use client";

import { AlertTriangle, Ban, Loader2, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelOrder } from "@/actions/account";

export function CancelOrderButton({
  orderId,
  orderNumber,
}: {
  orderId: number;
  orderNumber: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Close modal on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, pending]);

  const handleConfirm = () => {
    startTransition(async () => {
      const res = await cancelOrder(orderId);
      if (!res.ok) {
        toast.error(res.error || "Възникна грешка при отказване на поръчката.");
        return;
      }
      toast.success(`Поръчка ${orderNumber} беше отказана.`);
      setIsOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-50 hover:text-red-800 active:scale-[.98] sm:text-sm"
      >
        <Ban className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
        Откажи поръчката
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-[2px] animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-paper p-6 shadow-float border border-line animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
                  <AlertTriangle className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 id="cancel-modal-title" className="font-display text-lg font-bold text-ink">
                    Отказване на поръчка
                  </h3>
                  <p className="text-xs font-mono font-medium text-ink-soft">{orderNumber}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 text-ink-soft hover:bg-sand hover:text-ink disabled:opacity-50"
                aria-label="Затвори"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Сигурен ли си, че искаш да откажеш тази поръчка? Всички артикули ще бъдат върнати в наличност, а статусът
              ще се смени на <strong className="text-red-700">Отказана</strong>.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={pending}
                onClick={() => setIsOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-line bg-paper px-4 text-sm font-semibold text-ink hover:border-ink disabled:opacity-50"
              >
                Не, запази поръчката
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleConfirm}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Отказване...
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4" aria-hidden />
                    Да, откажи поръчката
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
