import { issueSession, json, checkOrigin } from "@/lib/auth";
export async function POST(request: Request) {
  if (!import.meta.env.DEV) return new Response("Not found", { status: 404 });
  try {
    checkOrigin(request);
    const { role } = (await request.json()) as { role: string };
    if (!["admin", "alice", "bob", "carol", "dave"].includes(role))
      return json({ error: "Unknown test user" }, 400);
    await issueSession({
      id: `local-${role}`,
      username: `test_${role}`,
      name: role === "admin" ? "テスト運営" : `テスト ${role}`,
    });
    return json({ ok: true });
  } catch {
    return json({ error: "テストログインに失敗しました" }, 400);
  }
}
