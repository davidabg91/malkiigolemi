"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { isCourierId } from "@/lib/couriers";
import { chooseOrderDelivery } from "@/lib/fb-orders";
import { DELIVERY_METHODS } from "@/lib/site";

export type DeliveryChoiceState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | undefined;

const schema = z
  .object({
    delivery: z.enum(DELIVERY_METHODS.map((m) => m.id) as [string, ...string[]]),
    name: z.string().trim().max(80).default(""),
    phone: z.string().trim().max(20).default(""),
    courier: z.string().trim().optional(),
    officeCode: z.string().trim().max(40).optional(),
    city: z.string().trim().max(80).default(""),
    address: z.string().trim().max(200).default(""),
  })
  .superRefine((d, ctx) => {
    // Taking it from the shop needs nothing more; a courier needs to know who and where.
    if (d.delivery === "store") return;
    if (d.name.length < 3) ctx.addIssue({ code: "custom", path: ["name"], message: "Въведете име и фамилия." });
    if (!/^\+?[0-9 ]{8,15}$/.test(d.phone)) ctx.addIssue({ code: "custom", path: ["phone"], message: "Въведете валиден телефон." });
    if (!isCourierId(d.courier)) ctx.addIssue({ code: "custom", path: ["courier"], message: "Изберете куриер." });
    if (d.delivery === "address") {
      if (d.city.length < 2) ctx.addIssue({ code: "custom", path: ["city"], message: "Въведете населено място." });
      if (d.address.length < 3) ctx.addIssue({ code: "custom", path: ["address"], message: "Въведете адрес." });
    } else if (!d.officeCode) {
      ctx.addIssue({ code: "custom", path: ["office"], message: d.delivery === "box" ? "Изберете автомат." : "Изберете офис." });
    }
  });

/**
 * The order's public page (/porachka/<number>): the customer of an order gathered from the Facebook group says
 * whether they take it from the shop or want it sent, and where. Whoever has the link may do this, like the
 * rest of that page; it stops working once the order is on its way.
 */
export async function chooseDelivery(number: string, _prev: DeliveryChoiceState, formData: FormData): Promise<DeliveryChoiceState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { error: "Проверете отбелязаните полета.", fieldErrors };
  }
  const d = parsed.data;
  const result = await chooseOrderDelivery(number, {
    delivery: d.delivery,
    courier: d.delivery === "store" ? null : (d.courier ?? null),
    officeCode: d.officeCode ?? null,
    city: d.city,
    address: d.address,
    name: d.name,
    phone: d.phone,
  });
  if (!result.ok) return { error: result.error, fieldErrors: result.field ? { [result.field]: result.error } : undefined };
  refresh();
  return { ok: true };
}
