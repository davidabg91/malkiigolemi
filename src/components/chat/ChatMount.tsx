import { connection } from "next/server";
import { getSession } from "@/lib/auth";
import { pushConfigured, vapidPublicKey } from "@/lib/push";
import { ChatWidget } from "./ChatWidget";

/**
 * Puts the chat button on the shop's pages. Admins do not get it: they answer from the admin panel.
 * Reads the session, so it is rendered behind a Suspense boundary in the layout.
 */
export async function ChatMount() {
  await connection();
  const session = await getSession();
  if (session?.role === "admin") return null;
  return <ChatWidget publicKey={pushConfigured() ? vapidPublicKey() : ""} signedIn={Boolean(session)} />;
}
