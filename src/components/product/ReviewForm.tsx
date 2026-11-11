"use client";

import { Check, Loader2, Star } from "lucide-react";
import { useActionState, useState } from "react";
import { submitReview } from "@/actions/reviews";
import { btn } from "@/components/ui";

const LABELS = ["", "Лошо", "Слабо", "Добре", "Много добре", "Отлично"];

export function ReviewForm({ productId, initial }: { productId: number; initial: { rating: number; body: string } | null }) {
  const [state, action, pending] = useActionState(submitReview.bind(null, productId), undefined);
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const shown = hover || rating;

  return (
    <form action={action} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Твоята оценка</legend>
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer rounded-lg p-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-forest" onMouseEnter={() => setHover(n)}>
              <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" aria-label={`${n} от 5: ${LABELS[n]}`} />
              <Star className={`h-8 w-8 transition ${n <= shown ? "text-[#e8a317]" : "text-line"}`} fill="currentColor" strokeWidth={0} aria-hidden />
            </label>
          ))}
          <span className="ml-2 text-sm font-medium text-ink-soft" aria-live="polite">
            {LABELS[shown]}
          </span>
        </div>
      </fieldset>
      <div>
        <label htmlFor={`review-body-${productId}`} className="mb-1.5 block text-sm font-medium">
          Мнение <span className="font-normal text-ink-soft">(по желание)</span>
        </label>
        <textarea
          id={`review-body-${productId}`}
          name="body"
          rows={3}
          maxLength={1000}
          defaultValue={initial?.body ?? ""}
          placeholder="Какво ти хареса? Би ли го купил пак?"
          className="field h-auto py-3"
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending || rating === 0} className={btn.primary}>
          {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
          {initial ? "Обнови отзива" : "Публикувай отзива"}
        </button>
        {state?.ok && (
          <p role="status" className="inline-flex items-center gap-2 text-sm font-semibold text-forest">
            <Check className="h-4 w-4" aria-hidden />
            Благодарим за отзива!
          </p>
        )}
        {state?.error && (
          <p role="alert" className="text-sm font-medium text-tomato">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
