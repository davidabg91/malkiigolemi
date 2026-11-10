/**
 * Creates the schema and fills the shop with sample data.
 * Run with: npm run db:seed   (safe to re-run — it wipes and re-creates the catalogue)
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdirSync } from "node:fs";
import { searchTextOf, slugify } from "../lib/slug";

type Opts = {
  old?: number;
  bulk?: [number, number];
  isNew?: boolean;
  feat?: boolean;
  origin?: string;
  desc?: string;
};
type Row = [sub: string, brand: string, name: string, unit: string, price: number, pack: string, color: string, opts?: Opts];

const CATEGORIES: {
  slug: string;
  name: string;
  tone: string;
  icon: string;
  description: string;
  children: [slug: string, name: string][];
}[] = [
  {
    slug: "hrani",
    name: "Храни",
    tone: "butter",
    icon: "UtensilsCrossed",
    description: "Паста, зехтин, консерви и сладки изкушения от Средиземноморието.",
    children: [
      ["pasta-i-oriz", "Паста и ориз"],
      ["zehtin-i-maslini", "Зехтин и маслини"],
      ["konservi-i-sosove", "Консерви и сосове"],
      ["sladko-i-shokolad", "Сладко и шоколад"],
      ["snaksove", "Солени снаксове"],
    ],
  },
  {
    slug: "kafe-i-chai",
    name: "Кафе и чай",
    tone: "peach",
    icon: "Coffee",
    description: "Италианско еспресо на зърна, мляно и на капсули, плюс подбрани чайове.",
    children: [
      ["kafe-na-zarna", "Кафе на зърна"],
      ["mlyano-kafe", "Мляно кафе"],
      ["kafe-kapsuli", "Кафе капсули"],
      ["chai", "Чай"],
    ],
  },
  {
    slug: "napitki",
    name: "Вода и напитки",
    tone: "sky",
    icon: "GlassWater",
    description: "Минерална вода, газирани напитки, сокове и вино.",
    children: [
      ["voda", "Вода"],
      ["bezalkoholni", "Безалкохолни"],
      ["sokove", "Натурални сокове"],
      ["vino-i-bira", "Вино и бира"],
    ],
  },
  {
    slug: "pochistvane-i-prane",
    name: "Пране и почистване",
    tone: "mint",
    icon: "SprayCan",
    description: "Перилни и почистващи препарати с италианско качество.",
    children: [
      ["perilni-preparati", "Перилни препарати"],
      ["omekotiteli", "Омекотители"],
      ["pochistvashti-preparati", "Почистващи препарати"],
      ["za-sadove", "За съдове"],
    ],
  },
  {
    slug: "kozmetika",
    name: "Козметика",
    tone: "rose",
    icon: "Sparkles",
    description: "Грижа за коса, лице и тяло за всеки ден.",
    children: [
      ["za-kosa", "За коса"],
      ["za-tyalo", "За тяло"],
      ["za-litse", "За лице"],
      ["ustna-higiena", "Устна хигиена"],
    ],
  },
  {
    slug: "bebe-i-dete",
    name: "Бебе и дете",
    tone: "lilac",
    icon: "Baby",
    description: "Нежни продукти за най-малките.",
    children: [
      ["peleni", "Пелени"],
      ["bebeshka-kozmetika", "Бебешка козметика"],
      ["mokri-karpi", "Мокри кърпи"],
    ],
  },
  {
    slug: "dom-i-ofis",
    name: "Дом и офис",
    tone: "lime",
    icon: "Lamp",
    description: "Хартия, аромати и дребните неща, които правят дома уютен.",
    children: [
      ["hartiya", "Тоалетна и кухненска хартия"],
      ["aromati-i-sveshti", "Аромати и свещи"],
      ["domashni-potrebi", "Домашни потреби"],
    ],
  },
];

const BRANDS: [name: string, country: string][] = [
  ["Caffè Aurelio", "IT"],
  ["Bruna Torrefazione", "IT"],
  ["Monte Verdi", "IT"],
  ["Pasta Liberata", "IT"],
  ["Casa Fiorella", "IT"],
  ["Orto Sole", "IT"],
  ["Dolce Sera", "IT"],
  ["Kalamos", "GR"],
  ["Elia Thalassa", "GR"],
  ["Meli & Thyme", "GR"],
  ["Hellas Bites", "GR"],
  ["Acqua Serena", "IT"],
  ["Frizzo", "IT"],
  ["Vigna Rossa", "IT"],
  ["Tè Giardino", "IT"],
  ["Bianca Casa", "IT"],
  ["Lavanda Pura", "IT"],
  ["Nuvola", "IT"],
  ["Aegea Care", "GR"],
  ["Piccolo", "IT"],
];

const P: Row[] = [
  // ── Храни
  ["pasta-i-oriz", "Pasta Liberata", "Спагети № 5 от твърда пшеница", "500 г", 139, "box", "#1D4E89", { feat: true }],
  ["pasta-i-oriz", "Pasta Liberata", "Пене ригате бронзова матрица", "500 г", 149, "box", "#1D4E89"],
  ["pasta-i-oriz", "Pasta Liberata", "Фузили трицветни", "500 г", 169, "box", "#2E7D4F", { isNew: true }],
  ["pasta-i-oriz", "Casa Fiorella", "Талиатели с яйца", "250 г", 229, "box", "#C8553D", { old: 269 }],
  ["pasta-i-oriz", "Casa Fiorella", "Ориз Арборио за ризото", "1 кг", 349, "bag", "#E8B04A"],
  ["pasta-i-oriz", "Kalamos", "Критараки (орзо)", "500 г", 159, "bag", "#2C6E9B", { origin: "GR" }],
  ["zehtin-i-maslini", "Elia Thalassa", "Зехтин екстра върджин Коронейки", "750 мл", 1190, "bottle", "#5B7B2A", { feat: true, bulk: [3, 1090], origin: "GR", desc: "Студено пресован зехтин от маслини Коронейки, събрани на ръка в Пелопонес. Ниска киселинност и плодов, леко пикантен вкус." }],
  ["zehtin-i-maslini", "Elia Thalassa", "Зехтин екстра върджин", "3 л тенекия", 3690, "tin", "#5B7B2A", { old: 4190, origin: "GR" }],
  ["zehtin-i-maslini", "Kalamos", "Маслини Каламата с костилка", "370 г", 389, "jar", "#5A2A4F", { origin: "GR", feat: true }],
  ["zehtin-i-maslini", "Kalamos", "Зелени маслини с чесън", "370 г", 359, "jar", "#7A8F3A", { origin: "GR" }],
  ["zehtin-i-maslini", "Monte Verdi", "Балсамов оцет от Модена", "500 мл", 459, "bottle", "#3B1F1A"],
  ["konservi-i-sosove", "Orto Sole", "Белени домати", "400 г", 99, "can", "#D8402B", { bulk: [6, 85] }],
  ["konservi-i-sosove", "Orto Sole", "Пасата от домати", "700 г", 189, "bottle", "#D8402B"],
  ["konservi-i-sosove", "Orto Sole", "Песто алла Дженовезе", "190 г", 319, "jar", "#3F8A3C", { isNew: true }],
  ["konservi-i-sosove", "Casa Fiorella", "Риба тон в зехтин", "3 × 80 г", 449, "can", "#1E5A8A", { old: 529 }],
  ["konservi-i-sosove", "Hellas Bites", "Долмадакия — лозови сарми", "280 г", 329, "can", "#4E7D3A", { origin: "GR" }],
  ["sladko-i-shokolad", "Dolce Sera", "Лешников крем с какао", "350 г", 499, "jar", "#6B3E26", { feat: true }],
  ["sladko-i-shokolad", "Dolce Sera", "Черен шоколад 72% какао", "100 г", 249, "bar", "#3A2418"],
  ["sladko-i-shokolad", "Dolce Sera", "Кантучини с бадеми", "250 г", 379, "bag", "#C98B3E", { isNew: true }],
  ["sladko-i-shokolad", "Meli & Thyme", "Тимианов мед", "450 г", 890, "jar", "#D99A1C", { origin: "GR", feat: true }],
  ["sladko-i-shokolad", "Meli & Thyme", "Халва с ванилия", "250 г", 299, "box", "#E3C28B", { origin: "GR" }],
  ["snaksove", "Hellas Bites", "Чипс с риган и морска сол", "150 г", 219, "bag", "#2F7D5B", { origin: "GR" }],
  ["snaksove", "Hellas Bites", "Критски сухари с маслини", "200 г", 279, "bag", "#8A6B2F", { origin: "GR", isNew: true }],
  ["snaksove", "Casa Fiorella", "Гризини със сусам", "125 г", 159, "box", "#D9A441"],
  ["snaksove", "Casa Fiorella", "Таралини с розмарин", "250 г", 249, "bag", "#6E8B3D", { old: 289 }],

  // ── Кафе и чай
  ["kafe-na-zarna", "Caffè Aurelio", "Crema Classica — кафе на зърна", "1 кг", 1890, "bag", "#B3261E", { feat: true, bulk: [3, 1750], desc: "Балансирана смес от арабика и робуста с плътно тяло и кадифен каймак. Тъмно изпичане, интензитет 8/10. Подходящо за еспресо и напитки с мляко." }],
  ["kafe-na-zarna", "Caffè Aurelio", "Oro Arabica 100% — кафе на зърна", "1 кг", 2390, "bag", "#C99A2E", { old: 2690 }],
  ["kafe-na-zarna", "Bruna Torrefazione", "Espresso Bar — кафе на зърна", "1 кг", 1690, "bag", "#2B2B2B"],
  ["kafe-na-zarna", "Bruna Torrefazione", "Decaffeinato — кафе на зърна", "500 г", 1090, "bag", "#2F6DB5", { isNew: true }],
  ["mlyano-kafe", "Caffè Aurelio", "Crema Classica — мляно кафе", "250 г", 449, "pack", "#B3261E", { bulk: [4, 399] }],
  ["mlyano-kafe", "Caffè Aurelio", "Intenso — мляно кафе", "250 г", 469, "pack", "#3A1F14"],
  ["mlyano-kafe", "Bruna Torrefazione", "Moka — мляно за кафеварка", "250 г", 399, "tin", "#8C4A2F", { old: 459, feat: true }],
  ["kafe-kapsuli", "Caffè Aurelio", "Капсули Ristretto, съвместими с Nespresso", "10 бр", 289, "box", "#3A1F14", { bulk: [5, 259] }],
  ["kafe-kapsuli", "Caffè Aurelio", "Капсули Lungo, съвместими с Nespresso", "10 бр", 289, "box", "#C99A2E"],
  ["kafe-kapsuli", "Bruna Torrefazione", "Капсули Cremoso, съвместими с Dolce Gusto", "16 бр", 449, "box", "#8C4A2F", { isNew: true }],
  ["kafe-kapsuli", "Bruna Torrefazione", "Капсули Decaffeinato, съвместими с Nespresso", "10 бр", 309, "box", "#2F6DB5"],
  ["chai", "Tè Giardino", "Зелен чай с жасмин", "20 пакетчета", 259, "box", "#5E9C4B"],
  ["chai", "Tè Giardino", "Черен чай Ърл Грей", "20 пакетчета", 259, "box", "#3D3A6B"],
  ["chai", "Meli & Thyme", "Планински чай мурсалски тип", "40 г", 319, "bag", "#7B8F5A", { origin: "GR", isNew: true }],

  // ── Напитки
  ["voda", "Acqua Serena", "Минерална вода негазирана", "6 × 1,5 л", 359, "bottle", "#3FA9D8", { bulk: [4, 319] }],
  ["voda", "Acqua Serena", "Минерална вода газирана", "750 мл стъкло", 129, "bottle", "#1F7A54", { feat: true }],
  ["voda", "Acqua Serena", "Минерална вода за бебета", "1 л", 89, "bottle", "#9FD3EE"],
  ["bezalkoholni", "Frizzo", "Лимонада със сицилиански лимони", "275 мл", 159, "bottle", "#F2C230", { feat: true, old: 189 }],
  ["bezalkoholni", "Frizzo", "Аранчата с червен портокал", "330 мл кен", 119, "can", "#E8612C"],
  ["bezalkoholni", "Frizzo", "Кинотто", "330 мл кен", 119, "can", "#3B2A22", { isNew: true }],
  ["bezalkoholni", "Frizzo", "Студен чай с праскова", "500 мл", 139, "bottle", "#E89A5B"],
  ["sokove", "Orto Sole", "Сок от праскова 100%", "1 л", 249, "carton", "#F0994A"],
  ["sokove", "Orto Sole", "Нектар от круша", "6 × 200 мл", 399, "carton", "#B9C24A", { old: 459 }],
  ["sokove", "Kalamos", "Сок от нар", "750 мл", 429, "bottle", "#A6233A", { origin: "GR", isNew: true }],
  ["vino-i-bira", "Vigna Rossa", "Примитиво ди Пулия", "750 мл", 990, "bottle", "#5C1A2B", { feat: true }],
  ["vino-i-bira", "Vigna Rossa", "Пино Гриджо", "750 мл", 890, "bottle", "#C9C36A"],
  ["vino-i-bira", "Vigna Rossa", "Просеко Екстра Драй", "750 мл", 1290, "bottle", "#1F3D2E", { old: 1490 }],
  ["vino-i-bira", "Kalamos", "Лагер бира", "330 мл", 149, "bottle", "#D9A62E", { origin: "GR", bulk: [6, 129] }],

  // ── Пране и почистване
  ["perilni-preparati", "Bianca Casa", "Течен перилен препарат Универсален", "40 пранета · 2 л", 899, "jug", "#2E78C7", { feat: true, old: 1090 }],
  ["perilni-preparati", "Bianca Casa", "Течен перилен препарат Цветно", "40 пранета · 2 л", 899, "jug", "#D9457A"],
  ["perilni-preparati", "Bianca Casa", "Капсули за пране 3 в 1", "30 бр", 1190, "box", "#2E78C7", { isNew: true }],
  ["perilni-preparati", "Lavanda Pura", "Марсилски сапун за пране", "250 г", 189, "bar", "#B8A98A"],
  ["omekotiteli", "Lavanda Pura", "Омекотител Лавандулови полета", "40 пранета · 0,8 л", 349, "jug", "#8E72C9", { bulk: [3, 309] }],
  ["omekotiteli", "Lavanda Pura", "Омекотител Пролетно утро", "40 пранета · 0,8 л", 349, "jug", "#4FB3A2"],
  ["omekotiteli", "Lavanda Pura", "Ароматни перли за пране", "230 г", 529, "bottle", "#E06A9B", { isNew: true }],
  ["pochistvashti-preparati", "Bianca Casa", "Обезмаслител за кухня", "750 мл", 329, "spray", "#F2A21C", { feat: true }],
  ["pochistvashti-preparati", "Bianca Casa", "Препарат за стъкла", "750 мл", 279, "spray", "#39A7DB"],
  ["pochistvashti-preparati", "Bianca Casa", "Препарат против варовик", "500 мл", 319, "spray", "#7BC043", { old: 379 }],
  ["pochistvashti-preparati", "Bianca Casa", "Препарат за под с цитрус", "1 л", 299, "bottle", "#E7B416"],
  ["za-sadove", "Bianca Casa", "Таблетки за съдомиялна All in 1", "60 бр", 1290, "box", "#1F9E8A", { old: 1590, bulk: [2, 1190] }],
  ["za-sadove", "Bianca Casa", "Препарат за съдове с лимон", "1 л", 219, "bottle", "#E9D21F"],

  // ── Козметика
  ["za-kosa", "Aegea Care", "Шампоан със зехтин и алое", "400 мл", 459, "pump", "#6C9A3B", { origin: "GR", feat: true }],
  ["za-kosa", "Aegea Care", "Балсам за блясък", "300 мл", 489, "pump", "#C7A23A", { origin: "GR" }],
  ["za-kosa", "Aegea Care", "Маска с мед и арган", "200 мл", 549, "jar", "#D99A1C", { origin: "GR", isNew: true }],
  ["za-tyalo", "Aegea Care", "Душ гел с морска сол", "500 мл", 399, "pump", "#2C8FB5", { origin: "GR" }],
  ["za-tyalo", "Lavanda Pura", "Течен сапун с лавандула", "500 мл", 289, "pump", "#8E72C9", { old: 339 }],
  ["za-tyalo", "Aegea Care", "Мляко за тяло с маслина", "250 мл", 599, "pump", "#A7B86B", { origin: "GR" }],
  ["za-litse", "Aegea Care", "Мицеларна вода", "400 мл", 529, "bottle", "#F4B6C2", { origin: "GR", isNew: true }],
  ["za-litse", "Aegea Care", "Хидратиращ крем за лице", "50 мл", 890, "jar", "#F2D0A9", { origin: "GR" }],
  ["ustna-higiena", "Bianca Casa", "Паста за зъби Свежа мента", "75 мл", 199, "tube", "#27A39A", { bulk: [3, 169] }],
  ["ustna-higiena", "Bianca Casa", "Паста за зъби Избелваща", "75 мл", 229, "tube", "#3D7BD9"],

  // ── Бебе и дете
  ["peleni", "Piccolo", "Пелени размер 3 (6–10 кг)", "52 бр", 1390, "pack", "#7FC8E8", { feat: true, old: 1590 }],
  ["peleni", "Piccolo", "Пелени размер 4 (9–14 кг)", "46 бр", 1390, "pack", "#9B8BE0"],
  ["peleni", "Piccolo", "Гащички размер 5 (12–17 кг)", "40 бр", 1490, "pack", "#F29AB1", { isNew: true }],
  ["bebeshka-kozmetika", "Piccolo", "Бебешки шампоан без сълзи", "300 мл", 389, "pump", "#F5C542"],
  ["bebeshka-kozmetika", "Piccolo", "Крем против подсичане", "100 мл", 449, "tube", "#8FD0C0"],
  ["mokri-karpi", "Piccolo", "Мокри кърпи 99% вода", "72 бр", 199, "pack", "#8FD0C0", { bulk: [6, 169], feat: true }],
  ["mokri-karpi", "Piccolo", "Мокри кърпи с лайка", "3 × 64 бр", 499, "pack", "#F5C542", { old: 589 }],

  // ── Дом и офис
  ["hartiya", "Nuvola", "Тоалетна хартия 3 пласта", "8 рула", 399, "roll", "#F2A0B5", { feat: true, old: 459 }],
  ["hartiya", "Nuvola", "Тоалетна хартия 4 пласта Camomilla", "10 рула", 549, "roll", "#F2C94C"],
  ["hartiya", "Nuvola", "Кухненска хартия Maxi", "2 рула", 329, "roll", "#7FB7E6", { bulk: [3, 289] }],
  ["hartiya", "Nuvola", "Салфетки бели", "100 бр", 129, "pack", "#C9D6DF"],
  ["aromati-i-sveshti", "Lavanda Pura", "Ароматизатор с пръчици Лавандула", "100 мл", 790, "bottle", "#8E72C9", { isNew: true }],
  ["aromati-i-sveshti", "Lavanda Pura", "Ароматна свещ Смокиня", "180 г", 690, "jar", "#7A9B5C", { feat: true }],
  ["aromati-i-sveshti", "Lavanda Pura", "Спрей за стая Бяла памучна", "300 мл", 349, "spray", "#B9D4E6", { old: 399 }],
  ["domashni-potrebi", "Bianca Casa", "Гъби за съдове", "5 бр", 149, "pack", "#F2C230"],
  ["domashni-potrebi", "Bianca Casa", "Торби за смет 35 л", "30 бр", 189, "roll", "#3A3F47"],
  ["domashni-potrebi", "Bianca Casa", "Алуминиево фолио", "30 м", 269, "box", "#9AA7B2"],
];

const GENERIC_DESC: Record<string, string> = {
  hrani: "Подбран продукт с автентичен средиземноморски вкус. Съхранявайте на сухо и хладно място.",
  "kafe-i-chai": "Ароматна напитка за бавни сутрини и бързи следобеди. Съхранявайте в плътно затворена опаковка.",
  napitki: "Сервирайте охладено. Съхранявайте на сухо и защитено от слънце място.",
  "pochistvane-i-prane": "Ефективна формула с дълготраен свеж аромат. Използвайте според указанията на етикета.",
  kozmetika: "Нежна грижа за всеки ден с подбрани съставки. Дерматологично тестван продукт.",
  "bebe-i-dete": "Създадено за деликатната бебешка кожа. Без парабени и оцветители.",
  "dom-i-ofis": "Практичен помощник за дома и офиса на добра цена.",
};

async function main() {
  mkdirSync("data", { recursive: true });
  const { db, schema } = await import("./index");
  await migrate(db, { migrationsFolder: "./drizzle" });

  // Catalogue is rebuilt from scratch; orders and customers are kept.
  await db.delete(schema.products);
  await db.delete(schema.brands);
  await db.delete(schema.categories);

  const subToId = new Map<string, number>();
  const subToRoot = new Map<string, string>();

  for (const [i, c] of CATEGORIES.entries()) {
    const [root] = await db
      .insert(schema.categories)
      .values({ slug: c.slug, name: c.name, tone: c.tone, icon: c.icon, description: c.description, sort: i })
      .returning();
    for (const [j, [slug, name]] of c.children.entries()) {
      const [sub] = await db
        .insert(schema.categories)
        .values({ slug, name, parentId: root.id, tone: c.tone, icon: c.icon, sort: j })
        .returning();
      subToId.set(slug, sub.id);
      subToRoot.set(slug, c.slug);
    }
  }

  const brandToRow = new Map<string, { id: number; country: string | null }>();
  for (const [name, country] of BRANDS) {
    const [b] = await db.insert(schema.brands).values({ slug: slugify(name), name, country }).returning();
    brandToRow.set(name, { id: b.id, country: b.country });
  }

  const now = Math.floor(Date.now() / 1000);
  for (const [i, [sub, brandName, name, unit, price, pack, color, o = {}]] of P.entries()) {
    const brand = brandToRow.get(brandName);
    const categoryId = subToId.get(sub);
    if (!brand || !categoryId) throw new Error(`Bad seed row: ${name}`);
    const sku = String(1001 + i);
    const fullName = `${name} ${brandName}`;
    await db.insert(schema.products).values({
      slug: `${slugify(fullName)}-${sku}`,
      sku,
      name,
      description: o.desc ?? GENERIC_DESC[subToRoot.get(sub)!] ?? "",
      searchText: searchTextOf(name, brandName, sku, unit),
      categoryId,
      brandId: brand.id,
      price,
      oldPrice: o.old ?? null,
      bulkMinQty: o.bulk?.[0] ?? null,
      bulkPrice: o.bulk?.[1] ?? null,
      unit,
      pack,
      color,
      origin: o.origin ?? brand.country,
      stock: 20 + ((i * 37) % 180),
      isNew: o.isNew ?? false,
      isFeatured: o.feat ?? false,
      // Spread creation dates so "newest" sorting looks natural.
      createdAt: new Date((now - (P.length - i) * 3600) * 1000),
    });
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const passwordHash = await bcrypt.hash(password, 10);
    await db
      .insert(schema.users)
      .values({ email, passwordHash, name: "Администратор", role: "admin" })
      .onConflictDoUpdate({ target: schema.users.email, set: { passwordHash, role: "admin" } });
  }

  console.log(`Seeded ${CATEGORIES.length} categories, ${BRANDS.length} brands, ${P.length} products.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
