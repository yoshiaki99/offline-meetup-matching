import { cookies } from "next/headers";
import { database, runtime } from "./store";
import type { User } from "./model";
export const COOKIE = "meetup_session";
export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
export async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await database()
    .prepare("SELECT user_json FROM sessions WHERE hash=? AND expires>?")
    .bind(await digest(token), Date.now())
    .first<{ user_json: string }>();
  return row ? JSON.parse(row.user_json) : null;
}
export function isAdmin(user: User) {
  return (
    runtime("ADMIN_DISCORD_IDS")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .includes(user.id) ||
    (import.meta.env.DEV && user.id === "local-admin")
  );
}
export function origin() {
  const configured = runtime("APP_ORIGIN");
  if (configured) {
    const u = new URL(configured);
    if (u.protocol !== "https:")
      throw Error("APP_ORIGINはHTTPSで設定してください。");
    return u.origin;
  }
  if (import.meta.env.DEV) return "http://localhost:5173";
  throw Error("公開URLの設定が未完了です。");
}
export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== origin())
    throw Error("この操作はサイト内の画面から行ってください。");
}
export function cookieOptions() {
  return {
    httpOnly: true,
    secure: !import.meta.env.DEV,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 7 * 86400,
  };
}
export async function issueSession(user: User) {
  const token = randomToken();
  await database()
    .prepare("INSERT INTO sessions(hash,user_json,expires) VALUES(?,?,?)")
    .bind(await digest(token), JSON.stringify(user), Date.now() + 7 * 86400_000)
    .run();
  (await cookies()).set(COOKIE, token, cookieOptions());
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
