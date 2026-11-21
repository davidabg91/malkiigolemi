/*
 * Runs in Facebook's own world (the other scripts of the extension live apart from the page's scripts).
 * scrape.js marks a writing field and asks, with an "mg-fb-type" event, for text to be pasted into it. A paste
 * made here reaches Facebook's editor exactly the way a person's paste does, lines and all.
 * It only ever touches the field scrape.js marked, and only puts the caret at its end and pastes.
 */
(() => {
  window.addEventListener("mg-fb-type", (event) => {
    let job;
    try {
      job = JSON.parse(event.detail);
    } catch {
      return;
    }
    if (typeof job?.token !== "string" || !/^[a-z0-9]{4,20}$/.test(job.token) || typeof job.words !== "string") return;
    const box = document.querySelector(`[data-mg-type="${job.token}"]`);
    if (!box) return;
    box.removeAttribute("data-mg-type");
    box.focus();
    const selection = getSelection();
    selection.selectAllChildren(box);
    selection.collapseToEnd();
    const data = new DataTransfer();
    data.setData("text/plain", job.words);
    box.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
})();
