import { cookies } from "next/headers";
import { COOKIE, checkOrigin, digest, json } from "@/lib/auth";
import { database } from "@/lib/store";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const jar = await cookies();
    const token = jar.get(COOKIE)?.value;
    if (token)
      await database()
        .prepare("DELETE FROM sessions WHERE hash=?")
        .bind(await digest(token))
        .run();
    jar.delete(COOKIE);
    return json({ ok: true });
  } catch {
    return json(
      { error: "ログアウトできませんでした。もう一度お試しください。" },
      400,
    );
  }
}
