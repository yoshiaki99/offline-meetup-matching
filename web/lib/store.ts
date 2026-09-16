import { env } from "cloudflare:workers";
import { emptyState, prune, type State } from "./model";
export function database() {
  if (!env.DB)
    throw Error(
      "保存先の接続を準備しています。時間をおいて再度お試しください。",
    );
  return env.DB;
}
export function runtime(key: string) {
  return String((env as unknown as Record<string, unknown>)[key] ?? "");
}
export async function readState(): Promise<State> {
  const row = await database()
    .prepare("SELECT data,revision FROM app_state WHERE id=?")
    .bind("meetup")
    .first<{ data: string; revision: number }>();
  return row
    ? { ...prune(JSON.parse(row.data)), revision: row.revision }
    : emptyState();
}
export async function changeState<T>(fn: (s: State) => T): Promise<T> {
  const db = database();
  await db
    .prepare("INSERT OR IGNORE INTO app_state(id,data,revision) VALUES(?,?,0)")
    .bind("meetup", JSON.stringify(emptyState()))
    .run();
  for (let attempt = 0; attempt < 6; attempt++) {
    const s = await readState();
    const revision = s.revision ?? 0;
    delete s.revision;
    const result = fn(s);
    const update = await db
      .prepare(
        "UPDATE app_state SET data=?,revision=revision+1 WHERE id=? AND revision=?",
      )
      .bind(JSON.stringify(s), "meetup", revision)
      .run();
    if (update.meta.changes === 1) return result;
  }
  throw Error("他の更新と重なりました。もう一度お試しください。");
}
export async function cleanup() {
  const db = database();
  const time = Date.now();
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires<=?").bind(time),
    db.prepare("DELETE FROM oauth_states WHERE expires<=?").bind(time),
  ]);
  const s = await readState();
  if (s.event && Date.parse(s.event.expiresAt) <= time)
    await changeState(() => undefined);
}
