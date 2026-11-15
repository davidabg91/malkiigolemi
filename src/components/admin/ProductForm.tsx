"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useId, useState, type ReactNode } from "react";
import { saveProduct } from "@/actions/admin";
import { PackShot } from "@/components/product/PackShot";
import { btn } from "@/components/ui";
import { StockPill } from "@/components/product/StockPill";
import { ColorOptions } from "./ColorOptions";
import type { Brand, Product } from "@/db/schema";
import { AVAILABILITY_OPTIONS, availabilityOf, type Availability } from "@/lib/availability";
import { MAX_IMAGE_MB, PACKS } from "@/lib/listing";
import { colorChoices, DELIVERY_TIME_PRESETS, MAX_DELIVERY_TIME_LENGTH } from "@/lib/product-colors";
import { megabytes, replaceChosenFile, shrinkImage, UPLOAD_LIMIT } from "@/lib/shrink-image";
import { ORIGIN_LABELS } from "@/lib/site";

type CategoryOption = { id: number; name: string; children: { id: number; name: string }[] };

const euros = (cents: number | null | undefined) => (cents == null ? "" : (cents / 100).toFixed(2));

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-card bg-paper p-5 shadow-soft sm:p-6">
      <legend className="float-left mb-4 font-display text-lg font-semibold">{title}</legend>
      <div className="clear-both grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function ProductForm({
  product,
  brands,
  categories,
  returnUrl,
}: {
  product?: Product;
  brands: Brand[];
  categories: CategoryOption[];
  returnUrl?: string;
}) {
  // Per-form id prefix: the new and edit pages can both stay mounted (hidden) after navigating.
  const uid = useId();
  const [state, action, pending] = useActionState(saveProduct.bind(null, product?.id ?? null), undefined);
  const [pack, setPack] = useState(product?.pack ?? "box");
  const [color, setColor] = useState(product?.color ?? "#1F5C3F");
  const [brandId, setBrandId] = useState(product?.brandId ? String(product.brandId) : "");
  const [newBrand, setNewBrand] = useState("");
  const [initialColors] = useState(() => colorChoices({ colors: product?.colorOptions, colorStock: product?.colorStock }));
  // With colours the product has as many as its colours together; null = no colours, the number is typed.
  const [colorTotal, setColorTotal] = useState<number | null>(() => (initialColors.length > 0 ? initialColors.reduce((sum, c) => sum + c.stock, 0) : null));
  const [availability, setAvailability] = useState<Availability>(() => (product ? availabilityOf(product) : "available"));
  const [deliveryTime, setDeliveryTime] = useState(product?.deliveryTime ?? "");
  const [imageError, setImageError] = useState("");
  const [imageNote, setImageNote] = useState("");
  const [shrinking, setShrinking] = useState(false);
  const errors = state?.fieldErrors ?? {};
  const previewLabel = newBrand || brands.find((b) => String(b.id) === brandId)?.name || "Марка";

  const input = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, wide = false) => (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label htmlFor={`${uid}-${name}`} className="mb-1.5 block text-sm font-medium">
        {label} {props.required && <span className="text-tomato" aria-hidden>*</span>}
      </label>
      <input id={`${uid}-${name}`} name={name} className="field" aria-invalid={errors[name] ? true : undefined} aria-describedby={errors[name] ? `${uid}-${name}-error` : undefined} {...props} />
      {errors[name] && (
        <p id={`${uid}-${name}-error`} role="alert" className="mt-1.5 text-sm font-medium text-tomato">
          {errors[name]}
        </p>
      )}
    </div>
  );

  const check = (name: string, label: string, hint: string, defaultChecked: boolean) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-4 transition has-[:checked]:border-forest has-[:checked]:bg-lime/25">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-5 w-5 accent-[#33484b]" />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="text-sm text-ink-soft">{hint}</span>
      </span>
    </label>
  );

  return (
    <form
      // Submitting by hand (instead of the action prop) keeps what the admin typed when validation fails.
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => action(formData));
      }}
      className="grid items-start gap-6 xl:grid-cols-[1fr_20rem]"
    >
      {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}
      <div className="space-y-6">
        <Group title="Основни данни">
          {input("name", "Име на продукта", { required: true, defaultValue: product?.name, maxLength: 160 }, true)}
          <div>
            {input("sku", "Артикулен №", { defaultValue: product?.sku, maxLength: 40, placeholder: "Автоматично" })}
            {!errors.sku && <p className="mt-1.5 text-xs text-ink-soft">Остави празно и сайтът ще даде следващия свободен номер.</p>}
          </div>
          {input("unit", "Разфасовка", { defaultValue: product?.unit, placeholder: "напр. 500 г, 1 л, 10 бр" })}
          <div>
            <label htmlFor={`${uid}-categoryId`} className="mb-1.5 block text-sm font-medium">
              Категория <span className="text-tomato" aria-hidden>*</span>
            </label>
            <select id={`${uid}-categoryId`} name="categoryId" required defaultValue={product?.categoryId ?? ""} className="field" aria-invalid={errors.categoryId ? true : undefined}>
              <option value="" disabled>
                Избери…
              </option>
              {categories.map((c) => (
                <optgroup key={c.id} label={c.name}>
                  <option value={c.id}>{c.name} (общо)</option>
                  {c.children.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {errors.categoryId && <p role="alert" className="mt-1.5 text-sm font-medium text-tomato">{errors.categoryId}</p>}
          </div>
          <div>
            <label htmlFor={`${uid}-origin`} className="mb-1.5 block text-sm font-medium">
              Произход
            </label>
            <select id={`${uid}-origin`} name="origin" defaultValue={product?.origin ?? ""} className="field">
              <option value="">Не е посочен</option>
              {Object.entries(ORIGIN_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-brandId`} className="mb-1.5 block text-sm font-medium">
              Марка
            </label>
            <select id={`${uid}-brandId`} name="brandId" value={brandId} onChange={(e) => setBrandId(e.target.value)} disabled={newBrand !== ""} className="field disabled:opacity-50">
              <option value="">Без марка</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {/* A disabled select is not submitted, so mirror its value. */}
            {newBrand !== "" && <input type="hidden" name="brandId" value="" />}
          </div>
          <div>
            <label htmlFor={`${uid}-newBrand`} className="mb-1.5 block text-sm font-medium">
              …или нова марка
            </label>
            <input id={`${uid}-newBrand`} name="newBrand" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} maxLength={80} className="field" placeholder="Име на новата марка" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${uid}-description`} className="mb-1.5 block text-sm font-medium">
              Описание
            </label>
            <textarea id={`${uid}-description`} name="description" rows={5} maxLength={4000} defaultValue={product?.description} className="field h-auto py-3" />
          </div>
        </Group>

        <Group title="Цена и наличност">
          {input("price", "Цена (€)", { required: true, inputMode: "decimal", defaultValue: euros(product?.price), placeholder: "0.00" })}
          {input("oldPrice", "Стара цена (€) — за промоция", { inputMode: "decimal", defaultValue: euros(product?.oldPrice), placeholder: "празно = без промо" })}
          {input("bulkMinQty", "Цена за количество — от брой", { inputMode: "numeric", defaultValue: product?.bulkMinQty ?? "", placeholder: "напр. 3" })}
          {input("bulkPrice", "Цена за количество (€/бр)", { inputMode: "decimal", defaultValue: euros(product?.bulkPrice) })}
          {colorTotal === null ? (
            input("stock", "Наличност (бр)", { inputMode: "numeric", defaultValue: product?.stock ?? 100 })
          ) : (
            <div>
              <label htmlFor={`${uid}-stock`} className="mb-1.5 block text-sm font-medium">
                Наличност (бр)
              </label>
              <input id={`${uid}-stock`} name="stock" readOnly value={colorTotal} className="field bg-sand/60 text-ink-soft" aria-describedby={`${uid}-stock-hint`} />
              <p id={`${uid}-stock-hint`} className="mt-1.5 text-xs text-ink-soft">
                Сбор от цветовете — променя се от раздел „Цветове“ по-долу.
              </p>
            </div>
          )}
          <fieldset className="min-w-0 sm:col-span-2">
            <legend className="mb-1.5 block text-sm font-medium">Статус за клиента</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {AVAILABILITY_OPTIONS.map((o) => (
                <label
                  key={o.id}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-3.5 transition has-[:checked]:border-forest has-[:checked]:bg-lime/25 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-forest has-[:focus-visible]:ring-offset-2"
                >
                  <input type="radio" name="availability" value={o.id} checked={availability === o.id} onChange={() => setAvailability(o.id)} className="sr-only" />
                  <span className="min-w-0">
                    <StockPill product={{ stock: 1, availability: o.id, deliveryTime: o.id === "delivery" ? deliveryTime.trim() || "7 дни" : null }} />
                    <span className="mt-1.5 block text-xs text-ink-soft">{o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {availability !== "available" && (
              <div className="mt-3">
                <label htmlFor={`${uid}-deliveryTime`} className="mb-1.5 block text-sm font-medium">
                  {availability === "delivery" ? (
                    <>
                      Срок за доставка <span className="text-tomato" aria-hidden>*</span>
                    </>
                  ) : (
                    <>
                      Кога се очаква <span className="font-normal text-ink-soft">(по желание)</span>
                    </>
                  )}
                </label>
                <input
                  id={`${uid}-deliveryTime`}
                  name="deliveryTime"
                  list={availability === "delivery" ? `${uid}-deliveryTimes` : undefined}
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  maxLength={MAX_DELIVERY_TIME_LENGTH}
                  placeholder={availability === "delivery" ? "напр. 7 дни" : "напр. до 20 декември"}
                  className="field"
                  aria-invalid={errors.deliveryTime ? true : undefined}
                  aria-describedby={`${uid}-deliveryTime-hint`}
                />
                <datalist id={`${uid}-deliveryTimes`}>
                  {DELIVERY_TIME_PRESETS.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                {errors.deliveryTime && <p role="alert" className="mt-1.5 text-sm font-medium text-tomato">{errors.deliveryTime}</p>}
              </div>
            )}
            <p id={`${uid}-deliveryTime-hint`} className="mt-2 text-xs text-ink-soft">
              Клиентът вижда статуса при продукта, а срокът се записва и в поръчката. Статусът е само информация: дали продуктът може да се поръча, зависи от
              наличността по-горе. „Очаква се“ с 0 броя показва на клиента бутон „Уведоми ме“.
            </p>
          </fieldset>
        </Group>

        <Group title="Цветове">
          <ColorOptions initial={initialColors} onTotal={setColorTotal} />
        </Group>

        <Group title="Видимост">
          {check("active", "Показвай в магазина", "Изключи, за да скриеш временно.", product?.active ?? true)}
          {check("isNew", "Нов продукт", "Етикет „Ново“ и страница „Нови“.", product?.isNew ?? false)}
          {check("isFeatured", "Препоръчан", "По-напред в списъците и началната страница.", product?.isFeatured ?? false)}
        </Group>
      </div>

      <div className="space-y-6 xl:sticky xl:top-8">
        <fieldset className="rounded-card bg-paper p-5 shadow-soft">
          <legend className="float-left mb-4 font-display text-lg font-semibold">Визия</legend>
          <div className="clear-both grid place-items-center rounded-2xl p-4" style={{ background: `color-mix(in srgb, ${color} 12%, #f5f5f4)` }}>
            {product?.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin uploads are served as-is
              <img src={product.image} alt="" className="h-44 w-44 object-contain" />
            ) : (
              <PackShot pack={pack} color={color} label={previewLabel} className="h-44 w-40" />
            )}
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor={`${uid}-image`} className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                <ImagePlus className="h-4 w-4" aria-hidden />
                Снимка на продукта
              </label>
              <input
                id={`${uid}-image`}
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={async (e) => {
                  // A large photo is made smaller here, before it is sent: the request has room for about 4 MB.
                  const field = e.currentTarget;
                  const file = field.files?.[0];
                  setImageError("");
                  setImageNote("");
                  if (!file) return;
                  setShrinking(true);
                  const result = await shrinkImage(file);
                  setShrinking(false);
                  // Another photo was chosen meanwhile: that one is being handled by its own call.
                  if (field.files?.[0] !== file) return;
                  if (!result.ok || (result.shrunk && !replaceChosenFile(field, result.file) && file.size > UPLOAD_LIMIT)) {
                    field.value = "";
                    setImageError(result.ok ? "Снимката е твърде голяма за този браузър. Опитай с по-малка (до 3,5 MB)." : result.error);
                    return;
                  }
                  if (result.shrunk && field.files?.[0] !== file) {
                    setImageNote(`Снимката е намалена от ${megabytes(file.size)} на ${megabytes(result.file.size)}, без видима разлика в качеството.`);
                  }
                }}
                className="block w-full text-sm text-ink-soft file:mr-3 file:h-10 file:cursor-pointer file:rounded-full file:border-0 file:bg-sand file:px-4 file:text-sm file:font-semibold file:text-ink hover:file:bg-lime"
                aria-describedby={`${uid}-image-hint`}
              />
              <p id={`${uid}-image-hint`} className="mt-1.5 text-xs text-ink-soft">
                JPG, PNG, WebP или AVIF до {MAX_IMAGE_MB} MB. Сайтът сам я намалява, за да не заема място. Без снимка се показва илюстрацията.
              </p>
              {shrinking && (
                <p role="status" className="mt-1.5 flex items-center gap-2 text-sm text-ink-soft">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Снимката се обработва…
                </p>
              )}
              {imageNote && !shrinking && <p role="status" className="mt-1.5 text-sm font-medium text-forest">{imageNote}</p>}
              {(imageError || errors.image) && <p role="alert" className="mt-1.5 text-sm font-medium text-tomato">{imageError || errors.image}</p>}
              {product?.image && (
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" name="removeImage" className="h-4 w-4 accent-[#33484b]" />
                  Премахни текущата снимка
                </label>
              )}
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div>
                <label htmlFor={`${uid}-pack`} className="mb-1.5 block text-sm font-medium">
                  Илюстрация
                </label>
                <select id={`${uid}-pack`} name="pack" value={pack} onChange={(e) => setPack(e.target.value)} className="field">
                  {Object.entries(PACKS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${uid}-color`} className="mb-1.5 block text-sm font-medium">
                  Цвят
                </label>
                <input id={`${uid}-color`} name="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-12 w-16 cursor-pointer rounded-xl border border-line bg-paper p-1" />
              </div>
            </div>
          </div>
        </fieldset>

        {state?.error && (
          <p role="alert" className="rounded-2xl bg-tomato/10 px-4 py-3 text-sm font-medium text-tomato">
            {state.error}
          </p>
        )}
        <div className="flex gap-3">
          <button type="submit" disabled={pending || shrinking} className={`${btn.primary} flex-1`}>
            {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
            {product ? "Запази промените" : "Създай продукта"}
          </button>
          <Link href={returnUrl || "/admin/produkti"} className={btn.ghost}>
            Отказ
          </Link>
        </div>
      </div>
    </form>
  );
}
