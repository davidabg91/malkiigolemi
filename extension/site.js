/*
 * Runs on the shop's pages (the admin panel is reached without a reload, so it cannot be matched by address).
 * Админ → От Facebook carries the key the extension needs
 * (an element with id "fb-extension-key"); this hands it to the extension and tells the page it is connected.
 * A page that knows of messages waiting for Facebook customers carries an element with id "fb-extension-outbox";
 * seeing it, the extension sends them now instead of at its next check.
 */
(() => {
  const tell = (message, done) => {
    try {
      chrome.runtime.sendMessage(message, (reply) => {
        if (!chrome.runtime.lastError && reply?.ok) done?.(reply);
      });
    } catch {
      // The extension was reloaded while this page stayed open; a refresh of the page connects it.
    }
  };

  function look() {
    const key = document.getElementById("fb-extension-key");
    if (key && !key.dataset.connected && !key.dataset.asked) {
      key.dataset.asked = "1";
      tell({ type: "connect", api: location.origin, token: key.dataset.key }, (reply) => {
        key.dataset.connected = reply.version;
        window.dispatchEvent(new Event("fb-extension-connected"));
      });
    }
    const outbox = document.getElementById("fb-extension-outbox");
    if (outbox && !outbox.dataset.told) {
      outbox.dataset.told = "1";
      tell({ type: "outbox" });
    }
  }
  // The admin panel changes pages without reloading, so watch for the elements to appear.
  new MutationObserver(look).observe(document.documentElement, { childList: true, subtree: true });
  look();
})();
