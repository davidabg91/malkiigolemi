import type { TrackingEvent } from "@/lib/econt";

const when = (iso: string) =>
  new Date(iso).toLocaleString("bg-BG", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia" });

/** A shipment's history from the courier, newest first. Used in the admin and in "Моите поръчки". */
export function TrackingTimeline({ events }: { events: TrackingEvent[] }) {
  if (events.length === 0) return null;
  return (
    <ol className="mt-3 space-y-2.5 border-l-2 border-line pl-4">
      {[...events].reverse().map((e, i) => (
        <li key={`${e.time}-${i}`} className="relative text-sm">
          <span className={`absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-forest" : "bg-line"}`} aria-hidden />
          <p className={i === 0 ? "font-semibold" : ""}>{e.text}</p>
          <p className="text-xs text-ink-soft">
            {when(e.time)}
            {e.place && ` · ${e.place}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
