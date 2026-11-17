"use client";

import { ExternalLink, Loader2, Plus, X } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { addClaimToPersonOrder, setClaimStatus } from "@/actions/facebook";

export type ReviewRow = {
  id: number;
  name: string;
  comment: string;
  qty: number;
  postId: number;
  postName: string;
  /** The comment on Facebook, when the script read its number. */
  link: string | null;
  hasProduct: boolean;
  colors: string[];
  stock: number | null;
  why: string;
  unclear: boolean;
  when: string;
};

/**
 * One comment a person should look at (Админ → От Facebook, "За проверка"): what it says, why the script did
 * not put it in an order, and the two answers: add it to the person's order with this many pieces, or not an order.
 */
export function FbReviewItem({ row }: { row: ReviewRow }) {
  const [state, action, pending] = useActionState(addClaimToPersonOrder.bind(null, row.id), undefined);

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 font-semibold">
          {row.name}
          <span className={`ml-2 rounded-full px-2 py-0.5 text-[0.7rem] font-bold ${row.unclear ? "bg-sand text-ink-soft" : "bg-sun/50"}`}>{row.unclear ? "не е разпознат" : "чака"}</span>
        </p>
        <p className="text-xs text-ink-soft">{row.when}</p>
      </div>
      <p className="mt-1 text-[0.95rem]">„{row.comment}“</p>
      <p className="mt-1 text-xs text-ink-soft">
        <Link href={`/admin/facebook/${row.postId}`} className="font-semibold text-forest hover:underline">
          {row.postName}
        </Link>
        {row.link && (
          <>
            {" · "}
            <a href={row.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
              виж във Facebook <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </>
        )}
      </p>
      <p className="mt-1 text-xs font-medium text-ink-soft">{row.why}</p>

      {row.hasProduct ? (
        <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Брой</span>
            <input type="number" name="qty" min={1} max={99} defaultValue={row.qty} className="field h-10 w-20 text-center" aria-invalid={Boolean(state?.fieldErrors?.qty)} />
            бр
          </label>
          {row.colors.length > 0 && (
            <select name="color" defaultValue="" required aria-label="Цвят" className="field h-10 w-auto" aria-invalid={Boolean(state?.fieldErrors?.color)}>
              <option value="" disabled>
                Цвят…
              </option>
              {row.colors.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <button type="submit" disabled={pending} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest px-4 text-sm font-semibold text-cream transition hover:opacity-90 disabled:opacity-60">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            Добави към поръчката
          </button>
          <button
            type="submit"
            formAction={setClaimStatus.bind(null, row.id, "rejected")}
            formNoValidate
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-soft transition hover:bg-sand hover:text-tomato"
          >
            <X className="h-4 w-4" aria-hidden />
            Не е поръчка
          </button>
          {row.stock != null && <span className="text-xs text-ink-soft">наличност в сайта: {row.stock} бр</span>}
          {state?.error && (
            <p role="alert" className="w-full text-sm font-medium text-tomato">
              {state.error}
            </p>
          )}
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link href={`/admin/facebook/${row.postId}`} className="inline-flex h-10 items-center rounded-full bg-forest px-4 text-sm font-semibold text-cream hover:opacity-90">
            Избери продукта на поста
          </Link>
          <form action={setClaimStatus.bind(null, row.id, "rejected")}>
            <button type="submit" className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-soft transition hover:bg-sand hover:text-tomato">
              <X className="h-4 w-4" aria-hidden />
              Не е поръчка
            </button>
          </form>
        </div>
      )}
    </li>
  );
}
