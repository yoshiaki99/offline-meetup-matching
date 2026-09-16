import { cookies } from "next/headers";
import { randomToken, digest, origin, cookieOptions, json } from "@/lib/auth";
import { database, runtime, cleanup } from "@/lib/store";
export async function GET() {
  try {
    const id = runtime("DISCORD_CLIENT_ID");
    if (!id || !runtime("DISCORD_CLIENT_SECRET"))
      return Response.redirect(new URL("/?notice=setup", origin()), 303);
    await cleanup();
    const state = randomToken();
    await database()
      .prepare("INSERT INTO oauth_states(hash,expires) VALUES(?,?)")
      .bind(await digest(state), Date.now() + 600_000)
      .run();
    (await cookies()).set("meetup_oauth", state, {
      ...cookieOptions(),
      maxAge: 600,
    });
    const url = new URL("https://discord.com/oauth2/authorize");
    url.search = new URLSearchParams({
      client_id: id,
      response_type: "code",
      scope: "identify",
      redirect_uri: origin() + "/api/auth/discord-return",
      state,
    }).toString();
    return Response.redirect(url, 303);
  } catch {
    return json(
      { error: "ログイン設定を確認しています。運営にお問い合わせください。" },
      503,
    );
  }
}
