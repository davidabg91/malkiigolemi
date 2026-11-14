"use client";

import { ArrowDownUp, Check, ChevronLeft, ChevronRight, History, Loader2, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { resetProductOrder, restoreProductOrder, saveProductOrder, type ProductRank } from "@/actions/admin";
import { useIsAdmin } from "@/lib/admin-flag";

const grid = "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4";
const tool = "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition active:scale-95 disabled:opacity-40";

function move<T>(list: T[], from: number, to: number) {
  if (from === to || to < 0 || to >= list.length) return list;
  const next = [...list];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/**
 * The product grid of a listing. For customers it is a plain grid. An admin can hold a product (or press
 * „Подреди“) to arrange the products by hand: drag them, or use the arrows on each card. The new order is
 * what every customer sees, and it can be taken back after saving.
 */
export function SortableGrid({ ids, cards, sortable }: { ids: number[]; cards: ReactNode[]; sortable: boolean }) {
  const isAdmin = useIsAdmin();
  const [order, setOrder] = useState(ids);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  // The places the products had before the last save or reset on this page, for „Върни предишната“.
  const [previous, setPrevious] = useState<ProductRank[] | null>(null);
  const [pending, start] = useTransition();

  // A new list from the server (another page, a saved order) replaces the one arranged here.
  const [synced, setSynced] = useState(ids);
  if (ids !== synced && ids.join() !== synced.join()) {
    setSynced(ids);
    setOrder(ids);
  }

  const cardOf = new Map(ids.map((id, i) => [id, cards[i]]));
  const changed = order.join() !== ids.join();
  const canSort = sortable && isAdmin && ids.length > 1;

  // Dragging: the held product takes the place of whichever product the pointer is over.
  const drag = useRef<{ id: number; x: number; y: number; active: boolean; timer?: number } | null>(null);
  const longPressed = useRef(false);

  useEffect(() => {
    if (!editing) return;
    let scroll = 0;
    const scroller = window.setInterval(() => scroll && window.scrollBy(0, scroll), 16);
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (!d.active) {
        const far = Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8;
        // A mouse starts dragging once it moves; a finger that moves before the hold is over is scrolling.
        if (far && e.pointerType !== "mouse") {
          window.clearTimeout(d.timer);
          drag.current = null;
        }
        if (!far || e.pointerType !== "mouse") return;
        d.active = true;
        setDragging(d.id);
      }
      scroll = e.clientY < 110 ? -14 : e.clientY > window.innerHeight - 90 ? 14 : 0;
      const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-reorder-id]");
      const overId = Number(over?.dataset.reorderId);
      if (!overId || overId === d.id) return;
      setOrder((list) => move(list, list.indexOf(d.id), list.indexOf(overId)));
    };
    const onUp = () => {
      window.clearTimeout(drag.current?.timer);
      drag.current = null;
      scroll = 0;
      setDragging(null);
    };
    // While a product is held the page must not scroll under the finger.
    const onTouchMove = (e: TouchEvent) => drag.current?.active && e.preventDefault();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      window.clearInterval(scroller);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [editing]);

  const buzz = () => {
    try {
      navigator.vibrate?.(40);
    } catch {}
  };

  const onPointerDown = (id: number) => (e: React.PointerEvent) => {
    if (!canSort || (e.pointerType === "mouse" && e.button !== 0)) return;
    if ((e.target as HTMLElement).closest("[data-reorder-tool]")) return;
    window.clearTimeout(drag.current?.timer);
    const d = { id, x: e.clientX, y: e.clientY, active: false, timer: 0 };
    drag.current = d;
    if (!editing) {
      // Holding a product turns the arranging on, like holding an icon on a phone's home screen.
      d.timer = window.setTimeout(() => {
        if (drag.current !== d) return;
        drag.current = null;
        longPressed.current = true;
        buzz();
        setEditing(true);
      }, 500);
    } else if (e.pointerType !== "mouse") {
      d.timer = window.setTimeout(() => {
        if (drag.current !== d) return;
        d.active = true;
        buzz();
        setDragging(id);
      }, 180);
    }
  };

  const cancelHold = (e: React.PointerEvent) => {
    const d = drag.current;
    if (editing || !d || Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return;
    window.clearTimeout(d.timer);
    drag.current = null;
  };

  const run = (work: () => Promise<void>, failed: string) =>
    start(async () => {
      try {
        await work();
      } catch {
        toast.error(failed);
      }
    });

  const undo = (rows: ProductRank[]) =>
    run(async () => {
      await restoreProductOrder(rows);
      setPrevious(null);
      toast.success("Върната е предишната подредба");
    }, "Подредбата не беше върната");

  const save = () =>
    run(async () => {
      const before = await saveProductOrder(order);
      setPrevious(before);
      setEditing(false);
      toast.success("Подредбата е запазена", { action: { label: "Върни", onClick: () => undo(before) }, duration: 8000 });
    }, "Подредбата не беше запазена");

  const newestFirst = () => {
    if (!confirm("Да махна ли ръчната подредба на тези продукти? Ще се наредят по дата, най-новите първи.")) return;
    run(async () => {
      const before = await resetProductOrder(ids);
      setPrevious(before);
      setEditing(false);
      toast.success("Продуктите са наредени по дата", { action: { label: "Върни", onClick: () => undo(before) }, duration: 8000 });
    }, "Подредбата не беше променена");
  };

  if (!canSort) {
    return (
      <ul className={grid}>
        {ids.map((id) => (
          <li key={id}>{cardOf.get(id)}</li>
        ))}
      </ul>
    );
  }

  return (
    <>
      {editing ? (
        <div className="sticky top-[13.75rem] z-30 mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-forest-deep px-4 py-3 text-cream shadow-lift md:top-[10rem]">
          <p className="min-w-40 flex-1 text-sm">
            <span className="font-semibold">Подреждане:</span> задръж продукт и го премести, или ползвай стрелките.
          </p>
          <button type="button" onClick={() => setOrder(ids)} disabled={!changed || pending} className={`${tool} bg-white/10 hover:bg-white/20`}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Върни както беше
          </button>
          <button type="button" onClick={newestFirst} disabled={pending} className={`${tool} bg-white/10 hover:bg-white/20`}>
            <History className="h-4 w-4" aria-hidden />
            Най-новите първи
          </button>
          <button
            type="button"
            onClick={() => {
              setOrder(ids);
              setEditing(false);
            }}
            disabled={pending}
            className={`${tool} bg-white/10 hover:bg-white/20`}
          >
            <X className="h-4 w-4" aria-hidden />
            Отказ
          </button>
          <button type="button" onClick={save} disabled={!changed || pending} className={`${tool} bg-lime text-ink hover:bg-lime-deep`}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
            Запази
          </button>
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-forest/40 bg-forest/5 px-4 py-2.5">
          <p className="min-w-40 flex-1 text-sm text-ink-soft">Админ: задръж продукт или натисни „Подреди“, за да наредиш продуктите както да ги виждат клиентите.</p>
          {previous && (
            <button type="button" onClick={() => undo(previous)} disabled={pending} className={`${tool} border border-line bg-paper text-ink hover:border-ink`}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
              Върни предишната подредба
            </button>
          )}
          <button type="button" onClick={() => setEditing(true)} className={`${tool} bg-forest text-white hover:bg-forest-deep`}>
            <ArrowDownUp className="h-4 w-4" aria-hidden />
            Подреди
          </button>
        </div>
      )}

      <ul
        className={`${grid} select-none [-webkit-touch-callout:none]`}
        // After a hold that turned the arranging on, the click that follows must not open the product.
        onClickCapture={(e) => {
          if (longPressed.current || editing) {
            if (!(e.target as HTMLElement).closest("[data-reorder-tool]")) e.preventDefault();
            longPressed.current = false;
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {order.map((id, index) => (
          <li
            key={id}
            data-reorder-id={id}
            onPointerDown={onPointerDown(id)}
            onPointerMove={cancelHold}
            onDragStart={(e) => e.preventDefault()}
            className={`relative transition-transform duration-150 ${editing ? "cursor-grab" : ""} ${
              dragging === id ? "z-20 scale-[1.04] cursor-grabbing rounded-card shadow-lift ring-2 ring-forest" : ""
            } ${editing && dragging !== id ? (index % 2 ? "animate-ios-jiggle" : "animate-ios-jiggle-alt") : ""}`}
          >
            {/* While arranging, the card is only a picture: its links and buttons do nothing. */}
            <div className={editing ? "pointer-events-none" : ""}>{cardOf.get(id)}</div>
            {editing && (
              <div data-reorder-tool className="absolute inset-x-2 bottom-2 z-20 flex items-center justify-between rounded-full bg-ink/90 p-1 text-cream shadow-soft">
                <button
                  type="button"
                  onClick={() => setOrder((list) => move(list, index, index - 1))}
                  disabled={index === 0}
                  className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15 disabled:opacity-25"
                  aria-label="Премести напред"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <span className="text-xs font-semibold tabular-nums">{index + 1}</span>
                <button
                  type="button"
                  onClick={() => setOrder((list) => move(list, index, index + 1))}
                  disabled={index === order.length - 1}
                  className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15 disabled:opacity-25"
                  aria-label="Премести назад"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
