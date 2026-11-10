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

// Sample BoxNow major automated lockers
function getBoxNowLockers() {
  const common = [
    { id: "bn-1", code: "5001", name: "BoxNow Автомат - Central Mall", city: "Плевен", address: "пл. Възраждане 1 (Central Mall)", type: "box", courier: "boxnow", phone: "0700 70 774" },
    { id: "bn-2", code: "5002", name: "BoxNow Автомат - ж.к. Сторгозия", city: "Плевен", address: "ж.к. Сторгозия, до бл. 22", type: "box", courier: "boxnow", phone: "0700 70 774" },
    { id: "bn-3", code: "5003", name: "BoxNow Автомат - ж.к. Дружба", city: "Плевен", address: "ж.к. Дружба, до магазин Билла", type: "box", courier: "boxnow", phone: "0700 70 774" },
    { id: "bn-4", code: "1001", name: "BoxNow Автомат - Mall of Sofia", city: "София", address: "бул. Ал. Стамболийски 101", type: "box", courier: "boxnow", phone: "0700 70 774" },
    { id: "bn-5", code: "1002", name: "BoxNow Автомат - Paradise Center", city: "София", address: "бул. Черни връх 100", type: "box", courier: "boxnow", phone: "0700 70 774" },
    { id: "bn-6", code: "1003", name: "BoxNow Автомат - Сердика Център", city: "София", address: "бул. Ситняково 48", type: "box", courier: "boxnow", phone: "0700 70 774" },
    { id: "bn-7", code: "4001", name: "BoxNow Автомат - Mall Plovdiv", city: "Пловдив", address: "ул. Перущица 8", type: "box", courier: "boxnow", phone: "0700 70 774" },
    { id: "bn-8", code: "9001", name: "BoxNow Автомат - Grand Mall Varna", city: "Варна", address: "ул. Андрей Сахаров 2", type: "box", courier: "boxnow", phone: "0700 70 774" },
    { id: "bn-9", code: "8001", name: "BoxNow Автомат - Galleria Burgas", city: "Бургас", address: "ул. Янко Комитов 6", type: "box", courier: "boxnow", phone: "0700 70 774" },
    { id: "bn-10", code: "7001", name: "BoxNow Автомат - Mall Ruse", city: "Русе", address: "бул. Липник 121", type: "box", courier: "boxnow", phone: "0700 70 774" },
    { id: "bn-11", code: "6001", name: "BoxNow Автомат - Park Mall", city: "Стара Загора", address: "бул. Никола Петков 52", type: "box", courier: "boxnow", phone: "0700 70 774" },
  ];
  return common;
}

async function main() {
  const [econt, speedy] = await Promise.all([fetchEcont(), fetchSpeedy()]);
  const boxnow = getBoxNowLockers();
  const all = [...econt, ...speedy, ...boxnow];
  
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
