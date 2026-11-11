import fs from "node:fs/promises";
import path from "node:path";

async function fetchEcont() {
  console.log("Fetching Econt offices...");
  const res = await fetch("https://ee.econt.com/services/Nomenclatures/NomenclaturesService.getOffices.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ countryCode: "BGR" }),
  });
  if (!res.ok) throw new Error(`Econt request failed: ${res.status}`);
  const data = await res.json();
  const raw = data.offices || [];
  
  const normalized = [];
  for (const o of raw) {
    const isLocker = Boolean(o.isAPS);
    const city = (o.address?.city?.name || "").trim();
    if (!city) continue;
    
    // Normalize city capitalization
    const cleanCity = city.charAt(0).toUpperCase() + city.slice(1);
    
    normalized.push({
      id: `econt-${o.id}`,
      code: String(o.code || o.id),
      name: (o.name || "").trim(),
      courier: "econt",
      type: isLocker ? "box" : "office",
      city: cleanCity,
      address: (o.address?.fullAddress || "").trim(),
      phone: o.phones?.[0] || "",
    });
  }
  console.log(`Econt: fetched ${normalized.length} locations (${normalized.filter(o => o.type === "box").length} lockers).`);
  return normalized;
}

async function fetchSpeedy() {
  console.log("Fetching Speedy offices...");
  const res = await fetch("https://services.speedy.bg/office_locator_widget_v2/offices_list.php?lang=bg&countryId=100");
  if (!res.ok) throw new Error(`Speedy request failed: ${res.status}`);
  const html = await res.text();
  
  const regex = /<div[^>]*id="(\d+)"[^>]*class="divOffice"[^>]*><b>([^<]+)<\/b><br><i>Адрес:<\/i>\s*<b>([^<]+)<\/b>/g;
  let match;
  const normalized = [];
  
  while ((match = regex.exec(html)) !== null) {
    const id = match[1];
    let rawName = match[2].replace(/&nbsp;/g, " ").trim();
    rawName = rawName.replace(/\s*\[\d+\]\s*$/, "").trim();
    const addr = match[3].replace(/&nbsp;/g, " ").trim();
    const isLocker = rawName.includes("(АВТОМАТ)") || rawName.includes("АПС");
    
    // Extract city from Address: "гр. Плевен ..." or "с. Оброчище ..."
    let city = "";
    const m = addr.match(/^(?:гр\.|с\.)\s*([^\d,\[]+?)(?:\s*\[|\s+ул\.|\s+бул\.|\s+жк|\s+пл\.|\s+кв\.|\s+местност|\s+No|\s*$)/i);
    if (m) {
      city = m[1].trim();
    } else {
      const nm = rawName.split(/[-–(]/)[0].trim();
      city = nm.charAt(0) + nm.slice(1).toLowerCase();
    }
    
    const cleanCity = city.charAt(0).toUpperCase() + city.slice(1);
    
    normalized.push({
      id: `speedy-${id}`,
      code: String(id),
      name: rawName,
      courier: "speedy",
      type: isLocker ? "box" : "office",
      city: cleanCity,
      address: addr,
      phone: "070017001",
    });
  }
  console.log(`Speedy: fetched ${normalized.length} locations (${normalized.filter(o => o.type === "box").length} lockers).`);
  return normalized;
}

// Box Now publishes its lockers for its own map widget (widget-v5.boxnow.bg); the id is the locker id their API expects.
async function fetchBoxNow() {
  console.log("Fetching Box Now lockers...");
  const res = await fetch("https://globallockersprod.z28.web.core.windows.net/PROD/bulgaria/lockers/all.json");
  if (!res.ok) throw new Error(`Box Now request failed: ${res.status}`);
  const data = await res.json();

  const normalized = [];
  for (const o of Object.values(data)) {
    // "ул. Цар Самуил, Плевен, 5802" -> street, settlement, postal code
    const parts = String(o.address || "").split(",").map((p) => p.trim()).filter(Boolean);
    if (/^-?\d{4}$/.test(parts[parts.length - 1] || "")) parts.pop();
    const city = parts.pop();
    if (!o.id || !city) continue;
    normalized.push({
      id: `boxnow-${o.id}`,
      code: String(o.id),
      name: String(o.title || `BOX NOW ${o.id}`).replace(/\s*-\s*24\/7\s*$/, "").trim(),
      courier: "boxnow",
      type: "box",
      city,
      address: parts.join(", ") || city,
      phone: "",
    });
  }
  console.log(`Box Now: fetched ${normalized.length} lockers.`);
  return normalized;
}

// Pigeon Express serves its offices and lockers (АПС) to its own locations map from this endpoint.
async function fetchPigeon() {
  console.log("Fetching Pigeon Express locations...");
  const res = await fetch("https://pigeonexpress.com/api/locations?locale=bg&categories=office,locker", {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (office list sync)" },
  });
  if (!res.ok) throw new Error(`Pigeon Express request failed: ${res.status}`);
  const data = await res.json();

  const normalized = [];
  for (const o of data.locations || []) {
    const city = (o.city || "").trim();
    if (!o.code || !city) continue;
    normalized.push({
      id: `pigeon-${o.id}`,
      code: String(o.code),
      name: (o.name || "").trim(),
      courier: "pigeon",
      type: o.type === "locker" ? "box" : "office",
      city,
      address: (o.address || "").trim(),
      phone: o.phone ? `+${String(o.phone).replace(/^\+/, "")}` : "",
    });
  }
  console.log(`Pigeon Express: fetched ${normalized.length} locations (${normalized.filter((o) => o.type === "box").length} lockers).`);
  return normalized;
}

// The couriers spell settlements slightly differently ("с. Нови хан", "Варнa" with a Latin "a").
// Bring them to one spelling so a customer who types a town sees every courier's locations there.
const LATIN_LOOKALIKES = { a: "а", e: "е", o: "о", p: "р", c: "с", x: "х", y: "у", A: "А", B: "В", E: "Е", K: "К", M: "М", H: "Н", O: "О", P: "Р", C: "С", T: "Т", X: "Х" };
function cleanCity(city) {
  let c = city.replace(/^(гр|с)\.\s*/i, "").trim();
  if (/[а-яА-Я]/.test(c)) c = c.replace(/[aeopcxyABEKMHOPCTX]/g, (ch) => LATIN_LOOKALIKES[ch]);
  return c.charAt(0).toUpperCase() + c.slice(1);
}
function unifyCities(all) {
  const canonical = new Map();
  for (const o of all) {
    o.city = cleanCity(o.city);
    const key = o.city.toLowerCase();
    if (!canonical.has(key)) canonical.set(key, o.city);
    o.city = canonical.get(key);
  }
}

async function main() {
  // Any failed source aborts the run, so a half-empty list never replaces a good one.
  const [econt, speedy, boxnow, pigeon] = await Promise.all([fetchEcont(), fetchSpeedy(), fetchBoxNow(), fetchPigeon()]);
  for (const [name, list] of Object.entries({ econt, speedy, boxnow, pigeon })) {
    if (list.length === 0) throw new Error(`${name} returned no locations`);
  }
  // Econt and Speedy first: their spelling of a settlement becomes the common one.
  const all = [...econt, ...speedy, ...boxnow, ...pigeon];
  unifyCities(all);
  
  // Collect unique cities
  const citiesMap = new Map();
  for (const o of all) {
    if (!o.city) continue;
    const count = citiesMap.get(o.city) || 0;
    citiesMap.set(o.city, count + 1);
  }
  
  // Sort cities alphabetically, but with major cities prioritized
  const majorCities = ["София", "Пловдив", "Варна", "Бургас", "Русе", "Стара Загора", "Плевен", "Сливен", "Добрич", "Шумен", "Перник", "Хасково", "Ямбол", "Пазарджик", "Благоевград", "Велико Търново", "Враца", "Габрово", "Видин", "Монтана", "Кърджали", "Кюстендил", "Ловеч"];
  
  const allCities = Array.from(citiesMap.keys()).sort((a, b) => {
    const aMajor = majorCities.indexOf(a);
    const bMajor = majorCities.indexOf(b);
    if (aMajor !== -1 && bMajor !== -1) return aMajor - bMajor;
    if (aMajor !== -1) return -1;
    if (bMajor !== -1) return 1;
    return a.localeCompare(b, "bg");
  });

  const outDir = path.resolve(process.cwd(), "data", "couriers");
  await fs.mkdir(outDir, { recursive: true });
  
  const officesFile = path.join(outDir, "offices.json");
  const citiesFile = path.join(outDir, "cities.json");
  
  await fs.writeFile(officesFile, JSON.stringify(all, null, 2), "utf-8");
  await fs.writeFile(citiesFile, JSON.stringify(allCities, null, 2), "utf-8");
  
  console.log(`\nSuccessfully saved:`);
  console.log(`- ${officesFile} (${all.length} total offices/lockers)`);
  console.log(`- ${citiesFile} (${allCities.length} settlements)`);
}

main().catch((err) => {
  console.error("Sync couriers failed:", err);
  process.exit(1);
});
