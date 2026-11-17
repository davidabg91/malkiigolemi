/*
 * Reads a Facebook group post and its comments from the page the admin has open.
 * Only looks at the page and clicks what a person would click to see every comment; it sends nothing anywhere.
 * fb.js passes what this returns to the site.
 *
 * How Facebook builds a post (checked on the group in November 2026, Bulgarian and English interface):
 *   - an opened post sits in a [role="dialog"] over the group's feed (or in [role="main"] on some layouts)
 *   - every comment is a [role="article"] labelled "Коментар от <име> …" ("Comment by …"); replies say "Отговор от"
 *   - its date is a link whose address carries comment_id (and reply_comment_id for a reply)
 *   - the comment's words are in div[dir="auto"]; the writer's name is the first link with text
 *   - a menu button ("Най-уместните") switches to "Всички коментари", which lists them oldest first
 *   - a comment's replies sit next to it (not inside it), folded behind a "Вижте 1 отговор" button
 *   - "Отговор" under a comment opens a [role="textbox"] in a form next to it, already holding the person's name;
 *     the form's send button is labelled "Публикуване на коментара"
 */
(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const text = (el) => (el?.innerText ?? "").replace(/\u00a0/g, " ").trim();

  const POST_URL = /\/groups\/([^/?#]+)\/(?:posts|permalink)\/(\d+)/;
  const COMMENT = /^(коментар от|comment by)\s+/i;
  const REPLY = /^(отговор от|reply by)\s+/i;
  const SORT = /^(най-уместните|най-подходящите|най-подходящи|топ коментари|най-новите|всички коментари|most relevant|top comments|newest|all comments)$/i;
  const SORT_ALL = /^(всички коментари|all comments)/i;
  // "Преглед на още коментари", "Вижте още 12 коментара", "Преглед на предишни коментари", "View more comments"
  const MORE = /(още|предишни|повече|more|previous).{0,25}(коментар|comment)/i;
  const SEE_MORE = /^(вижте повече|виж повече|see more)$/i;
  // Under a comment: "Отговор" opens the box for a reply; "Вижте 1 отговор" / "Вижте всички 3 отговора" means it has some.
  const REPLY_BUTTON = /^(отговор|reply)$/i;
  const HAS_REPLIES = /^(вижте|виж|показване на|view|see)\s.{0,24}(отговор|repl)/i;
  // The send button of the reply box: "Публикуване на коментара" ("Comment" / "Post comment").
  const SEND = /(публикуване|^comment$|post)/i;
  const MESSAGE = '[data-ad-rendering-role="story_message"], [data-ad-preview="message"], [data-ad-comet-preview="message"]';

  async function waitFor(fn, ms, step = 300) {
    const until = Date.now() + ms;
    for (;;) {
      const value = fn();
      if (value) return value;
      if (Date.now() > until) return null;
      await sleep(step);
    }
  }

  /** The number of the post the address bar points to, with its group. */
  function postInAddress() {
    const m = location.pathname.match(POST_URL);
    if (m) return { group: m[1], fbId: m[2] };
    const multi = new URLSearchParams(location.search).get("multi_permalinks");
    const group = location.pathname.match(/\/groups\/([^/?#]+)/);
    return multi && /^\d+$/.test(multi) && group ? { group: group[1], fbId: multi } : null;
  }

  const isComment = (article) => {
    const label = article.getAttribute("aria-label") ?? "";
    return COMMENT.test(label) || REPLY.test(label);
  };

  /**
   * The opened post: the innermost dialog that holds one. On a layout without the dialog, the post on the page
   * whose links carry the number in the address bar (the page also lists other posts of the group).
   */
  function postRoot() {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter((d) => d.querySelector('[role="article"]'));
    if (dialogs.length > 0) return dialogs[dialogs.length - 1];
    const here = postInAddress();
    const main = here && document.querySelector('[role="main"]');
    if (!main) return null;
    return [...main.querySelectorAll('[role="article"]')].find((a) => !isComment(a) && !a.parentElement.closest('[role="article"]') && a.querySelector(`a[href*="/${here.fbId}"]`)) ?? null;
  }

  const commentArticles = (root) => [...root.querySelectorAll('[role="article"][aria-label]')].filter(isComment);

  const buttons = (root) => [...root.querySelectorAll('[role="button"]')];

  /** Switches the comments to "Всички коментари": nothing filtered out, oldest first. */
  async function showAll(root) {
    const menu = buttons(root).find((b) => b.getAttribute("aria-haspopup") === "menu" && SORT.test(text(b)));
    if (!menu) return false;
    if (SORT_ALL.test(text(menu))) return true;
    menu.click();
    const item = await waitFor(() => [...document.querySelectorAll('[role="menuitem"], [role="menuitemradio"]')].find((m) => SORT_ALL.test(text(m))), 3000);
    if (!item) {
      // The menu did not open the way we know it: close it and read the comments as they are.
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));
      return false;
    }
    item.click();
    await waitFor(() => {
      const again = buttons(root).find((b) => b.getAttribute("aria-haspopup") === "menu" && SORT.test(text(b)));
      return again && SORT_ALL.test(text(again));
    }, 5000);
    await sleep(1500);
    return true;
  }

  /** Presses "още коментари" and scrolls to the end until no new comment shows up. Replies are left folded. */
  async function loadAll(root, onProgress) {
    const scrollers = [...root.querySelectorAll("div")].filter((d) => d.scrollHeight > d.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(d).overflowY));
    let quiet = 0;
    for (let round = 0; round < 150 && quiet < 2; round++) {
      const before = commentArticles(root).length;
      let clicked = 0;
      for (const b of buttons(root)) {
        const label = text(b);
        if (label.length < 60 && MORE.test(label) && b.getAttribute("aria-haspopup") !== "menu") {
          b.click();
          clicked++;
        }
      }
      for (const s of scrollers) s.scrollTop = s.scrollHeight;
      if (scrollers.length === 0) window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(1500);
      const after = commentArticles(root).length;
      onProgress?.({ count: after });
      quiet = after === before && clicked === 0 ? quiet + 1 : 0;
    }
  }

  /** The address a link in a post really leads to (Facebook wraps outside links in l.php?u=…). */
  function unwrap(href) {
    try {
      const url = new URL(href, location.href);
      const target = /(^|\.)facebook\.com$/.test(url.hostname) && url.pathname === "/l.php" ? url.searchParams.get("u") : null;
      const out = new URL(target ?? url.href);
      out.searchParams.delete("fbclid");
      return out.href;
    } catch {
      return null;
    }
  }

  /** Parts of an element that belong to this comment and not to a comment nested in it. */
  const own = (article, selector) => [...article.querySelectorAll(selector)].filter((el) => el.closest('[role="article"]') === article);

  /** The part of the page that belongs to one comment: the comment, its replies and the box for a new reply. */
  function blockOf(article, root) {
    const topLevel = (el) => [...el.querySelectorAll('[role="article"][aria-label]')].filter((a) => COMMENT.test(a.getAttribute("aria-label") ?? "")).length;
    let block = article;
    while (block.parentElement && block.parentElement !== root && topLevel(block.parentElement) === 1) block = block.parentElement;
    return block;
  }

  /** True when somebody already replied under the comment (shown, or folded behind "Вижте 1 отговор"). */
  const hasReplies = (block) => [...block.querySelectorAll('[role="article"][aria-label]')].some((a) => REPLY.test(a.getAttribute("aria-label") ?? "")) || buttons(block).some((b) => HAS_REPLIES.test(text(b)));

  function readComment(article, root) {
    const label = article.getAttribute("aria-label") ?? "";
    const stamp = own(article, 'a[href*="comment_id="]')[0];
    let id = null;
    let postId = null;
    let reply = REPLY.test(label);
    if (stamp) {
      const url = new URL(stamp.href, location.href);
      const params = url.searchParams;
      postId = url.pathname.match(POST_URL)?.[2] ?? null;
      id = params.get("reply_comment_id") ?? params.get("comment_id");
      if (params.get("reply_comment_id")) reply = true;
    }
    const words = own(article, 'div[dir="auto"]').filter((d) => !d.closest("a") && !d.parentElement.closest('div[dir="auto"]'));
    const body = words.map(text).filter(Boolean).join(" ");
    const writer = own(article, "a").find((a) => a !== stamp && text(a) && !/comment_id=/.test(a.href) && !words.some((w) => w.contains(a)));
    const name = (writer ? text(writer).split("\n")[0] : label.replace(COMMENT, "").replace(REPLY, "").replace(/\s+(преди|на коментара|to\s).*$/i, "")).trim();
    return { id: id && /^\d+$/.test(id) ? id : null, postId, name, text: body, reply, time: stamp ? text(stamp).slice(0, 40) : "", answered: !reply && hasReplies(blockOf(article, root)) };
  }

  async function readPost(root) {
    const articles = commentArticles(root);
    const read = articles.map((a) => readComment(a, root)).filter((c) => c.name && c.text);

    // Which post this is: the address bar says it, or the comments' own links do.
    let post = postInAddress();
    if (!post) {
      for (const a of articles) {
        const link = own(a, 'a[href*="comment_id="]')[0];
        const m = link && new URL(link.href, location.href).pathname.match(POST_URL);
        if (m) {
          post = { group: m[1], fbId: m[2] };
          break;
        }
      }
    }
    if (!post) return null;
    // Only this post's comments. When the post did not open (deleted, or Facebook showed the group instead),
    // the page still holds comments of other posts; their links name the post they belong to.
    const inDialog = root.getAttribute("role") === "dialog";
    const comments = read.filter((c) => (c.postId ? c.postId === post.fbId : inDialog)).map((c) => ({ id: c.id, name: c.name, text: c.text, reply: c.reply, time: c.time, answered: c.answered }));

    const message = [...root.querySelectorAll(MESSAGE)].find((m) => !m.closest('[role="article"][aria-label]')) ?? null;
    if (message) {
      const more = buttons(message).find((b) => SEE_MORE.test(text(b)));
      if (more) {
        more.click();
        await sleep(500);
      }
    }
    const links = message ? [...new Set([...message.querySelectorAll("a[href]")].map((a) => unwrap(a.href)).filter((href) => href && !/(^|\.)facebook\.com$/.test(new URL(href).hostname)))] : [];

    // The writer of the post: the first named person link that is not inside a comment.
    const first = [...root.querySelectorAll('a[href*="/user/"]')].find((a) => text(a) && !commentArticles(root).some((c) => c.contains(a)));
    const heading = text(root).split("\n")[0].match(/^Публикацията на (.+)$|^(.+?)['’]s post$/i);
    const author = first ? text(first).split("\n")[0] : (heading?.[1] ?? heading?.[2] ?? "");

    return {
      fbId: post.fbId,
      url: `https://www.facebook.com/groups/${post.group}/posts/${post.fbId}/`,
      text: text(message).replace(/\s*(Вижте по-малко|See less)\s*$/i, "").slice(0, 5000),
      author: author.slice(0, 120),
      links: links.slice(0, 30),
      comments: comments.slice(0, 3000),
    };
  }

  /**
   * Reads the post that is open on the page. Throws "no-post" when there is none.
   * onProgress gets { count } while the comments load.
   */
  async function collect(onProgress) {
    const root = await waitFor(postRoot, 15000);
    if (!root) throw new Error("no-post");
    // The post's own text (or its first comment) shows that it finished loading.
    await waitFor(() => root.querySelector(MESSAGE) || commentArticles(root).length > 0, 10000);
    await showAll(root);
    await loadAll(root, onProgress);
    const post = await readPost(root);
    // Neither the post's own text nor a comment of its own: the post did not open.
    if (!post || (!post.text && post.comments.length === 0)) throw new Error("no-post");
    return post;
  }

  /**
   * Writes a reply under one comment of the open post, the way a person does: "Отговор", the text, send.
   * Returns "sent"; "answered" when the comment already has a reply (nothing is written); "missing" when the comment
   * is no longer on the page; or what went wrong: "no-button" (this profile cannot reply here), "no-box", "no-type",
   * "no-send", "not-sent".
   */
  async function reply(commentId, replyText) {
    const root = postRoot();
    if (!root) return "missing";
    const article = commentArticles(root).find((a) => {
      const c = readComment(a, root);
      return c.id === commentId && !c.reply;
    });
    if (!article) return "missing";
    const block = blockOf(article, root);
    if (hasReplies(block)) return "answered";
    const open = own(article, '[role="button"]').find((b) => REPLY_BUTTON.test(text(b)));
    if (!open) return "no-button";

    article.scrollIntoView({ block: "center" });
    const boxes = () => [...block.querySelectorAll('[role="textbox"][contenteditable="true"]')];
    const before = new Set(boxes());
    open.click();
    const box = await waitFor(() => boxes().find((b) => !before.has(b)), 5000);
    if (!box) return "no-box";

    // Facebook starts the reply with the person's name; the text goes after it.
    box.focus();
    const selection = getSelection();
    selection.selectAllChildren(box);
    selection.collapseToEnd();
    await sleep(300);
    const typed = document.execCommand("insertText", false, replyText);
    await sleep(500);
    if (!typed || !text(box).includes(replyText)) return "no-type";

    const send = buttons(box.closest("form") ?? block).find((b) => SEND.test(b.getAttribute("aria-label") ?? ""));
    if (!send) return "no-send";
    send.click();
    // Sent when the reply shows up under the comment, or the box is gone or empty again.
    const sent = await waitFor(() => hasReplies(block) || !box.isConnected || !text(box).includes(replyText), 12000);
    return sent ? "sent" : "not-sent";
  }

  /** Scrolls the group's feed a few screens and returns the posts it met, newest activity first. */
  async function scanFeed(onProgress, limit = 30) {
    const feed = await waitFor(() => document.querySelector('[role="feed"]'), 15000);
    if (!feed) return [];
    const found = new Map();
    for (let i = 0; i < 12 && found.size < limit; i++) {
      for (const a of feed.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"]')) {
        const m = new URL(a.href, location.href).pathname.match(POST_URL);
        if (m && !found.has(m[2])) found.set(m[2], { fbId: m[2], url: `https://www.facebook.com/groups/${m[1]}/posts/${m[2]}/` });
      }
      onProgress?.({ count: found.size });
      window.scrollBy(0, window.innerHeight * 2.5);
      await sleep(1300);
    }
    window.scrollTo(0, 0);
    return [...found.values()].slice(0, limit);
  }

  globalThis.mgScrape = { collect, reply, scanFeed, postRoot, postInAddress };
})();
