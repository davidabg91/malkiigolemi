/**
 * Tells the browser extension (extension/site.js watches for this element) that messages for Facebook customers
 * are waiting, so it sends them at once instead of at its next check. Shows nothing.
 */
export function FbOutboxMarker({ pending }: { pending: number }) {
  return pending > 0 ? <span id="fb-extension-outbox" data-pending={pending} hidden /> : null;
}
