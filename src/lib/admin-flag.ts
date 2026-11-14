import { useSyncExternalStore } from "react";

/**
 * Whether the visitor is an admin, for shop components that add admin tools (reordering products).
 * The header learns it from the server with the session and passes it on here, so nothing else has to ask.
 */
let admin = false;
const listeners = new Set<() => void>();

export function setIsAdmin(value: boolean) {
  if (value === admin) return;
  admin = value;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useIsAdmin() {
  return useSyncExternalStore(subscribe, () => admin, () => false);
}
