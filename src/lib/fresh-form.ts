import { useLayoutEffect, useRef, useState } from "react";

/**
 * Keeps an edit form from showing old data. A page that is left stays mounted (hidden) with everything in
 * it, so the form that was just saved comes back as it was, and a field filled from `defaultValue` does not
 * follow the new value the server sends. The form is therefore started over, by giving it a new `key`:
 *
 * - once the page is left after the form was sent or given up (`done()`), so the next visit starts clean;
 * - when what the server has (`version`) changes and nobody has typed in the form (`touch()`), so a number
 *   changed elsewhere (an order taking stock) shows up, without throwing away what is being typed.
 *
 * A draft that was neither sent nor given up is kept, as on every other page.
 */
export function useFreshForm(version: string) {
  const [shown, setShown] = useState({ version, round: 0 });
  const [touched, setTouched] = useState(false);
  const finished = useRef(false);

  if (version !== shown.version && !touched) setShown((s) => ({ ...s, version }));

  // The cleanup runs when the page is hidden (and when it is removed).
  useLayoutEffect(
    () => () => {
      if (!finished.current) return;
      finished.current = false;
      setTouched(false);
      setShown((s) => ({ ...s, round: s.round + 1 }));
    },
    [],
  );

  return {
    key: `${shown.round}:${shown.version}`,
    /** Something in the form was changed by hand. */
    touch: () => setTouched(true),
    /** The form was sent or given up; `done(false)` takes it back (the server refused what was sent). */
    done: (yes = true) => {
      finished.current = yes;
    },
  };
}

export type FreshForm = Pick<ReturnType<typeof useFreshForm>, "touch" | "done">;
