/*
 * The part of the extension that talks to the site, remembers how far "collect from all posts" got,
 * and starts that run by itself when the admin switched automatic collecting on.
 * Nothing here reads Facebook: the pages do that themselves (scrape.js) and hand over what they read.
 *
 * Kept in chrome.storage.local:
 *   conn   { api, token }   the site and the key it gave us (site.js, from Админ → От Facebook)
 *   crawl  { tabId, windowId, auto, stage: "scan" | "posts" | "done", group, open, closed, queue, index, results,
 *            stopped, replied, replyProblem }   replied / replyProblem: automatic answers left in this run, and
 *            why they stopped; auto / windowId: the run started by itself, in a window of its own
 *   auto   { enabled, min, max, from, to, awake }   automatic collecting: every min–max minutes (a different number
 *            each time), between these hours of the day, keeping the screen on meanwhile
 *   autoError { at, error }   why the last automatic run could not start
 *   unseen  new claims since the popup was last opened (the number on the icon)
 */

const MAX_POSTS = 40;

const AUTO_ALARM = "auto-collect";
const AUTO_WATCHDOG = "auto-watchdog";
const AUTO_DEFAULT = { enabled: false, min: 20, max: 40, from: 8, to: 23, awake: true };
/** An automatic run that is still going after this long is stuck (its window is covered, Facebook hangs): it is closed. */
const AUTO_MAX_RUN_MS = 25 * 60000;
/** The window an automatic run works in. Wide enough for Facebook to lay the group out the way scrape.js knows it. */
const AUTO_WINDOW = { width: 1040, height: 780 };

const store = {
  get: async (key) => (await chrome.storage.local.get(key))[key] ?? null,
  set: (key, value) => chrome.storage.local.set({ [key]: value }),
};

async function api(path, init = {}) {
  const conn = await store.get("conn");
  if (!conn) throw new Error("not-connected");
  let response;
  try {
    response = await fetch(conn.api + path, { ...init, headers: { Authorization: `Bearer ${conn.token}`, "Content-Type": "application/json" } });
  } catch {
    throw new Error("offline");
  }
  if (response.status === 401) throw new Error("unauthorized");
  const data = await response.json().catch(() => null);
  if (!data?.ok) throw new Error(data?.error ?? `http-${response.status}`);
  return data;
}

const ingest = (post) => api("/api/fb/ingest", { method: "POST", body: JSON.stringify(post) });

/** What a page needs to know about the run it is part of. */
async function view(crawl) {
  const conn = await store.get("conn");
  const results = crawl.results ?? [];
  return {
    stage: crawl.stage,
    auto: Boolean(crawl.auto),
    stopped: Boolean(crawl.stopped),
    finishedAt: crawl.finishedAt ?? null,
    index: crawl.index ?? 0,
    total: crawl.queue?.length ?? 0,
    current: crawl.stage === "posts" ? crawl.queue[crawl.index] : null,
    adminUrl: conn ? `${conn.api}/admin/facebook` : null,
    summary: {
      visited: results.length,
      failed: results.filter((r) => r.error).length,
      withNew: results.filter((r) => r.added > 0).length,
      added: results.reduce((sum, r) => sum + (r.added ?? 0), 0),
      replied: crawl.replied ?? 0,
      replyProblem: crawl.replyProblem ?? null,
    },
  };
}

async function finish(crawl, stopped = false) {
  crawl.stage = "done";
  crawl.stopped = stopped;
  crawl.finishedAt = Date.now();
  await store.set("crawl", crawl);
  if (crawl.auto) await chrome.alarms.clear(AUTO_WATCHDOG);
  // The number on the icon adds up over the runs nobody has looked at yet.
  const added = (crawl.results ?? []).reduce((sum, r) => sum + (r.added ?? 0), 0);
  const unseen = ((await store.get("unseen")) ?? 0) + added;
  await store.set("unseen", unseen);
  await chrome.action.setBadgeBackgroundColor({ color: "#1f5c3f" });
  await chrome.action.setBadgeText({ text: unseen > 0 ? String(unseen) : "" });
}

/** The tab of a run that is under way, or null when there is none (its tab may have gone with the browser). */
async function runningTab(crawl) {
  if (!crawl || crawl.stage === "done") return null;
  return chrome.tabs.get(crawl.tabId).catch(() => null);
}

/* ---------- automatic collecting ---------- */

const autoSettings = async () => ({ ...AUTO_DEFAULT, ...(await store.get("auto")) });

/** Whether this moment falls in the hours of the day the admin allowed (from 22 to 6 runs over midnight). */
function inHours(auto, date) {
  const hour = date.getHours();
  if (auto.from === auto.to % 24) return true;
  return auto.from < auto.to ? hour >= auto.from && hour < auto.to : hour >= auto.from || hour < auto.to;
}

/** When the next run starts: a different number of minutes each time, moved into the allowed hours. */
function nextTime(auto, minutes = auto.min + Math.random() * (auto.max - auto.min)) {
  const at = new Date(Date.now() + minutes * 60000);
  if (inHours(auto, at)) return at.getTime();
  const start = new Date(at);
  start.setMinutes(0, 0, 0);
  for (let i = 0; i < 24 && !inHours(auto, start); i++) start.setHours(start.getHours() + 1);
  // Not on the dot either.
  return start.getTime() + (1 + Math.random() * 19) * 60000;
}

/** Sets (or clears) the alarm for the next run. `minutes` overrides the usual interval, e.g. soon after Chrome starts. */
async function schedule(minutes) {
  const auto = await autoSettings();
  if (!auto.enabled) {
    await chrome.alarms.clear(AUTO_ALARM);
    chrome.power.releaseKeepAwake();
    return null;
  }
  const at = nextTime(auto, minutes);
  await chrome.alarms.create(AUTO_ALARM, { when: at });
  // Facebook loads nothing into a window on a screen that is off, so the screen stays on while a run is near.
  // Overnight (the next run is hours away) it may go off as usual.
  if (auto.awake && at - Date.now() <= (auto.max + 5) * 60000) chrome.power.requestKeepAwake("display");
  else chrome.power.releaseKeepAwake();
  return at;
}

/** After the browser or the extension starts: the alarm may be gone, and the screen request always is. */
async function restore(soon) {
  const auto = await autoSettings();
  if (!auto.enabled) return;
  if (soon || !(await chrome.alarms.get(AUTO_ALARM))) await schedule(soon ? 2 + Math.random() * 4 : undefined);
  else if (auto.awake) chrome.power.requestKeepAwake("display");
}

async function closeAutoWindow(crawl) {
  if (crawl?.auto && crawl.windowId != null) await chrome.windows.remove(crawl.windowId).catch(() => {});
}

/** Opens the group in a small window of its own, next to the corner of the window the admin is using, without taking the keyboard. */
async function startAuto() {
  const list = await api("/api/fb/posts");
  const near = await chrome.windows.getLastFocused().catch(() => null);
  const place = { ...AUTO_WINDOW };
  if (near?.width && near?.height && near.state !== "minimized") {
    place.width = Math.min(AUTO_WINDOW.width, near.width);
    place.height = Math.min(AUTO_WINDOW.height, near.height);
    place.left = Math.max(0, (near.left ?? 0) + near.width - place.width);
    place.top = Math.max(0, (near.top ?? 0) + near.height - place.height);
  }
  let win;
  try {
    win = await chrome.windows.create({ url: list.group, type: "popup", focused: false, ...place });
  } catch {
    // The place we worked out is off the screen (another monitor was unplugged): let Chrome choose.
    win = await chrome.windows.create({ url: list.group, type: "popup", focused: false, ...AUTO_WINDOW });
  }
  const startedAt = Date.now();
  await store.set("crawl", { tabId: win.tabs[0].id, windowId: win.id, auto: true, stage: "scan", group: list.group, open: list.open, closed: list.closed, queue: [], index: 0, results: [], startedAt });
  await chrome.alarms.create(AUTO_WATCHDOG, { when: startedAt + AUTO_MAX_RUN_MS });
}

/** The alarm went off: start a run, unless one is under way or the hour is not allowed. The next alarm is set either way. */
async function autoRun() {
  const auto = await autoSettings();
  if (!auto.enabled) return;
  await schedule();
  if (!inHours(auto, new Date())) return;
  const crawl = await store.get("crawl");
  if (await runningTab(crawl)) return;
  if (crawl && crawl.stage !== "done") await finish(crawl, true);
  try {
    await startAuto();
    await store.set("autoError", null);
  } catch (e) {
    await store.set("autoError", { at: Date.now(), error: e?.message ?? String(e) });
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === AUTO_ALARM) return autoRun();
  if (alarm.name !== AUTO_WATCHDOG) return;
  const crawl = await store.get("crawl");
  if (!crawl?.auto || crawl.stage === "done") return;
  await finish(crawl, true);
  await closeAutoWindow(crawl);
  await store.set("autoError", { at: Date.now(), error: "stuck" });
});

chrome.runtime.onStartup.addListener(async () => {
  // A run cut short by closing the browser: its tab is gone, and its number may now belong to another tab.
  const crawl = await store.get("crawl");
  if (crawl && crawl.stage !== "done") await finish(crawl, true);
  await restore(true);
});
chrome.runtime.onInstalled.addListener(() => restore(false));

/* ---------- messages from the pages and the popup ---------- */

const whole = (value, low, high, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(high, Math.max(low, n)) : fallback;
};

const handlers = {
  /** site.js: the admin opened Админ → От Facebook, which carries the key. */
  async connect({ api: origin, token }) {
    if (!/^https?:\/\/[^/]+$/.test(origin ?? "") || !/^[0-9a-f]{64}$/.test(token ?? "")) throw new Error("bad-key");
    await store.set("conn", { api: origin, token });
    return { version: chrome.runtime.getManifest().version };
  },

  async status() {
    const [conn, crawl, auto, alarm, autoError] = await Promise.all([store.get("conn"), store.get("crawl"), autoSettings(), chrome.alarms.get(AUTO_ALARM), store.get("autoError")]);
    return {
      connected: Boolean(conn),
      api: conn?.api ?? null,
      version: chrome.runtime.getManifest().version,
      crawl: crawl ? await view(crawl) : null,
      auto,
      autoNext: auto.enabled ? (alarm?.scheduledTime ?? null) : null,
      autoError,
    };
  },

  /** The popup: automatic collecting switched on or off, or its numbers changed. Every change picks a new moment. */
  async setAuto({ auto }) {
    const min = whole(auto?.min, 10, 235, AUTO_DEFAULT.min);
    const next = {
      enabled: Boolean(auto?.enabled),
      min,
      // At least five minutes apart, so two runs never come at the same interval.
      max: Math.max(min + 5, whole(auto?.max, 15, 240, AUTO_DEFAULT.max)),
      from: whole(auto?.from, 0, 23, AUTO_DEFAULT.from),
      to: whole(auto?.to, 1, 24, AUTO_DEFAULT.to),
      awake: Boolean(auto?.awake),
    };
    if (next.enabled && !(await store.get("conn"))) throw new Error("not-connected");
    await store.set("auto", next);
    await store.set("autoError", null);
    return { auto: next, autoNext: await schedule() };
  },

  /** fb.js on every Facebook page load: is this the tab that walks through the posts? */
  async hello(_message, sender) {
    const crawl = await store.get("crawl");
    const mine = crawl && sender.tab && crawl.tabId === sender.tab.id;
    return { crawl: mine ? await view(crawl) : null };
  },

  async collectOne({ post }) {
    const conn = await store.get("conn");
    const result = await ingest(post);
    return { result, adminUrl: conn.api + result.adminPath };
  },

  async startCrawl() {
    const running = await store.get("crawl");
    const tab = await runningTab(running);
    if (tab) {
      // Already under way (by hand or by itself): bring it forward instead of starting a second one.
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
      return {};
    }
    const list = await api("/api/fb/posts");
    const fresh = await chrome.tabs.create({ url: list.group, active: true });
    await store.set("crawl", { tabId: fresh.id, stage: "scan", group: list.group, open: list.open, closed: list.closed, queue: [], index: 0, results: [], startedAt: Date.now() });
    return {};
  },

  /** The group's page found these posts; add the ones the site is still collecting from, minus the stopped ones. */
  async scanned({ posts }) {
    const crawl = await store.get("crawl");
    if (!crawl || crawl.stage !== "scan") throw new Error("no-run");
    const closed = new Set(crawl.closed);
    const queue = new Map();
    for (const p of [...(posts ?? []), ...crawl.open]) {
      if (p?.fbId && p.url && !closed.has(p.fbId) && !queue.has(p.fbId)) queue.set(p.fbId, { fbId: p.fbId, url: p.url });
    }
    crawl.queue = [...queue.values()].slice(0, MAX_POSTS);
    crawl.index = 0;
    crawl.stage = "posts";
    if (crawl.queue.length === 0) await finish(crawl);
    else await store.set("crawl", crawl);
    return { crawl: await view(crawl) };
  },

  /** One post was read (or could not be): send it to the site and move on. */
  async collected({ fbId, post, error }) {
    const crawl = await store.get("crawl");
    if (!crawl || crawl.stage !== "posts") throw new Error("no-run");
    if (crawl.queue[crawl.index]?.fbId !== fbId) return { crawl: await view(crawl) };
    const result = { fbId };
    let reply = null;
    if (post) {
      try {
        const saved = await ingest(post);
        result.added = saved.added;
        result.pending = saved.pending;
        // The site's limit on answers counts for the whole run, and one answer Facebook refused ends them for the run.
        const left = saved.reply ? saved.reply.max - (crawl.replied ?? 0) : 0;
        if (left > 0 && !crawl.replyProblem) reply = { ...saved.reply, max: left };
      } catch (e) {
        // Without the site there is no point in opening the remaining posts.
        if (["offline", "unauthorized", "not-connected"].includes(e.message)) {
          await finish(crawl, true);
          throw e;
        }
        result.error = e.message;
      }
    } else {
      result.error = error ?? "unknown";
    }
    crawl.results.push(result);
    crawl.index += 1;
    if (crawl.index >= crawl.queue.length) await finish(crawl);
    else await store.set("crawl", crawl);
    return { crawl: await view(crawl), reply };
  },

  /** The page answered some comments (ids also holds ones it found answered already): tell the site, count them. */
  async replied({ fbId, ids, sent, problem }, sender) {
    if (ids?.length > 0) await api("/api/fb/replied", { method: "POST", body: JSON.stringify({ fbId, ids }) });
    const crawl = await store.get("crawl");
    if (!crawl || !sender.tab || crawl.tabId !== sender.tab.id) return { crawl: null };
    crawl.replied = (crawl.replied ?? 0) + (sent ?? 0);
    if (problem) crawl.replyProblem = problem;
    await store.set("crawl", crawl);
    return { crawl: await view(crawl) };
  },

  async stopCrawl() {
    const crawl = await store.get("crawl");
    if (!crawl) return { crawl: null };
    if (crawl.stage !== "done") await finish(crawl, true);
    return { crawl: await view(crawl) };
  },

  /**
   * The page of a run cannot be seen (covered, minimised), so Facebook loads nothing into it and it waits.
   * A run that started by itself brings its window forward, but only while nobody is using the computer:
   * taking the keyboard from someone who is typing would send their keys to Facebook.
   */
  async hidden(_message, sender) {
    const crawl = await store.get("crawl");
    if (!crawl?.auto || crawl.stage === "done" || !sender.tab || crawl.tabId !== sender.tab.id) return {};
    const state = await chrome.idle.queryState(15);
    if (state === "idle") await chrome.windows.update(crawl.windowId, { focused: true, state: "normal" }).catch(() => {});
    return { state };
  },

  /** The page of an automatic run showed its result: the window is no longer needed. */
  async autoClose(_message, sender) {
    const crawl = await store.get("crawl");
    if (!crawl?.auto || !sender.tab || crawl.tabId !== sender.tab.id) return {};
    if (crawl.stage !== "done") await finish(crawl, true);
    await closeAutoWindow(crawl);
    return {};
  },

  /** The popup was opened: the number on the icon has been seen. */
  async seen() {
    await store.set("unseen", 0);
    await chrome.action.setBadgeText({ text: "" });
    return {};
  },
};

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  const handler = handlers[message?.type];
  if (!handler) return false;
  handler(message, sender).then(
    (result) => reply({ ok: true, ...result }),
    (e) => reply({ ok: false, error: e?.message ?? String(e) }),
  );
  return true;
});

// Closing the tab in the middle ends the run.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const crawl = await store.get("crawl");
  if (crawl && crawl.tabId === tabId && crawl.stage !== "done") await finish(crawl, true);
});
