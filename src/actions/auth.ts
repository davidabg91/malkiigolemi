"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, safeNext, tooManyAttempts } from "@/lib/auth";

export type FormState = { error?: string; fields?: Record<string, string> } | undefined;

const credentials = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Въведи валиден имейл.")),
  password: z.string().min(1, "Въведи парола."),
});

let dummyHash: string | undefined;

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password } = parsed.data;

  if (tooManyAttempts(`login:${email}`)) {
    return { error: "Твърде много опити. Опитай отново след няколко минути." };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Compare against a dummy hash when the user is missing so timing does not reveal which emails exist.
  dummyHash ??= await bcrypt.hash(crypto.randomUUID(), 10);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
  if (!user || !ok) return { error: "Грешен имейл или парола.", fields: { email } };

  await createSession({ uid: user.id, role: user.role, name: user.name, email: user.email });
  redirect(safeNext(formData.get("next"), user.role === "admin" ? "/admin" : "/profil"));
}

const registration = z.object({
  name: z.string().trim().min(2, "Въведи име и фамилия.").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Въведи валиден имейл.")),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{8,15}$/, "Въведи валиден телефон."),
  password: z.string().min(8, "Паролата трябва да е поне 8 символа.").max(100),
});

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const fields = { name: raw.name, email: raw.email, phone: raw.phone };
  const parsed = registration.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const { name, email, phone, password } = parsed.data;

  if (tooManyAttempts(`register:${email}`, 5)) {
    return { error: "Твърде много опити. Опитай отново след няколко минути.", fields };
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: "Вече има профил с този имейл. Опитай да влезеш.", fields };

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(users).values({ name, email, phone, passwordHash }).returning();
  await createSession({ uid: user.id, role: "customer", name: user.name, email: user.email });
  redirect(safeNext(formData.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}
