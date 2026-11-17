import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, asc, eq, inArray, isNull, like } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { fbClaims, fbPosts, products } from "@/db/schema";
import { fbContactKey } from "./fb-contacts";
import { autoOrderClaims } from "./fb-orders";
import { quantityOf } from "./fb-parse";
import { commentAgeHours, FB_REPLY_LIMITS, getFbReplySettings } from "./fb-reply";

/**
 * Comments read by the browser extension (see /extension) arrive here and become fbPosts and fbClaims,
 * the same rows the paste form under Админ → Facebook makes.
 */

/** "Collect from all posts" keeps coming back to a post for this many days after it was first read. */
export const FB_COLLECT_DAYS = 14;

/**
 * The key the extension signs its calls with. It is derived from SESSION_SECRET, so there is nothing to store;
 * the admin's Facebook page hands it to the extension (see FbExtensionCard).
 */
export function fbExtensionToken() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET is missing or too short.");
  return createHmac("sha256", secret).update("fb-extension-v1").digest("hex");
}

/** True when the request carries the extension's key as a bearer token. */
export function isFbExtensionRequest(request: Request) {
  const sent = request.headers.get("authorization")?.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
  if (!sent) return false;
  try {
    return timingSafeEqual(Buffer.from(sent), Buffer.from(fbExtensionToken()));
  } catch {
    return false;
  }
}

export const fbIngestSchema = z.object({
  /** Facebook's number of the post. */
  fbId: z.string().regex(/^\d{5,32}$/),
  url: z.string().max(300).regex(/^https:\/\/(www\.|web\.)?facebook\.com\/groups\//),
  text: z.string().max(6000).default(""),
  /** Who wrote the post; their own comments are answers, not orders. */
  author: z.string().max(120).default(""),
  /** Links found in the post, already unwrapped from Facebook's redirect. */
  links: z.array(z.string().max(600)).max(30).default([]),
  comments: z
    .array(
      z.object({
        id: z.string().regex(/^\d{5,40}$/).nullable(),
        name: z.string().max(200),
        /** Facebook's number of the writer's profile, from the link on their name. */
        userId: z.string().regex(/^\d{3,32}$/).nullable().default(null),
        text: z.string().max(4000),
        /** A reply under another comment. */
        reply: z.boolean().default(false),
        /** The short date Facebook shows next to the comment ("7 м", "1 д"). */
        time: z.string().max(40).default(""),
        /** Somebody already replied under it. */
        answered: z.boolean().default(false),
      }),
    )
    .max(3000),
});
export type FbIngest = z.infer<typeof fbIngestSchema>;

export type FbIngestResult = {
  /** False when the post has neither a product from the shop nor a comment that looks like an order. */
  saved: boolean;
  postId: number | null;
  product: string | null;
  /** New order-like comments added by this reading. */
  added: number;
  /** Claims of the post still waiting to be turned into orders. */
  pending: number;
  /** Claims this reading put into their person's order by itself (stock was taken for them). */
  ordered: number;
  stockChanged: boolean;
  /** Comments the extension should now answer on Facebook; null when there are none or answering is off. */
  reply: FbReplyPlan | null;
};

export type FbReplyPlan = { text: string; pauseMs: number; max: number; ids: string[] };

/** For long lists in "in (...)". */
const chunks = <T,>(list: T[], size = 400) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

/**
 * Which of the post's comments get the automatic answer: claims still waiting, read with certainty, recent,
 * not answered yet, and only while the product's stock covers them in the order they were written.
 */
async function replyPlan(postId: number, input: FbIngest): Promise<FbReplyPlan | null> {
  const settings = await getFbReplySettings();
  const text = settings.text.trim();
  if (!settings.enabled || !text) return null;
  const [post] = await db.select().from(fbPosts).where(eq(fbPosts.id, postId)).limit(1);
  if (!post || post.closedAt) return null;

  // How many pieces can still be promised. A hand-typed product has no stock to run out of.
  let left = Infinity;
  if (post.productId) {
    const [product] = await db.select({ stock: products.stock, colorOptions: products.colorOptions }).from(products).where(eq(products.id, post.productId)).limit(1);
    // With colours the comment has to say which one, and that is for a person to check.
    if (!product || product.colorOptions.length > 0) return null;
    left = product.stock;
  } else if (post.price == null) {
    return null;
  }

  const seen = new Map(input.comments.filter((c) => c.id).map((c) => [c.id as string, c]));
  const claims = await db
    .select()
    .from(fbClaims)
    .where(and(eq(fbClaims.postId, postId), inArray(fbClaims.status, ["pending", "ordered"])))
    .orderBy(asc(fbClaims.id));
  const ids: string[] = [];
  for (const claim of claims) {
    // A claim already in an order has its stock; one still waiting has to fit in what is left.
    if (claim.status === "pending") {
      if (claim.qty > left) continue;
      // Counted even when it gets no automatic answer: the admin may still turn it into an order.
      left -= claim.qty;
    }
    if (claim.repliedAt || !claim.fbCommentId) continue;
    const comment = seen.get(claim.fbCommentId);
    if (!comment || comment.answered || comment.reply) continue;
    const read = quantityOf(claim.comment);
    if (!read.sure || read.qty !== claim.qty) continue;
    const age = commentAgeHours(comment.time);
    if (age === null || age >= FB_REPLY_LIMITS.maxAgeHours) continue;
    ids.push(claim.fbCommentId);
  }
  return ids.length > 0 ? { text, pauseMs: FB_REPLY_LIMITS.pauseMs, max: FB_REPLY_LIMITS.perRun, ids } : null;
}

/** Records that these comments of a post now have their answer on Facebook. */
export async function markFbReplied(fbId: string, commentIds: string[]) {
  const [post] = await db.select({ id: fbPosts.id }).from(fbPosts).where(eq(fbPosts.fbId, fbId)).limit(1);
  if (!post) return;
  for (const part of chunks(commentIds)) {
    await db
      .update(fbClaims)
      .set({ repliedAt: new Date() })
      .where(and(eq(fbClaims.postId, post.id), isNull(fbClaims.repliedAt), inArray(fbClaims.fbCommentId, part)));
  }
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** First line of the post with the emoji around it dropped: what the post is called until a product is picked. */
function titleOf(text: string) {
  const line = text.split("\n").map(squash).find((l) => /[\p{L}\p{N}]/u.test(l)) ?? "";
  const title = line.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}!?.)%€]+$/gu, "").slice(0, 120);
  return title || "Пост от Facebook";
}

/** Letters and digits only, lower-cased: "ГЕЛ ХИМИКАЛКИ K-POP 12бр" and "Гел химикалки K-Pop 12 бр" are the same. */
const bare = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * The shop product a post is about: the one its links or text point to with /produkt/<slug>,
 * else the only product whose name is the post's first line.
 */
async function productOf(input: FbIngest) {
  const columns = { id: products.id, name: products.name, unit: products.unit };
  const slugs = new Set<string>();
  for (const source of [...input.links, input.text]) {
    for (const m of source.matchAll(/\/produkt\/([a-z0-9][a-z0-9-]{1,200})/gi)) slugs.add(m[1].toLowerCase());
  }
  for (const slug of slugs) {
    const [product] = await db.select(columns).from(products).where(eq(products.slug, slug)).limit(1);
    if (product) return product;
  }

  const title = bare(titleOf(input.text));
  if (title.length < 8) return null;
  const all = await db.select(columns).from(products);
  const same = all.filter((p) => {
    const name = bare(p.name);
    return name.length >= 8 && (title === name || title === bare(`${p.name} ${p.unit}`));
  });
  // Two products with the same name: better to ask than to guess.
  return same.length === 1 ? same[0] : null;
}

export async function ingestFbPost(input: FbIngest): Promise<FbIngestResult> {
  let [post] = await db.select().from(fbPosts).where(eq(fbPosts.fbId, input.fbId)).limit(1);
  // A post added earlier by pasting its comments, with its link filled in: the same post.
  if (!post) {
    [post] = await db
      .select()
      .from(fbPosts)
      .where(and(isNull(fbPosts.fbId), like(fbPosts.url, `%/${input.fbId}%`)))
      .limit(1);
  }

  const existing = post ? await db.select({ name: fbClaims.name, comment: fbClaims.comment, fbCommentId: fbClaims.fbCommentId }).from(fbClaims).where(eq(fbClaims.postId, post.id)) : [];
  const seenIds = new Set(existing.map((c) => c.fbCommentId).filter(Boolean));
  const key = (name: string, comment: string) => `${fbContactKey(name)}\u0000${squash(comment).toLowerCase()}`;
  // Comments saved without Facebook's number (pasted by hand) are recognised by who wrote what.
  const seenKeys = new Set(existing.filter((c) => !c.fbCommentId).map((c) => key(c.name, c.comment)));

  const author = fbContactKey(input.author);
  const fresh: { name: string; comment: string; qty: number; status: "pending" | "rejected"; fbCommentId: string | null; fbUserId: string | null }[] = [];
  /** Comments saved before the extension read who wrote them: their profile is filled in now. */
  const profiles: { commentId: string; userId: string }[] = [];
  for (const c of input.comments) {
    const name = squash(c.name).slice(0, 120);
    const comment = squash(c.text).slice(0, 1000);
    if (!name || !comment) continue;
    if (c.id && c.userId && seenIds.has(c.id)) profiles.push({ commentId: c.id, userId: c.userId });
    if (c.id ? seenIds.has(c.id) : false) continue;
    const k = key(name, comment);
    if (seenKeys.has(k)) continue;
    if (c.id) seenIds.add(c.id);
    else seenKeys.add(k);
    const { qty } = quantityOf(comment);
    // Replies and the post author's own comments are answers ("записана си 2 бр"), kept aside as skipped.
    const order = qty > 0 && !c.reply && fbContactKey(name) !== author;
    fresh.push({ name, comment, qty: Math.max(1, qty), status: order ? "pending" : "rejected", fbCommentId: c.id, fbUserId: c.userId });
  }
  const added = fresh.filter((c) => c.status === "pending").length;

  const product = post?.productId ? null : await productOf(input);
  if (!post) {
    // Announcements and posts nobody ordered from yet are not worth a row.
    if (!product && added === 0) return { saved: false, postId: null, product: null, added: 0, pending: 0, ordered: 0, stockChanged: false, reply: null };
    const values = {
      fbId: input.fbId,
      url: input.url,
      text: input.text.slice(0, 2000) || null,
      productId: product?.id ?? null,
      productName: product ? `${product.name} ${product.unit}`.trim() : titleOf(input.text),
      syncedAt: new Date(),
    };
    [post] = await db.insert(fbPosts).values(values).onConflictDoNothing({ target: fbPosts.fbId }).returning();
    // Two readings of the same new post at once: the other one made the row.
    if (!post) [post] = await db.select().from(fbPosts).where(eq(fbPosts.fbId, input.fbId)).limit(1);
    if (!post) throw new Error("fb post was not saved");
  } else {
    await db
      .update(fbPosts)
      .set({
        fbId: input.fbId,
        syncedAt: new Date(),
        text: post.text ?? (input.text.slice(0, 2000) || null),
        // A post still without a product (and without a hand-typed price) takes the one its link points to.
        ...(product && !post.productId && post.price == null ? { productId: product.id, productName: `${product.name} ${product.unit}`.trim() } : {}),
      })
      .where(eq(fbPosts.id, post.id));
  }

  if (fresh.length > 0) {
    const postId = post.id;
    await db
      .insert(fbClaims)
      .values(fresh.map((c) => ({ postId, ...c })))
      .onConflictDoNothing();
  }
  for (const p of profiles) {
    await db
      .update(fbClaims)
      .set({ fbUserId: p.userId })
      .where(and(eq(fbClaims.postId, post.id), eq(fbClaims.fbCommentId, p.commentId), isNull(fbClaims.fbUserId)));
  }
  // Comments somebody already replied under (by hand, or on an earlier run) are never answered again.
  await markFbReplied(input.fbId, input.comments.filter((c) => c.id && c.answered).map((c) => c.id as string));

  // What needs no person to look at it goes straight into each commenter's own order.
  const auto = await autoOrderClaims(post.id);

  const waiting = await db.select({ id: fbClaims.id }).from(fbClaims).where(and(eq(fbClaims.postId, post.id), eq(fbClaims.status, "pending")));
  const [saved] = await db.select({ productId: fbPosts.productId, productName: fbPosts.productName }).from(fbPosts).where(eq(fbPosts.id, post.id)).limit(1);
  const reply = await replyPlan(post.id, input);
  return { saved: true, postId: post.id, product: saved?.productId ? saved.productName : null, added, pending: waiting.length, ordered: auto.ordered, stockChanged: auto.stockChanged, reply };
}
