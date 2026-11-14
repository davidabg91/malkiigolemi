import { relations, sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    parentId: integer("parent_id"),
    /** Tile colour key from the design palette (butter, mint, sky, ...). */
    tone: text("tone").notNull().default("butter"),
    /** lucide icon name used in menus. */
    icon: text("icon").notNull().default("ShoppingBasket"),
    sort: integer("sort").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    /**
     * The picture on the category's home-page tile: a key of TILE_PRESETS, "auto" (its own newest products),
     * or the address of a picture the admin uploaded. Null counts as "auto".
     */
    tile: text("tile"),
  },
  (t) => [index("categories_parent_idx").on(t.parentId)],
);

/**
 * Addresses a category used to have. Renaming a category changes its slug; the old one is kept here so
 * links shared earlier still lead to it.
 */
export const categoryRedirects = sqliteTable("category_redirects", {
  slug: text("slug").primaryKey(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
});

export const brands = sqliteTable("brands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  country: text("country"),
});

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** Lower-cased name + brand + sku. SQLite LIKE is not case-insensitive for Cyrillic. */
    searchText: text("search_text").notNull().default(""),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    brandId: integer("brand_id").references(() => brands.id),
    /** All money is stored in euro cents. */
    price: integer("price").notNull(),
    oldPrice: integer("old_price"),
    bulkMinQty: integer("bulk_min_qty"),
    bulkPrice: integer("bulk_price"),
    unit: text("unit").notNull().default(""),
    /** Uploaded photo; when empty the illustrated pack is rendered instead. */
    image: text("image"),
    pack: text("pack").notNull().default("box"),
    color: text("color").notNull().default("#1F5C3F"),
    origin: text("origin"),
    stock: integer("stock").notNull().default(100),
    isNew: integer("is_new", { mode: "boolean" }).notNull().default(false),
    isFeatured: integer("is_featured", { mode: "boolean" }).notNull().default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    /**
     * Place in the shop's own order, set when the admin arranges products by hand; smaller comes first.
     * Null means "by date": the product then counts as minus its creation time, so the newest come first
     * and ahead of anything arranged earlier.
     */
    rank: integer("rank"),
    createdAt: createdAt(),
  },
  (t) => [
    index("products_category_idx").on(t.categoryId),
    index("products_brand_idx").on(t.brandId),
  ],
);

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  /** Saved delivery preference (a DELIVERY_METHODS id) used to prefill checkout. */
  preferredDelivery: text("preferred_delivery"),
  preferredCourier: text("preferred_courier"),
  preferredOfficeCode: text("preferred_office_code"),
  preferredOfficeName: text("preferred_office_name"),
  city: text("city"),
  address: text("address"),
  role: text("role", { enum: ["customer", "admin"] }).notNull().default("customer"),
  createdAt: createdAt(),
});

/**
 * A phone or browser that agreed to receive notifications (Web Push). One row per device: `endpoint` is the
 * address the push service gave it, `p256dh` and `auth` encrypt what is sent there.
 */
export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    /** The account signed in on the device, when there is one: it then hears about all of that account's orders. */
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    /** A random value kept in the device's `push_device` cookie, so an order placed without an account finds its device. */
    token: text("token").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId), index("push_subscriptions_token_idx").on(t.token)],
);

/**
 * A conversation between a visitor and the shop in the live chat. A signed-in customer's thread belongs to
 * the account; a guest's is found again through the `chat_id` cookie that holds `token`.
 */
export const chatThreads = sqliteTable(
  "chat_threads",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    token: text("token").notNull().unique(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    /** What a guest called themselves; an account's name is read from the account. */
    name: text("name"),
    /** The device the customer writes from, told when the shop answers (if it has notifications on). */
    pushSubscriptionId: integer("push_subscription_id").references(() => pushSubscriptions.id, { onDelete: "set null" }),
    /** Messages the shop has not opened yet; shown as the admin's badge. */
    adminUnread: integer("admin_unread").notNull().default(0),
    /** Answers the customer has not seen yet; shown as a dot on the chat button. */
    customerUnread: integer("customer_unread").notNull().default(0),
    lastBody: text("last_body"),
    lastFrom: text("last_from", { enum: ["customer", "admin"] }),
    lastMessageAt: integer("last_message_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [index("chat_threads_user_idx").on(t.userId), index("chat_threads_last_idx").on(t.lastMessageAt)],
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    threadId: integer("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    sender: text("sender", { enum: ["customer", "admin"] }).notNull(),
    body: text("body").notNull(),
    /** A product the shop suggests with this message; the chat shows it as a card. */
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("chat_messages_thread_idx").on(t.threadId)],
);

export const ORDER_STATUSES = ["new", "confirmed", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    number: text("number").notNull().unique(),
    userId: integer("user_id").references(() => users.id),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    delivery: text("delivery").notNull(),
    courier: text("courier"),
    officeCode: text("office_code"),
    officeName: text("office_name"),
    city: text("city").notNull(),
    address: text("address").notNull(),
    note: text("note"),
    payment: text("payment").notNull().default("cod"),
    subtotal: integer("subtotal").notNull(),
    shipping: integer("shipping").notNull(),
    total: integer("total").notNull(),
    /** Cents taken off with loyalty points; total = subtotal + shipping - discount. */
    discount: integer("discount").notNull().default(0),
    pointsUsed: integer("points_used").notNull().default(0),
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("new"),
    trackingNumber: text("tracking_number"),
    waybillUrl: text("waybill_url"),
    /** The courier's own short status for the shipment, e.g. "Пристигнала в офис". */
    shipmentStatus: text("shipment_status"),
    /** The shipment's tracking history as JSON (see TrackingEvent in lib/econt.ts). */
    trackingEvents: text("tracking_events"),
    /** When the courier was last asked about this shipment. */
    trackedAt: integer("tracked_at", { mode: "timestamp" }),
    /** What the courier charges the shop for the shipment, in cents (shown to the admin only). */
    shippingCost: integer("shipping_cost"),
    /** "site" for checkout orders, "facebook" for orders made in the admin from a Facebook comment. */
    source: text("source").notNull().default("site"),
    /** The device the order was placed from (or that asked to follow it), told when the status changes. */
    pushSubscriptionId: integer("push_subscription_id").references(() => pushSubscriptions.id, { onDelete: "set null" }),
    /** Card orders: the Stripe Checkout session last opened for paying it. */
    stripeSessionId: text("stripe_session_id"),
    /** Card orders: the Stripe payment, for refunds and the link to the Stripe dashboard. */
    stripePaymentIntent: text("stripe_payment_intent"),
    /** When the card payment came through; null while unpaid (and for cash on delivery). */
    paidAt: integer("paid_at", { mode: "timestamp" }),
    /** When a card payment was refunded in full, e.g. after the order was cancelled. */
    refundedAt: integer("refunded_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [index("orders_user_idx").on(t.userId)],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id"),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    price: integer("price").notNull(),
    qty: integer("qty").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "tree",
  }),
  children: many(categories, { relationName: "tree" }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
}));

export const brandsRelations = relations(brands, ({ many }) => ({ products: many(products) }));

export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  user: one(users, { fields: [orders.userId], references: [users.id] }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

/**
 * Customers the shop marked as "некоректен" (did not collect a parcel). Kept by e-mail and phone rather than
 * by account, so a later order is recognised even when it is placed as a guest.
 */
export const flaggedContacts = sqliteTable(
  "flagged_contacts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** The registered account this was marked on, when there is one. */
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Lower-cased. */
    email: text("email"),
    /** Normalised with normalizePhone (digits only, national format). */
    phone: text("phone"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("flagged_contacts_email_idx").on(t.email), index("flagged_contacts_phone_idx").on(t.phone)],
);

/** One Facebook group post with the product it offers. Its comments become fbClaims. */
export const fbPosts = sqliteTable("fb_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  /** Product name at import time, so the post still reads right if the product is later deleted. */
  productName: text("product_name").notNull(),
  /** Price in cents for a product typed in by hand (productId is then null); such items take no stock. */
  price: integer("price"),
  url: text("url"),
  createdAt: createdAt(),
});

/**
 * The last contact and delivery details used for a Facebook name, so the next order from the same person
 * is filled in the same way. Keyed by the lower-cased name as it appears on Facebook.
 */
export const fbContacts = sqliteTable("fb_contacts", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull().default(""),
  delivery: text("delivery").notNull(),
  courier: text("courier"),
  officeCode: text("office_code"),
  city: text("city").notNull().default(""),
  address: text("address").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const FB_CLAIM_STATUSES = ["pending", "ordered", "rejected"] as const;
export type FbClaimStatus = (typeof FB_CLAIM_STATUSES)[number];

/** "1 бр за мен" under a post: who asked and how many, until it is turned into an order or dropped. */
export const fbClaims = sqliteTable(
  "fb_claims",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id")
      .notNull()
      .references(() => fbPosts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    qty: integer("qty").notNull(),
    comment: text("comment").notNull(),
    status: text("status", { enum: FB_CLAIM_STATUSES }).notNull().default("pending"),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("fb_claims_post_idx").on(t.postId)],
);

/**
 * A timed discount. It is live while enabled and startsAt <= now < endsAt, so it switches itself on and off.
 * It covers the products listed in promotionProducts, or a whole category (with its subcategories) when categoryId is set.
 */
export const promotions = sqliteTable("promotions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  /** Whole percent off the regular price, 1–90. */
  percent: integer("percent").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp" }).notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

export const promotionProducts = sqliteTable(
  "promotion_products",
  {
    promotionId: integer("promotion_id")
      .notNull()
      .references(() => promotions.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.promotionId, t.productId] }), index("promotion_products_product_idx").on(t.productId)],
);

export const LOYALTY_KINDS = ["earn", "reverse", "redeem", "refund", "adjust"] as const;

/** Every change to a customer's points; the balance is the sum. */
export const loyaltyLedger = sqliteTable(
  "loyalty_ledger",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
    points: integer("points").notNull(),
    kind: text("kind", { enum: LOYALTY_KINDS }).notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("loyalty_user_idx").on(t.userId), index("loyalty_order_idx").on(t.orderId)],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    body: text("body").notNull().default(""),
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("reviews_product_user_idx").on(t.productId, t.userId)],
);

/** "Уведоми ме, когато е наличен". notifiedAt is set once the e-mail has gone out. */
export const stockAlerts = sqliteTable(
  "stock_alerts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    notifiedAt: integer("notified_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("stock_alerts_product_email_idx").on(t.productId, t.email)],
);

/**
 * A consumer's statement of withdrawal from a contract, sent through the „Откажете се от договора тук“
 * function (ЗЗП чл. 52а). Kept as submitted, with the moment it arrived, as proof for both sides.
 */
export const withdrawals = sqliteTable(
  "withdrawals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** The order it was matched to by number; null when the number did not match any order. */
    orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
    /** The order number exactly as the customer typed it. */
    orderNumber: text("order_number").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    /** Which products, when the withdrawal covers only part of the order; empty for the whole order. */
    details: text("details"),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    /** When the confirmation e-mail went out (automatically, or marked by the admin after sending it). */
    confirmedAt: integer("confirmed_at", { mode: "timestamp" }),
    /** When the shop finished handling it (goods back, money refunded). */
    handledAt: integer("handled_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [index("withdrawals_order_idx").on(t.orderId)],
);

/**
 * A card payment taken in the physical shop: the customer scans the QR code at the till, types the amount
 * on /plati and pays through Stripe. A row is written only once Stripe confirms the money.
 */
export const storePayments = sqliteTable("store_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Euro cents. */
  amount: integer("amount").notNull(),
  /** What the customer wrote about the payment (a name, what it is for). */
  note: text("note"),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  stripePaymentIntent: text("stripe_payment_intent"),
  /** When the shop marked it as seen at the till; until then it counts as an admin notification. */
  seenAt: integer("seen_at", { mode: "timestamp" }),
  createdAt: createdAt(),
});

/**
 * Anonymous visit statistics for the admin (Админ → Посетители): page views, time on page, clicks,
 * cart adds and orders. No cookie or device storage is used: `visitor` is a hash of the day, the IP
 * address and the browser, so it cannot be linked across days or back to a person. Rows are deleted after 90 days.
 */
export const EVENT_TYPES = ["view", "time", "click", "cart_add", "order"] as const;
export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** Bulgarian calendar day, "2026-11-13". */
    day: text("day").notNull(),
    /** Hour of that day in Bulgarian time, 0–23. */
    hour: integer("hour").notNull(),
    visitor: text("visitor").notNull(),
    type: text("type", { enum: EVENT_TYPES }).notNull(),
    path: text("path").notNull(),
    /** What kind of page the path is: home, product, category, search, cart, checkout… */
    kind: text("kind").notNull(),
    /** Clicks: "zone · what was clicked". Searches: the query. */
    label: text("label"),
    /** cart_add: the product. */
    productId: integer("product_id"),
    /** time: seconds the page was on screen. order: the order total in cents. */
    value: integer("value"),
    /** First view of a visit: where the visitor came from (a host name or utm_source). */
    source: text("source"),
    device: text("device"),
    createdAt: createdAt(),
  },
  (t) => [index("events_day_idx").on(t.day), index("events_type_day_idx").on(t.type, t.day)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export type Category = typeof categories.$inferSelect;
export type Brand = typeof brands.$inferSelect;
export type Product = typeof products.$inferSelect;
export type User = typeof users.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type StorePayment = typeof storePayments.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type ChatThread = typeof chatThreads.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type FlaggedContact = typeof flaggedContacts.$inferSelect;
export type FbPost = typeof fbPosts.$inferSelect;
export type FbClaim = typeof fbClaims.$inferSelect;
export type Promotion = typeof promotions.$inferSelect;
export type Review = typeof reviews.$inferSelect;
