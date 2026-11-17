/*
 * The part of the extension that talks to the site and remembers how far "collect from all posts" got.
 * Nothing here reads Facebook: the pages do that themselves (scrape.js) and hand over what they read.
 *
 * Kept in chrome.storage.local:
 *   conn  { api, token }   the site and the key it gave us (site.js, from Админ → От Facebook)
 *   crawl { tabId, stage: "scan" | "posts" | "done", group, open, closed, queue, index, results, stopped,
 *           replied, replyProblem }   the last two: automatic answers left in this run, and why they stopped
 */

const MAX_POSTS = 40;

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
    stopped: Boolean(crawl.stopped),
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
  const added = (crawl.results ?? []).reduce((sum, r) => sum + (r.added ?? 0), 0);
  await chrome.action.setBadgeBackgroundColor({ color: "#1f5c3f" });
  await chrome.action.setBadgeText({ text: added > 0 ? String(added) : "" });
}

const handlers = {
  /** site.js: the admin opened Админ → От Facebook, which carries the key. */
  async connect({ api: origin, token }) {
    if (!/^https?:\/\/[^/]+$/.test(origin ?? "") || !/^[0-9a-f]{64}$/.test(token ?? "")) throw new Error("bad-key");
    await store.set("conn", { api: origin, token });
    return { version: chrome.runtime.getManifest().version };
  },

  async status() {
    const [conn, crawl] = await Promise.all([store.get("conn"), store.get("crawl")]);
    return { connected: Boolean(conn), api: conn?.api ?? null, version: chrome.runtime.getManifest().version, crawl: crawl ? await view(crawl) : null };
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
    if (running && running.stage !== "done") {
      // Already under way: bring its tab forward instead of starting a second one.
      const tab = await chrome.tabs.get(running.tabId).catch(() => null);
      if (tab) {
        await chrome.tabs.update(tab.id, { active: true });
        return {};
      }
    }
    const list = await api("/api/fb/posts");
    const tab = await chrome.tabs.create({ url: list.group, active: true });
    await store.set("crawl", { tabId: tab.id, stage: "scan", group: list.group, open: list.open, closed: list.closed, queue: [], index: 0, results: [], startedAt: Date.now() });
    await chrome.action.setBadgeText({ text: "" });
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

  /** The popup was opened: the number on the icon has been seen. */
  async seen() {
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
