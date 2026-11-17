/*
 * Runs on the shop's pages (the admin panel is reached without a reload, so it cannot be matched by address).
 * Админ → От Facebook carries the key the extension needs
 * (an element with id "fb-extension-key"); this hands it to the extension and tells the page it is connected.
 */
(() => {
  function connect() {
    const el = document.getElementById("fb-extension-key");
    if (!el || el.dataset.connected || el.dataset.asked) return;
    el.dataset.asked = "1";
    try {
      chrome.runtime.sendMessage({ type: "connect", api: location.origin, token: el.dataset.key }, (reply) => {
        if (chrome.runtime.lastError || !reply?.ok) return;
        el.dataset.connected = reply.version;
        window.dispatchEvent(new Event("fb-extension-connected"));
      });
    } catch {
      // The extension was reloaded while this page stayed open; a refresh of the page connects it.
    }
  }
  // The admin panel changes pages without reloading, so watch for the element to appear.
  new MutationObserver(connect).observe(document.documentElement, { childList: true, subtree: true });
  connect();
})();
