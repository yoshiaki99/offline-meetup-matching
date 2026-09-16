import { cookies } from "next/headers";
import { digest, origin, issueSession } from "@/lib/auth";
import { database, runtime } from "@/lib/store";
export async function GET(request: Request) {
  const base = origin();
  try {
    const url = new URL(request.url);
    const state = url.searchParams.get("state") ?? "";
    const jar = await cookies();
    const saved = jar.get("meetup_oauth")?.value;
    jar.delete("meetup_oauth");
    if (!saved || state !== saved || !/^[a-f0-9]{64}$/.test(state))
      throw Error("state");
    const consumed = await database()
      .prepare(
        "DELETE FROM oauth_states WHERE hash=? AND expires>? RETURNING hash",
      )
      .bind(await digest(state), Date.now())
      .first();
    if (!consumed || url.searchParams.has("error")) throw Error("expired");
    const code = url.searchParams.get("code");
    if (!code || code.length > 2048) throw Error("code");
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: runtime("DISCORD_CLIENT_ID"),
        client_secret: runtime("DISCORD_CLIENT_SECRET"),
        grant_type: "authorization_code",
        code,
        redirect_uri: base + "/api/auth/discord-return",
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error("token");
    const token = (await response.json()) as { access_token?: string };
    if (!token.access_token) throw Error("token");
    const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!userResponse.ok) throw Error("identity");
    const user = (await userResponse.json()) as {
      id: string;
      username: string;
      global_name?: string;
    };
    if (!/^\d{15,22}$/.test(user.id) || typeof user.username !== "string")
      throw Error("identity");
    await issueSession({
      id: user.id,
      username: user.username,
      name: user.global_name || user.username,
    });
    return Response.redirect(base, 303);
  } catch {
    return Response.redirect(base + "/?notice=login-failed", 303);
  }
}
