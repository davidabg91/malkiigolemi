"use client";

import { BadgePercent, Check, ChevronLeft, ChevronRight, Loader2, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { reorderCategories } from "@/actions/admin";
import { CategoryIcon } from "@/components/ui";
import type { MenuCategory } from "./HeaderClient";

export interface CategoryNavProps {
  tree: MenuCategory[];
  items?: MenuCategory[];
  setItems?: React.Dispatch<React.SetStateAction<MenuCategory[]>>;
  isEditing?: boolean;
  setIsEditing?: (val: boolean) => void;
  isAdmin?: boolean;
}

/**
 * A category button in the header row: a raised card with the icon above its name. On a phone its size
 * follows the scroll position (`.cat-chip` and `--p` in globals.css), so the sticky header leaves more of
 * the screen to the products.
 */
const chip =
  "cat-chip group flex h-[4.25rem] min-w-[5.25rem] max-w-[8rem] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl px-3 text-center text-[0.8rem] font-semibold leading-[1.15] text-ink transition-[filter,scale] duration-200 raised hover:brightness-[0.97] active:scale-95";
const chipIcon = "cat-chip-icon h-6 w-6 shrink-0";

/** How far the page must be scrolled for the buttons to reach their small size, in pixels. */
const SHRINK_OVER = 150;

/**
 * Keeps `--p` on the row in step with the scroll position: 0 at the top of the page, 1 once it is scrolled
 * `SHRINK_OVER` pixels. It is written straight to the element, once per frame, so scrolling re-renders nothing.
 */
function useScrollProgress(row: React.RefObject<HTMLElement | null>, frozen: boolean) {
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const t = frozen ? 0 : Math.min(1, Math.max(0, window.scrollY / SHRINK_OVER));
      // Eased at both ends, so the shrinking starts and settles gently.
      el.style.setProperty("--p", (t * t * (3 - 2 * t)).toFixed(4));
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [row, frozen]);
}

// A 14-point starburst around the centre of a 48×48 box.
const BURST = Array.from({ length: 28 }, (_, i) => {
  const r = i % 2 ? 19.5 : 23.5;
  const a = (i * Math.PI) / 14;
  return `${(24 + r * Math.sin(a)).toFixed(2)},${(24 - r * Math.cos(a)).toFixed(2)}`;
}).join(" ");

/** The red "NEW" sticker shops put on fresh arrivals. */
function NewSign({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <polygon points={BURST} className="fill-tomato" />
      <text
        x="24"
        y="29"
        textAnchor="middle"
        transform="rotate(-12 24 24)"
        className="fill-white"
        style={{ font: "900 14.5px var(--font-onest), sans-serif", letterSpacing: "0.02em" }}
      >
        NEW
      </text>
    </svg>
  );
}

export function arrayMove<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
    return list;
  }
  const result = [...list];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

export function CategoryNav({
  tree,
  items: controlledItems,
  setItems: controlledSetItems,
  isEditing: controlledIsEditing,
  setIsEditing: controlledSetIsEditing,
  isAdmin = false,
}: CategoryNavProps) {
  const [localItems, setLocalItems] = useState<MenuCategory[]>(tree);
  const [localIsEditing, setLocalIsEditing] = useState(false);

  const items = controlledItems ?? localItems;
  const setItems = controlledSetItems ?? setLocalItems;
  const isEditing = controlledIsEditing !== undefined ? controlledIsEditing : localIsEditing;
  const setIsEditing = controlledSetIsEditing ?? setLocalIsEditing;

  // Take a new menu from the server, unless the admin is in the middle of reordering it.
  const [syncedTree, setSyncedTree] = useState(tree);
  if (tree !== syncedTree && !isEditing && !controlledItems) {
    setSyncedTree(tree);
    setLocalItems(tree);
  }

  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [savedToast, setSavedToast] = useState(false);
  const rowRef = useRef<HTMLElement>(null);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const hasTriggeredLongPress = useRef(false);


  const triggerWiggle = () => {
    if (!isAdmin) return;
    setIsEditing(true);
    hasTriggeredLongPress.current = true;
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([45, 30, 45]);
      } catch {
        // Haptics not supported or permitted; ignore
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isAdmin || isEditing) return;
    hasTriggeredLongPress.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      triggerWiggle();
    }, 450);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startPos.current || !longPressTimer.current) return;
    const dx = Math.abs(e.clientX - startPos.current.x);
    const dy = Math.abs(e.clientY - startPos.current.y);
    if (dx > 8 || dy > 8) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleSaveAndExit = () => {
    startTransition(async () => {
      try {
        await reorderCategories(items.map((c) => c.id));
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 3000);
      } catch (err) {
        console.error("Failed to reorder categories:", err);
      } finally {
        setIsEditing(false);
        setDraggingId(null);
        setDragOverId(null);
      }
    });
  };

  // Keyboard shortcut: Escape exits/saves. The effect event always saves the latest order.
  const onEscape = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") handleSaveAndExit();
  });
  useEffect(() => {
    if (!isEditing) return;
    const handleKey = (e: KeyboardEvent) => onEscape(e);
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isEditing]);

  const moveLeft = (index: number) => {
    if (index <= 0) return;
    setItems((prev) => arrayMove(prev, index, index - 1));
  };

  const moveRight = (index: number) => {
    if (index >= items.length - 1) return;
    setItems((prev) => arrayMove(prev, index, index + 1));
  };

  // Drag-and-drop handlers for desktop / mouse
  const handleDragStart = (e: React.DragEvent, id: number) => {
    if (!isEditing) return;
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(id));
  };

  const handleDragOver = (e: React.DragEvent, id: number) => {
    if (!isEditing || draggingId === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== id) {
      setDragOverId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: number) => {
    if (!isEditing || draggingId === null) return;
    e.preventDefault();
    const fromIndex = items.findIndex((c) => c.id === draggingId);
    const toIndex = items.findIndex((c) => c.id === targetId);
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      setItems((prev) => arrayMove(prev, fromIndex, toIndex));
    }
    setDraggingId(null);
    setDragOverId(null);
  };

  // While the admin is arranging the buttons they keep their full size.
  useScrollProgress(rowRef, isEditing);

  return (
    <div className="relative">
      {/* Admin wiggle mode active banner */}
      {isEditing && (
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-forest-deep px-4 py-2.5 text-cream shadow-lift animate-rise">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span className="font-semibold text-lime">Режим на подреждане:</span>
            <span className="text-cream/80">
              Хвани и премести с мишката или използвай стрелките ‹ ›.
            </span>
          </div>
          <button
            type="button"
            onClick={handleSaveAndExit}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-lime px-4 py-1.5 text-xs font-bold text-ink shadow transition hover:bg-lime-deep hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 stroke-[3]" />}
            <span>{isPending ? "Запазване..." : "Готово"}</span>
          </button>
        </div>
      )}

      {/* Confirmation toast when order is saved */}
      {savedToast && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-forest px-3.5 py-1.5 text-xs font-semibold text-white shadow-soft animate-rise">
          <Check className="h-3.5 w-3.5 text-lime" />
          <span>Новата подредба на категориите е запазена успешно!</span>
        </div>
      )}

      <nav
        ref={rowRef}
        aria-label="Категории"
        // Centred on a computer; "safe" keeps the first buttons reachable when the row is wider than the screen.
        className="cat-row no-scrollbar -mx-2 flex items-center gap-2 overflow-x-auto px-2 pb-3 pt-1 md:justify-center-safe"
      >
        {items.map((c, index) => {
          const isOdd = index % 2 !== 0;
          const isCurrentDragging = draggingId === c.id;
          const isOver = dragOverId === c.id && draggingId !== c.id;

          const wiggleClass = isEditing
            ? isOdd
              ? "animate-[ios-jiggle_0.28s_ease-in-out_infinite_alternate]"
              : "animate-[ios-jiggle-alt_0.31s_ease-in-out_infinite_alternate]"
            : "";

          return (
            <div
              key={c.id}
              draggable={isEditing}
              onDragStart={(e) => handleDragStart(e, c.id)}
              onDragOver={(e) => handleDragOver(e, c.id)}
              onDrop={(e) => handleDrop(e, c.id)}
              onDragEnd={() => {
                setDraggingId(null);
                setDragOverId(null);
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`relative shrink-0 select-none transition-all duration-150 ${wiggleClass} ${
                isCurrentDragging ? "opacity-30 scale-95" : ""
              } ${isOver ? "scale-105 ring-2 ring-lime ring-offset-2" : ""}`}
            >
              {isEditing ? (
                <div
                  className="group relative flex items-center gap-1.5 rounded-full border border-forest/30 bg-paper px-3 py-1.5 text-xs font-semibold text-ink shadow-soft hover:border-forest"
                  onClick={(e) => e.preventDefault()}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLeft(index);
                    }}
                    disabled={index === 0}
                    className="grid h-5 w-5 place-items-center rounded-full bg-sand text-ink-soft hover:bg-forest hover:text-white disabled:opacity-20"
                    title="Премести наляво"
                    aria-label={`Премести ${c.name} наляво`}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>

                  <span className="grid h-5 w-5 place-items-center rounded-md bg-sand text-[10px] text-ink">
                    <CategoryIcon name={c.icon} className="h-3.5 w-3.5" />
                  </span>
                  <span className="cursor-grab active:cursor-grabbing font-medium">{c.name}</span>
                  <span className="text-[10px] text-ink-soft/70 font-mono">#{index + 1}</span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveRight(index);
                    }}
                    disabled={index === items.length - 1}
                    className="grid h-5 w-5 place-items-center rounded-full bg-sand text-ink-soft hover:bg-forest hover:text-white disabled:opacity-20"
                    title="Премести надясно"
                    aria-label={`Премести ${c.name} надясно`}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <Link
                  href={`/kategoria/${c.slug}`}
                  onClick={(e) => {
                    if (hasTriggeredLongPress.current) {
                      e.preventDefault();
                      hasTriggeredLongPress.current = false;
                    }
                  }}
                  className={chip}
                >
                  <CategoryIcon name={c.icon} className={chipIcon} />
                  <span>{c.name}</span>
                </Link>
              )}
            </div>
          );
        })}

        {/* Static Special Links */}
        <Link href="/promo" className={`${chip} !text-tomato`}>
          <BadgePercent className={chipIcon} strokeWidth={1.75} aria-hidden />
          Промоции
        </Link>
        <Link href="/novi" className={chip}>
          <NewSign className="cat-chip-sign -my-1 h-8 w-8 shrink-0" />
          Нови продукти
        </Link>

        {/* Admin trigger button if not in editing mode */}
        {isAdmin && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            title="Задръж с мишката/пръста или натисни тук за пренареждане на категориите"
            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-forest/40 md:ml-0 bg-forest/5 px-2.5 py-1 text-xs font-semibold text-forest transition hover:bg-forest hover:text-white"
          >
            <SlidersHorizontal className="h-3 w-3" />
            <span className="hidden sm:inline">Подреди</span>
          </button>
        )}
      </nav>
    </div>
  );
}
