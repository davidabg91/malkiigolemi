"use client";

import { BellRing, Loader2, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAdminNotices, sendTestNotice } from "@/actions/chat";
import { btn } from "@/components/ui";
import { ADMIN_NOTICES, type AdminNoticePrefs } from "@/lib/notices";

/** Админ → Известия: which events ring the shop's phones, and a test button. */
export function NoticeSettings({ prefs }: { prefs: AdminNoticePrefs }) {
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const [dirty, setDirty] = useState(false);

  return (
    <form
      action={(formData) =>
        startSave(async () => {
          await saveAdminNotices(formData);
          setDirty(false);
          toast.success("Настройките са запазени");
        })
      }
      onChange={() => setDirty(true)}
    >
      <ul className="divide-y divide-line">
        {ADMIN_NOTICES.map((n) => (
          <li key={n.key}>
            <label className="flex cursor-pointer items-center gap-4 px-5 py-4 transition hover:bg-sand/50">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{n.label}</span>
                <span className="block text-sm text-ink-soft">{n.hint}</span>
              </span>
              <input type="checkbox" name={n.key} defaultChecked={prefs[n.key]} className="peer sr-only" />
              {/* A switch: the knob slides right and the track turns dark when on. */}
              <span className="relative h-7 w-12 shrink-0 rounded-full bg-line transition peer-checked:bg-forest peer-focus-visible:ring-2 peer-focus-visible:ring-forest peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5" aria-hidden />
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3 border-t border-line p-5">
        <button type="submit" disabled={saving || !dirty} className={btn.primary}>
          {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Save className="h-5 w-5" aria-hidden />}
          Запази
        </button>
        <button
          type="button"
          disabled={testing}
          onClick={() =>
            startTest(async () => {
              const sent = await sendTestNotice().catch(() => 0);
              if (sent > 0) toast.success("Пробното известие е изпратено");
              else toast.error("Няма устройство с включени известия за този профил. Включи ги от картата по-горе.");
            })
          }
          className={btn.ghost}
        >
          {testing ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <BellRing className="h-5 w-5" aria-hidden />}
          Изпрати пробно известие
        </button>
      </div>
    </form>
  );
}
