import { currentUser, isAdmin, json } from "@/lib/auth";
import { cleanup, readState, runtime } from "@/lib/store";
import { currentPair, personPublic, stats } from "@/lib/model";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await currentUser();
    if (!user)
      return json({
        user: null,
        ready: !!runtime("DISCORD_CLIENT_ID"),
        dev: import.meta.env.DEV,
      });
    await cleanup();
    const s = await readState();
    const admin = isAdmin(user);
    if (admin && new URL(request.url).searchParams.get("admin") === "1")
      return json({
        user,
        admin: true,
        ...s,
        stats: stats(s),
        dev: import.meta.env.DEV,
      });
    const me = s.people.find((p) => p.userId === user.id);
    return json({
      user,
      admin,
      event: s.event,
      me: me ?? null,
      recs:
        me && me.approved
          ? s.recs
              .filter((r) => r.from === me.id && r.published)
              .map((r) => {
                const p = s.people.find((p) => p.id === r.to && p.approved);
                if (!p) return null;
                return {
                  id: r.id,
                  person: personPublic(p),
                  kind: r.kind,
                  reason: r.reason,
                  question: r.question,
                  answer: r.answer,
                  talked: r.talked,
                  mutual: currentPair(s, r.from, r.to),
                };
              })
              .filter(Boolean)
          : [],
      meetings: me
        ? s.meetings
            .filter((m) => m.people.includes(me.id))
            .map((m) => ({
              ...m,
              people: m.people
                .map((id) => {
                  const p = s.people.find((p) => p.id === id);
                  return p ? { id: p.id, name: p.name } : null;
                })
                .filter(Boolean),
            }))
        : [],
      feedback: me ? (s.feedback[me.id] ?? null) : null,
      dev: import.meta.env.DEV,
    });
  } catch {
    return json(
      {
        error: "データを読み込めませんでした。時間をおいて再度お試しください。",
      },
      503,
    );
  }
}
