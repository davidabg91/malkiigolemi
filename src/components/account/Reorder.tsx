"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { reorder } from "@/actions/account";
import { btn } from "@/components/ui";
import { useCart } from "@/lib/store";

/** Puts a past order's still-available products back in the cart at today's prices. */
export function ReorderButton({ orderId }: { orderId: number }) {
  const [pending, start] = useTransition();
  const add = useCart((s) => s.add);
  const openCart = useCart((s) => s.setOpen);

  return (
    <button
      type="button"
      disabled={pending}
      className={btn.sm}
      onClick={() =>
        start(async () => {
          const result = await reorder(orderId);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          if (result.items.length === 0) {
            toast.error("Нито един от продуктите не е наличен в момента.");
            return;
          }
          for (const { qty, ...product } of result.items) add(product, qty);
          openCart(true);
          if (result.missing.length > 0) {
            toast("Някои продукти не са налични", { description: result.missing.join(", "), duration: 6000 });
          } else if (result.reduced.length > 0) {
            toast("Намалихме количеството според наличността", { description: result.reduced.join(", "), duration: 6000 });
          } else {
            toast.success("Продуктите са добавени в количката");
          }
        })
      }
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
      Поръчай пак
    </button>
  );
}
