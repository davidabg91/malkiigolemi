/* The small window behind the extension's icon: whether it is connected, the last run, and the "collect from all" button. */
const $ = (id) => document.getElementById(id);
const send = (message) => new Promise((resolve) => chrome.runtime.sendMessage(message, (reply) => resolve(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : reply)));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const ERRORS = {
  "not-connected": "Първо свържи разширението със сайта.",
  unauthorized: "Сайтът не прие ключа. Отвори Админ → От Facebook, за да се свърже отново.",
  offline: "Няма връзка със сайта. Провери интернета и опитай пак.",
};

async function show() {
  const s = await send({ type: "status" });
  $("version").textContent = s.ok ? `Версия ${s.version}` : "";
  if (!s.ok || !s.connected) {
    $("state").textContent = "Не е свързано със сайта";
    $("state").className = "state off";
    $("note").textContent = "Влез в админа на сайта и отвори „От Facebook“. Разширението се свързва само.";
    $("connect").hidden = false;
    $("all").hidden = $("admin").hidden = true;
    return;
  }
  $("state").textContent = "Свързано със сайта";
  $("state").className = "state";
  $("connect").hidden = true;
  $("all").hidden = $("admin").hidden = false;
  $("admin").href = `${s.api}/admin/facebook`;

  const crawl = s.crawl;
  if (!crawl) {
    $("note").textContent = "Отвори пост в групата и натисни кръглия бутон долу вляво, или събери от всички постове наведнъж.";
  } else if (crawl.stage !== "done") {
    $("note").textContent = crawl.stage === "scan" ? "Събирането върви: гледам постовете в групата…" : `Събирането върви: пост ${crawl.index + 1} от ${crawl.total}.`;
    $("all").textContent = "Покажи раздела със събирането";
  } else {
    const sum = crawl.summary;
    const found = sum.added > 0 ? `${plural(sum.added, "нова заявка", "нови заявки")} от ${plural(sum.withNew, "пост", "поста")}` : "няма нови заявки";
    $("note").textContent = `Последно събиране${crawl.stopped ? " (спряно)" : ""}: ${found}, прегледани ${plural(sum.visited, "пост", "поста")}.`;
  }
}

$("all").addEventListener("click", async () => {
  $("all").disabled = true;
  const reply = await send({ type: "startCrawl" });
  if (reply.ok) return window.close();
  $("note").textContent = ERRORS[reply.error] ?? `Нещо не се получи (${reply.error}).`;
  $("all").disabled = false;
});

send({ type: "seen" });
show();
