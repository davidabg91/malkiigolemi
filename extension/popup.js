/* The small window behind the extension's icon: whether it is connected, the last run, "collect from all", and automatic collecting. */
const $ = (id) => document.getElementById(id);
const send = (message) => new Promise((resolve) => chrome.runtime.sendMessage(message, (reply) => resolve(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : reply)));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const clock = (time) => new Date(time).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });
/** "14:35", or "утре в 08:12" when the next run is not today. */
const when = (time) => (new Date(time).toDateString() === new Date().toDateString() ? clock(time) : `утре в ${clock(time)}`);

const ERRORS = {
  "not-connected": "Първо свържи разширението със сайта.",
  unauthorized: "Сайтът не прие ключа. Отвори Админ → От Facebook, за да се свърже отново.",
  offline: "Няма връзка със сайта. Провери интернета и опитай пак.",
  stuck: "не приключи навреме: прозорецът му не се виждаше на екрана или Facebook не отговори.",
};
const explain = (error) => ERRORS[error] ?? `Нещо не се получи (${error}).`;

function showAuto(auto, next, error) {
  $("auto-on").checked = auto.enabled;
  $("auto-min").value = auto.min;
  $("auto-max").value = auto.max;
  $("auto-from").value = auto.from;
  $("auto-to").value = auto.to;
  $("auto-awake").checked = auto.awake;
  $("auto-more").hidden = !auto.enabled;
  $("auto-note").textContent = auto.enabled
    ? `${next ? `Следващо събиране: около ${when(next)}. ` : ""}Отваря се малък прозорец с групата и се затваря сам. Chrome трябва да е отворен, а прозорецът да не е закрит изцяло.`
    : "Разширението само минава през постовете през различен интервал, без да го пускаш на ръка.";
  $("auto-error").hidden = !(auto.enabled && error);
  if (error) $("auto-error").textContent = error.error === "stuck" ? `Събирането в ${clock(error.at)} ${ERRORS.stuck}` : `Събирането в ${clock(error.at)} не започна. ${explain(error.error)}`;
}

async function show() {
  const s = await send({ type: "status" });
  $("version").textContent = s.ok ? `Версия ${s.version}` : "";
  if (!s.ok || !s.connected) {
    $("state").textContent = "Не е свързано със сайта";
    $("state").className = "state off";
    $("note").textContent = "Влез в админа на сайта и отвори „От Facebook“. Разширението се свързва само.";
    $("connect").hidden = false;
    $("all").hidden = $("admin").hidden = $("auto").hidden = true;
    return;
  }
  $("state").textContent = "Свързано със сайта";
  $("state").className = "state";
  $("connect").hidden = true;
  $("all").hidden = $("admin").hidden = $("auto").hidden = false;
  $("admin").href = `${s.api}/admin/facebook`;
  showAuto(s.auto, s.autoNext, s.autoError);

  const crawl = s.crawl;
  if (!crawl) {
    $("note").textContent = "Отвори пост в групата и натисни кръглия бутон долу вляво, или събери от всички постове наведнъж.";
  } else if (crawl.stage !== "done") {
    $("note").textContent = crawl.stage === "scan" ? "Събирането върви: гледам постовете в групата…" : `Събирането върви: пост ${crawl.index + 1} от ${crawl.total}.`;
    $("all").textContent = crawl.auto ? "Покажи прозореца със събирането" : "Покажи раздела със събирането";
  } else {
    const sum = crawl.summary;
    const found = sum.added > 0 ? `${plural(sum.added, "нова заявка", "нови заявки")} от ${plural(sum.withNew, "пост", "поста")}` : "няма нови заявки";
    const kind = `${crawl.auto ? "автоматично, " : ""}${crawl.finishedAt ? clock(crawl.finishedAt) : ""}${crawl.stopped ? ", спряно" : ""}`.replace(/^, |, $/g, "");
    $("note").textContent = `Последно събиране${kind ? ` (${kind})` : ""}: ${found}, прегледани ${plural(sum.visited, "пост", "поста")}.`;
  }
}

$("all").addEventListener("click", async () => {
  $("all").disabled = true;
  const reply = await send({ type: "startCrawl" });
  if (reply.ok) return window.close();
  $("note").textContent = explain(reply.error);
  $("all").disabled = false;
});

// Every change of the automatic collecting is kept at once; the background answers with what it really took.
async function saveAuto() {
  const auto = {
    enabled: $("auto-on").checked,
    min: $("auto-min").value,
    max: $("auto-max").value,
    from: $("auto-from").value,
    to: $("auto-to").value,
    awake: $("auto-awake").checked,
  };
  const reply = await send({ type: "setAuto", auto });
  if (reply.ok) return showAuto(reply.auto, reply.autoNext, null);
  $("auto-on").checked = false;
  $("auto-more").hidden = true;
  $("auto-error").hidden = false;
  $("auto-error").textContent = explain(reply.error);
}
for (const id of ["auto-on", "auto-min", "auto-max", "auto-from", "auto-to", "auto-awake"]) $(id).addEventListener("change", saveAuto);

send({ type: "seen" });
show();
