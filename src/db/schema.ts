import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  },
  (t) => [index("categories_parent_idx").on(t.parentId)],
);

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
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("new"),
    trackingNumber: text("tracking_number"),
    waybillUrl: text("waybill_url"),
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
