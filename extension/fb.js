/*
 * What the admin sees on Facebook: a small round button on the group's pages that opens a card with
 * "Вземи от този пост" and "Събери от всички постове", and a bar across the top of the tab that walks
 * through the posts one by one. Reading the page is in scrape.js; talking to the site is in background.js.
 */
(() => {
  if (globalThis.mgFbLoaded) return;
  globalThis.mgFbLoaded = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const send = (message) =>
    new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (reply) => resolve(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : (reply ?? { ok: false, error: "no-reply" })));
      } catch (e) {
        // The extension was reloaded while this tab stayed open.
        resolve({ ok: false, error: String(e?.message ?? e) });
      }
    });

  const ERRORS = {
    "not-connected": "Разширението още не е свързано със сайта. Отвори Админ → От Facebook в сайта.",
    unauthorized: "Сайтът не прие ключа. Отвори Админ → От Facebook в сайта, за да се свърже отново.",
    "no-post": "Не виждам отворен пост. Отвори поста (кликни върху датата му) и опитай пак.",
    offline: "Няма връзка със сайта. Провери интернета и опитай пак.",
    busy: "В момента разширението пише на клиенти. Опитай пак след минута.",
  };
  const explain = (error) => ERRORS[error] ?? `Нещо не се получи (${error}).`;
  /** Why the automatic answers stopped. */
  const explainReply = (problem) =>
    problem === "no-button" ? "Отговорите спряха: с този профил не може да се отговаря под коментарите." : "Отговорите спряха: Facebook не прие отговора. Опитай пак по-късно.";
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /** Set by "Спри": whatever is being read or answered at that moment is dropped and the tab stays where it is. */
  let stopped = false;
  /** True in the window of a run that started by itself (automatic collecting): it closes when the run is over. */
  let auto = false;

  /**
   * Leaves the automatic answer under the comments the site picked (plan = { text, pauseMs, max, ids }), with a pause
   * between two answers, and tells the site which ones are done. Stops at the first answer Facebook does not take.
   */
  async function answer(fbId, plan, onProgress) {
    const ids = plan.ids.slice(0, plan.max);
    const sent = [];
    const found = []; // already answered there by somebody
    let problem = null;
    for (const [i, id] of ids.entries()) {
      await shown();
      if (stopped) break;
      onProgress?.(i + 1, ids.length);
      const outcome = await globalThis.mgScrape.reply(id, plan.text);
      if (outcome === "sent") {
        sent.push(id);
        if (i < ids.length - 1) await sleep(plan.pauseMs);
      } else if (outcome === "answered") {
        found.push(id);
      } else if (outcome !== "missing") {
        problem = outcome;
        break;
      }
    }
    const report = await send({ type: "replied", fbId, ids: [...sent, ...found], sent: sent.length, problem });
    return { sent: sent.length, problem, report };
  }

  /* ---------- the card ---------- */

  const host = document.createElement("div");
  host.id = "mg-fb-orders";
  const shadow = host.attachShadow({ mode: "open" });
  // The styles go in as a stylesheet object, not a <style> tag: a page's content policy has no say over it.
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`
      :host { all: initial; }
      * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
      .launcher { position: fixed; left: 16px; bottom: 16px; z-index: 2147483000; width: 48px; height: 48px; border: 0; border-radius: 50%; background: #33484b; color: #fff; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,.28); display: grid; place-items: center; }
      .launcher:hover { background: #26383a; }
      .launcher svg { width: 24px; height: 24px; }
      .card { position: fixed; left: 16px; bottom: 76px; z-index: 2147483000; width: 300px; padding: 16px; border-radius: 16px; background: #fff; color: #1c2526; box-shadow: 0 12px 36px rgba(0,0,0,.3); font-size: 14px; line-height: 1.4; }
      .card h2 { margin: 0 0 10px; font-size: 15px; font-weight: 700; }
      .card button, .bar button, .bar a { display: block; width: 100%; height: 40px; margin-top: 8px; padding: 0 14px; border: 0; border-radius: 999px; font-size: 14px; font-weight: 600; cursor: pointer; text-align: center; text-decoration: none; line-height: 40px; }
      .primary { background: #33484b; color: #fff; }
      .primary:hover { background: #26383a; }
      .ghost { background: #eef1f1; color: #1c2526; }
      .ghost:hover { background: #e1e6e6; }
      button:disabled { opacity: .55; cursor: default; }
      .status { margin: 10px 0 0; min-height: 20px; color: #4a5759; }
      .status a { color: #1f5c3f; font-weight: 600; }
      .status.error { color: #b3261e; }
      .bar { position: fixed; left: 50%; top: 12px; transform: translateX(-50%); z-index: 2147483001; width: min(440px, calc(100vw - 24px)); padding: 14px 16px; border-radius: 16px; background: #1c2526; color: #fff; box-shadow: 0 12px 36px rgba(0,0,0,.4); font-size: 14px; line-height: 1.4; }
      .bar strong { display: block; font-size: 15px; }
      .bar p { margin: 4px 0 0; color: #c9d2d3; }
      .bar .row { display: flex; gap: 8px; }
      .bar .light { background: #fff; color: #1c2526; }
      .bar .dim { background: rgba(255,255,255,.14); color: #fff; }
      [hidden] { display: none !important; }
  `);
  shadow.adoptedStyleSheets = [sheet];
  shadow.innerHTML = `
    <button class="launcher" type="button" title="Поръчки към сайта" aria-label="Поръчки към сайта" hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
    </button>
    <div class="card" hidden>
      <h2>Поръчки от Facebook</h2>
      <button class="primary" type="button" data-do="one">Вземи поръчките от този пост</button>
      <button class="ghost" type="button" data-do="all">Събери от всички постове</button>
      <p class="status" role="status"></p>
    </div>
    <div class="bar" hidden>
      <strong></strong>
      <p></p>
      <div class="row">
        <a class="light" target="_blank" rel="noopener" hidden>Отвори заявките</a>
        <button class="dim" type="button"></button>
      </div>
    </div>`;
  const launcher = shadow.querySelector(".launcher");
  const card = shadow.querySelector(".card");
  const status = shadow.querySelector(".status");
  const oneButton = shadow.querySelector('[data-do="one"]');
  const allButton = shadow.querySelector('[data-do="all"]');
  const bar = shadow.querySelector(".bar");
  const barTitle = bar.querySelector("strong");
  const barText = bar.querySelector("p");
  const barLink = bar.querySelector("a");
  const barButton = bar.querySelector("button");

  function say(message, { error = false, link = null } = {}) {
    status.className = error ? "status error" : "status";
    status.textContent = message;
    if (link) {
      const a = document.createElement("a");
      a.href = link.href;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = link.label;
      status.append(" ", a);
    }
  }

  const onGroup = () => /^\/groups\//.test(location.pathname);
  /** True while this tab is the one walking through the posts; the card stays out of the way then. */
  let walking = false;

  function place() {
    if (!host.isConnected) (document.body ?? document.documentElement).append(host);
    launcher.hidden = walking || !onGroup();
    if (launcher.hidden) card.hidden = true;
  }

  launcher.addEventListener("click", () => {
    card.hidden = !card.hidden;
    if (!card.hidden) say("");
  });

  oneButton.addEventListener("click", async () => {
    oneButton.disabled = allButton.disabled = true;
    try {
      say("Чета коментарите…");
      const post = await globalThis.mgScrape.collect(({ count }) => say(`Чета коментарите… ${count}`));
      say("Пращам ги в сайта…");
      const reply = await send({ type: "collectOne", post });
      if (!reply.ok) return say(explain(reply.error), { error: true });
      const r = reply.result;
      if (!r.saved) return say("Под този пост още няма заявки за поръчка.");
      const head = r.added > 0 ? `${plural(r.added, "нова заявка", "нови заявки")}.` : "Няма нови заявки.";
      let answered = "";
      if (r.reply) {
        stopped = false;
        const done = await answer(post.fbId, r.reply, (n, of) => say(`${head} Отговарям под коментарите: ${n} от ${of}…`));
        answered = `${done.sent > 0 ? ` Отговорено под ${plural(done.sent, "коментар", "коментара")}.` : ""}${done.problem ? ` ${explainReply(done.problem)}` : ""}`;
      }
      say(`${head} Чакат общо ${r.pending}.${r.product ? "" : " Избери продукта в сайта."}${answered}`, { link: { href: reply.adminUrl, label: "Отвори в сайта" } });
    } catch (e) {
      say(explain(e?.message ?? String(e)), { error: true });
    } finally {
      oneButton.disabled = allButton.disabled = false;
    }
  });

  allButton.addEventListener("click", async () => {
    say("Отварям нов раздел, в който ще мина през постовете…");
    const reply = await send({ type: "startCrawl" });
    if (!reply.ok) say(explain(reply.error), { error: true });
    else say("Събирането върви в новия раздел. Остави го отворен и на преден план, докато приключи.");
  });

  /* ---------- walking through the posts (only in the tab the extension opened for it) ---------- */

  function showBar(title, text, { link = null, button = "Спри", onButton } = {}) {
    bar.hidden = false;
    barTitle.textContent = title;
    barText.textContent = text;
    barLink.hidden = !link;
    if (link) barLink.href = link;
    barButton.textContent = button;
    barButton.onclick = onButton;
  }

  /**
   * Facebook loads no more posts or comments into a page nobody can see (another tab in front, the window covered
   * or minimised). Reading waits here until the page is on the screen again; scrape.js asks before every step.
   */
  async function shown() {
    if (document.visibilityState === "visible") return;
    const before = barText.textContent;
    barText.textContent = auto ? "На пауза: този прозорец трябва да се вижда на екрана." : "На пауза: този раздел трябва да е на преден план.";
    for (let i = 0; document.visibilityState !== "visible" && !stopped; i++) {
      // The run's own window comes forward by itself once nobody is using the computer (background.js).
      if (i % 5 === 0) send({ type: "hidden" });
      await sleep(1000);
    }
    barText.textContent = before;
    await sleep(500);
  }
  globalThis.mgScrape.gate = shown;
  // Text would not go into a field while this window is behind another one: the window is brought forward.
  globalThis.mgScrape.needFocus = async () => {
    await send({ type: "focusMe" });
    await sleep(800);
  };

  /** Fails after this much time with the page on the screen; time spent waiting to be seen does not count. */
  async function giveUpAfter(ms) {
    for (let left = ms; left > 0; ) {
      await sleep(1000);
      if (document.visibilityState === "visible") left -= 1000;
    }
    throw new Error("timeout");
  }

  /** An automatic run is over: its window has nothing more to show. Not when the admin pressed "Спри" in it. */
  function closeAuto() {
    if (auto && !stopped) setTimeout(() => send({ type: "autoClose" }), 4000);
  }

  function showSummary(crawl) {
    send({ type: "runDone" });
    closeAuto();
    const s = crawl.summary;
    const title = crawl.stopped ? "Събирането е спряно" : "Готово";
    const found = s.added > 0 ? `${plural(s.added, "нова заявка", "нови заявки")} от ${plural(s.withNew, "пост", "поста")}${s.ordered > 0 ? `, ${s.ordered} добавени в поръчки` : ""}.` : "Няма нови заявки.";
    const rest = ` Прегледани ${plural(s.visited, "пост", "поста")}${s.failed > 0 ? `, ${s.failed} ${s.failed === 1 ? "не се отвори" : "не се отвориха"}` : ""}${s.old > 0 ? `, ${plural(s.old, "стар пост пропуснат", "стари поста пропуснати")}` : ""}.`;
    const answered = `${s.replied > 0 ? ` Отговорено под ${plural(s.replied, "коментар", "коментара")}.` : ""}${s.replyProblem ? ` ${explainReply(s.replyProblem)}` : ""}`;
    showBar(title, found + rest + answered, { link: crawl.adminUrl, button: "Затвори", onButton: () => (bar.hidden = true) });
  }

  async function stop() {
    stopped = true;
    const reply = await send({ type: "stopCrawl" });
    if (reply.ok && reply.crawl) showSummary(reply.crawl);
  }

  /** After a step: go to the next post, or show what was gathered. */
  async function advance(reply) {
    if (stopped) return;
    if (!reply.ok) {
      send({ type: "runDone", problem: reply.error });
      closeAuto();
      return showBar("Събирането спря", explain(reply.error), { button: "Затвори", onButton: () => (bar.hidden = true) });
    }
    const crawl = reply.crawl;
    if (crawl.stage === "done") return showSummary(crawl);
    // A short pause so the pages are not opened faster than a person would open them.
    await sleep(2000);
    location.href = crawl.current.url;
  }

  async function walk(crawl) {
    walking = true;
    auto = crawl.auto;
    place();
    if (crawl.stage === "done") return showSummary(crawl);
    const heading = auto ? "Автоматично събиране на поръчките" : "Събирам поръчките";
    const keep = auto ? "Прозорецът се затваря сам." : "Остави този раздел отворен и на преден план.";

    if (crawl.stage === "scan") {
      showBar(heading, "Гледам кои постове в групата имат коментари…", { onButton: stop });
      const posts = await globalThis.mgScrape.scanFeed(({ count }) => (barText.textContent = `Гледам кои постове в групата имат коментари… ${count}`));
      return advance(await send({ type: "scanned", posts }));
    }

    const here = globalThis.mgScrape.postInAddress();
    if (here?.fbId !== crawl.current.fbId) {
      // The tab is somewhere else (Facebook redirected, or the admin clicked around): go to the post, once.
      const tried = sessionStorage.getItem("mg-fb-try") === crawl.current.fbId;
      if (!tried) {
        sessionStorage.setItem("mg-fb-try", crawl.current.fbId);
        location.href = crawl.current.url;
        return;
      }
      return advance(await send({ type: "collected", fbId: crawl.current.fbId, error: "no-post" }));
    }

    const progress = `Пост ${crawl.index + 1} от ${crawl.total}`;
    showBar(heading, `${progress}. ${keep}`, { onButton: stop });
    let message;
    try {
      // A post that will not finish loading is given up on, so one bad page cannot hold up the rest.
      const post = await Promise.race([globalThis.mgScrape.collect(({ count }) => (barText.textContent = `${progress} · ${plural(count, "коментар", "коментара")}. ${keep}`)), giveUpAfter(240000)]);
      message = { type: "collected", fbId: crawl.current.fbId, post };
    } catch (e) {
      message = { type: "collected", fbId: crawl.current.fbId, error: e?.message ?? String(e) };
    }
    if (stopped) return;
    let reply = await send(message);
    if (reply.ok && reply.reply) {
      // The post is still open: answer the comments the site picked before moving on.
      const done = await answer(crawl.current.fbId, reply.reply, (n, of) => (barText.textContent = `${progress} · отговарям под коментарите (${n} от ${of}). ${keep}`));
      if (done.report.ok && done.report.crawl) reply = done.report;
    }
    return advance(reply);
  }

  /* ---------- writing to customers (only in the window the extension opened for it) ---------- */

  /**
   * This page is a customer's page inside the group, opened to tell them their order waits in the shop
   * (the admin pressed "Готова за взимане" in the site). Writes the message in the chat, reports it, and
   * goes on to the next person after a pause, or closes the window.
   */
  async function deliver(message, position) {
    walking = true;
    auto = true;
    place();
    const head = `Съобщение ${position.index + 1} от ${position.total}: ${message.name}`;
    const halt = async () => {
      stopped = true;
      await send({ type: "outboxClose", keep: true });
      showBar("Спряно", "Неизпратените съобщения остават да чакат.", { button: "Затвори", onButton: () => (bar.hidden = true) });
    };
    showBar("Пиша на клиентите", `${head}. Прозорецът се затваря сам.`, { onButton: halt });

    let outcome;
    // A page that reloaded in the middle of writing may have sent it already: never write the same message twice.
    const mark = `mg-fb-message-${message.id}`;
    if (sessionStorage.getItem(mark)) outcome = "unsure";
    else {
      sessionStorage.setItem(mark, "1");
      try {
        outcome = await Promise.race([globalThis.mgScrape.message(message.userId, message.name, message.text), giveUpAfter(90000)]);
      } catch (e) {
        outcome = e?.message === "timeout" ? "timeout" : "no-type";
      }
    }
    if (stopped) return;
    const reply = await send({ type: "messageDone", id: message.id, outcome, detail: outcome === "sent" ? "" : (globalThis.mgScrape.note ?? "") });
    if (stopped) return;
    if (reply.ok && reply.next) {
      barText.textContent = `${outcome === "sent" ? "Изпратено" : "Не се получи"}. Следващото съобщение е след малко…`;
      await sleep(reply.pauseMs);
      if (!stopped) location.href = reply.next.profileUrl;
      return;
    }
    const sent = reply.ok ? reply.sent : outcome === "sent" ? 1 : 0;
    const failed = reply.ok ? reply.failed : outcome === "sent" ? 0 : 1;
    showBar("Готово", `${sent > 0 ? `Изпратени: ${sent}.` : "Нищо не е изпратено."}${failed > 0 ? ` Неуспешни: ${failed} (причината е в поръчката в сайта).` : ""}`, { button: "Затвори", onButton: () => (bar.hidden = true) });
    setTimeout(() => send({ type: "outboxClose" }), 4000);
  }

  /* ---------- start ---------- */

  // Facebook changes pages without reloading, so keep checking where we are.
  place();
  setInterval(place, 1000);

  send({ type: "hello" }).then((reply) => {
    if (reply.ok && reply.crawl) walk(reply.crawl);
    else if (reply.ok && reply.message) deliver(reply.message, reply.position);
  });
})();
