import { ORDER_STATUS_LABELS } from "@/lib/site";

const STYLES: Record<string, string> = {
  new: "bg-sun/40 text-[#5a4300]",
  confirmed: "bg-[#cde5f6] text-[#0c3350]",
  shipped: "bg-[#e2d8f7] text-[#2f1f5c]",
  delivered: "bg-[#cdebd3] text-[#0f3d26]",
  cancelled: "bg-tomato/15 text-tomato",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[status] ?? "bg-sand text-ink"}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}
