"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useState, type ReactNode } from "react";
import { saveProduct } from "@/actions/admin";
import { PackShot } from "@/components/product/PackShot";
import { btn } from "@/components/ui";
import type { Brand, Product } from "@/db/schema";
import { MAX_IMAGE_MB, PACKS } from "@/lib/listing";
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
}: {
  product?: Product;
  brands: Brand[];
  categories: CategoryOption[];
}) {
  const [state, action, pending] = useActionState(saveProduct.bind(null, product?.id ?? null), undefined);
  const [pack, setPack] = useState(product?.pack ?? "box");
  const [color, setColor] = useState(product?.color ?? "#1F5C3F");
  const [brandId, setBrandId] = useState(product?.brandId ? String(product.brandId) : "");
  const [newBrand, setNewBrand] = useState("");
  const [imageError, setImageError] = useState("");
  const errors = state?.fieldErrors ?? {};
  const previewLabel = newBrand || brands.find((b) => String(b.id) === brandId)?.name || "Марка";

  const input = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, wide = false) => (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label} {props.required && <span className="text-tomato" aria-hidden>*</span>}
      </label>
      <input id={name} name={name} className="field" aria-invalid={errors[name] ? true : undefined} aria-describedby={errors[name] ? `${name}-error` : undefined} {...props} />
      {errors[name] && (
        <p id={`${name}-error`} role="alert" className="mt-1.5 text-sm font-medium text-tomato">
          {errors[name]}
        </p>
      )}
    </div>
  );

  const check = (name: string, label: string, hint: string, defaultChecked: boolean) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-4 transition has-[:checked]:border-forest has-[:checked]:bg-lime/25">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-5 w-5 accent-[#1f5c3f]" />
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
      <div className="space-y-6">
        <Group title="Основни данни">
          {input("name", "Име на продукта", { required: true, defaultValue: product?.name, maxLength: 160 }, true)}
          {input("sku", "Артикулен №", { required: true, defaultValue: product?.sku, maxLength: 40 })}
          {input("unit", "Разфасовка", { defaultValue: product?.unit, placeholder: "напр. 500 г, 1 л, 10 бр" })}
          <div>
            <label htmlFor="categoryId" className="mb-1.5 block text-sm font-medium">
              Категория <span className="text-tomato" aria-hidden>*</span>
            </label>
            <select id="categoryId" name="categoryId" required defaultValue={product?.categoryId ?? ""} className="field" aria-invalid={errors.categoryId ? true : undefined}>
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
            <label htmlFor="origin" className="mb-1.5 block text-sm font-medium">
              Произход
            </label>
            <select id="origin" name="origin" defaultValue={product?.origin ?? ""} className="field">
              <option value="">Не е посочен</option>
              {Object.entries(ORIGIN_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="brandId" className="mb-1.5 block text-sm font-medium">
              Марка
            </label>
            <select id="brandId" name="brandId" value={brandId} onChange={(e) => setBrandId(e.target.value)} disabled={newBrand !== ""} className="field disabled:opacity-50">
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
            <label htmlFor="newBrand" className="mb-1.5 block text-sm font-medium">
              …или нова марка
            </label>
            <input id="newBrand" name="newBrand" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} maxLength={80} className="field" placeholder="Име на новата марка" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="description" className="mb-1.5 block text-sm font-medium">
              Описание
            </label>
            <textarea id="description" name="description" rows={5} maxLength={4000} defaultValue={product?.description} className="field h-auto py-3" />
          </div>
        </Group>

        <Group title="Цена и наличност">
          {input("price", "Цена (€)", { required: true, inputMode: "decimal", defaultValue: euros(product?.price), placeholder: "0.00" })}
          {input("oldPrice", "Стара цена (€) — за промоция", { inputMode: "decimal", defaultValue: euros(product?.oldPrice), placeholder: "празно = без промо" })}
          {input("bulkMinQty", "Цена за количество — от брой", { inputMode: "numeric", defaultValue: product?.bulkMinQty ?? "", placeholder: "напр. 3" })}
          {input("bulkPrice", "Цена за количество (€/бр)", { inputMode: "decimal", defaultValue: euros(product?.bulkPrice) })}
          {input("stock", "Наличност (бр)", { inputMode: "numeric", defaultValue: product?.stock ?? 100 })}
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
          <div className="clear-both grid place-items-center rounded-2xl p-4" style={{ background: `color-mix(in srgb, ${color} 12%, #f6f2e8)` }}>
            {product?.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin uploads are served as-is
              <img src={product.image} alt="" className="h-44 w-44 object-contain" />
            ) : (
              <PackShot pack={pack} color={color} label={previewLabel} className="h-44 w-40" />
            )}
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="image" className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                <ImagePlus className="h-4 w-4" aria-hidden />
                Снимка на продукта
              </label>
              <input
                id="image"
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(e) => {
                  // Catch oversized photos here: the server would reject the whole request before validation runs.
                  const file = e.currentTarget.files?.[0];
                  if (file && file.size > MAX_IMAGE_MB * 1024 * 1024) {
                    e.currentTarget.value = "";
                    setImageError(`Снимката е ${(file.size / 1024 / 1024).toFixed(1)} MB. Максимумът е ${MAX_IMAGE_MB} MB.`);
                  } else {
                    setImageError("");
                  }
                }}
                className="block w-full text-sm text-ink-soft file:mr-3 file:h-10 file:cursor-pointer file:rounded-full file:border-0 file:bg-sand file:px-4 file:text-sm file:font-semibold file:text-ink hover:file:bg-lime"
                aria-describedby="image-hint"
              />
              <p id="image-hint" className="mt-1.5 text-xs text-ink-soft">
                JPG, PNG, WebP или AVIF до {MAX_IMAGE_MB} MB. Без снимка се показва илюстрацията.
              </p>
              {(imageError || errors.image) && <p role="alert" className="mt-1.5 text-sm font-medium text-tomato">{imageError || errors.image}</p>}
              {product?.image && (
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" name="removeImage" className="h-4 w-4 accent-[#1f5c3f]" />
                  Премахни текущата снимка
                </label>
              )}
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div>
                <label htmlFor="pack" className="mb-1.5 block text-sm font-medium">
                  Илюстрация
                </label>
                <select id="pack" name="pack" value={pack} onChange={(e) => setPack(e.target.value)} className="field">
                  {Object.entries(PACKS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="color" className="mb-1.5 block text-sm font-medium">
                  Цвят
                </label>
                <input id="color" name="color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-12 w-16 cursor-pointer rounded-xl border border-line bg-paper p-1" />
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
          <button type="submit" disabled={pending} className={`${btn.primary} flex-1`}>
            {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
            {product ? "Запази промените" : "Създай продукта"}
          </button>
          <Link href="/admin/produkti" className={btn.ghost}>
            Отказ
          </Link>
        </div>
      </div>
    </form>
  );
}
