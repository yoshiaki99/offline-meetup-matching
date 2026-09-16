import { z } from "zod";
export const TOPICS = [
  "AI活用",
  "プログラミング",
  "デザイン",
  "マーケティング",
  "動画・写真",
  "文章・発信",
  "事業づくり",
  "業務改善",
  "学習・教育",
  "趣味・雑談",
] as const;
export const PURPOSES = [
  "気軽な雑談",
  "情報交換",
  "相談したい",
  "共同企画",
] as const;
export const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(30),
    current: z.string().trim().min(1).max(150),
    ask: z.string().trim().min(1).max(150),
    offer: z.string().trim().max(150),
    topics: z.array(z.enum(TOPICS)).min(1).max(3),
    purposes: z.array(z.enum(PURPOSES)).min(1).max(4),
    format: z.enum(["pair", "group", "either"]),
    avoid: z.string().trim().max(300),
    known: z.string().trim().max(300),
    consent: z.literal(true),
  })
  .strict();
export type Profile = z.infer<typeof profileSchema>;
export type User = { id: string; username: string; name: string };
export type Person = Profile & {
  id: string;
  userId: string;
  username: string;
  approved: boolean;
  present: boolean;
  consentAt: string;
  updatedAt: string;
};
export const eventSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    venue: z.string().trim().min(1).max(150),
    contact: z.string().trim().min(1).max(150),
    aiService: z.string().trim().min(1).max(100),
    aiDisclosure: z.string().trim().min(1).max(1000),
    deadline: z.string().datetime(),
    replyDeadline: z.string().datetime(),
    slot1: z.string().regex(/^\d{2}:\d{2}$/),
    slot2: z.string().regex(/^\d{2}:\d{2}$/),
    capacity: z.number().int().min(2).max(50),
    open: z.boolean(),
  })
  .strict();
export type Event = z.infer<typeof eventSchema> & {
  id: string;
  expiresAt: string;
  consentVersion: string;
};
export type Rec = {
  id: string;
  from: string;
  to: string;
  kind: "共通の話題" | "経験の交換" | "新しい視点";
  reason: string;
  question: string;
  evidence: string;
  source: "rules" | "manual" | "ai-import";
  published: boolean;
  answer: "yes" | "no" | null;
  createdAt: string;
  publishedAt: string | null;
  reviewedBy: string | null;
  talked: "yes" | "no" | "absent" | null;
};
export type Meeting = {
  id: string;
  people: string[];
  slot: 1 | 2;
  place: string;
};
export type Feedback = {
  helpful: number | null;
  newConnection: number | null;
  again: number;
  comment: string;
};
export type State = {
  event: Event | null;
  people: Person[];
  recs: Rec[];
  meetings: Meeting[];
  feedback: Record<string, Feedback>;
  revision?: number;
};
export const emptyState = (): State => ({
  event: null,
  people: [],
  recs: [],
  meetings: [],
  feedback: {},
});
export const now = () => new Date().toISOString();
export const personPublic = (p: Person) => ({
  id: p.id,
  name: p.name,
  current: p.current,
  ask: p.ask,
  offer: p.offer,
  topics: p.topics,
  purposes: p.purposes,
  format: p.format,
});
export function names(value: string) {
  return value
    .split(/[\s,、]+/)
    .map((s) => s.replace(/^@/, "").toLowerCase())
    .filter(Boolean);
}
export function eligible(a: Person, b: Person) {
  return (
    a.id !== b.id &&
    a.approved &&
    b.approved &&
    !names(a.avoid).includes(b.username.toLowerCase()) &&
    !names(b.avoid).includes(a.username.toLowerCase())
  );
}
export function invalidate(s: State, id: string) {
  s.recs = s.recs.filter((r) => r.from !== id && r.to !== id);
  s.meetings = s.meetings.filter((m) => !m.people.includes(id));
  delete s.feedback[id];
}
export function removePerson(s: State, id: string) {
  invalidate(s, id);
  s.people = s.people.filter((p) => p.id !== id);
}
export function currentPair(s: State, a: string, b: string) {
  const x = s.recs.find(
    (r) => r.from === a && r.to === b && r.published && r.answer === "yes",
  );
  const y = s.recs.find(
    (r) => r.from === b && r.to === a && r.published && r.answer === "yes",
  );
  return !!(x && y);
}
export function prune(s: State) {
  if (s.event && Date.parse(s.event.expiresAt) <= Date.now()) {
    s.people = [];
    s.recs = [];
    s.meetings = [];
    s.feedback = {};
    s.event.open = false;
  }
  return s;
}
export function validRecs(s: State) {
  const outs = new Map<string, number>(),
    ins = new Map<string, number>(),
    pairs = new Set<string>();
  for (const r of s.recs) {
    const a = s.people.find((p) => p.id === r.from),
      b = s.people.find((p) => p.id === r.to);
    if (!a || !b || !eligible(a, b))
      throw Error("参加確認・除外条件を満たさない紹介があります。");
    const key = r.from + ":" + r.to;
    if (pairs.has(key)) throw Error("同じ相手への紹介が重複しています。");
    pairs.add(key);
    outs.set(r.from, (outs.get(r.from) || 0) + 1);
    ins.set(r.to, (ins.get(r.to) || 0) + 1);
    if (outs.get(r.from)! > 3 || ins.get(r.to)! > 4)
      throw Error("推薦数の上限（1人に3人、登場4回）を超えています。");
  }
}
export function propose(s: State) {
  const pairs: { a: Person; b: Person; common: string[]; score: number }[] = [];
  for (let i = 0; i < s.people.length; i++)
    for (let j = i + 1; j < s.people.length; j++) {
      const a = s.people[i],
        b = s.people[j];
      if (!eligible(a, b)) continue;
      const common = a.topics.filter((t) => b.topics.includes(t));
      const purpose = a.purposes.some((p) => b.purposes.includes(p));
      if (!common.length || !purpose) continue;
      const known =
        names(a.known).includes(b.username.toLowerCase()) ||
        names(b.known).includes(a.username.toLowerCase());
      pairs.push({
        a,
        b,
        common,
        score: common.length * 10 - (known ? 15 : 0),
      });
    }
  pairs.sort(
    (a, b) =>
      b.score - a.score ||
      a.a.id.localeCompare(b.a.id) ||
      a.b.id.localeCompare(b.b.id),
  );
  const degree = new Map<string, number>();
  for (const r of s.recs) degree.set(r.from, (degree.get(r.from) || 0) + 1);
  let count = 0;
  for (const { a, b, common } of pairs) {
    if (
      (degree.get(a.id) || 0) >= 2 ||
      (degree.get(b.id) || 0) >= 2 ||
      s.recs.some(
        (r) =>
          (r.from === a.id && r.to === b.id) ||
          (r.from === b.id && r.to === a.id),
      )
    )
      continue;
    for (const [from, to] of [
      [a, b],
      [b, a],
    ])
      s.recs.push({
        id: crypto.randomUUID(),
        from: from.id,
        to: to.id,
        kind: "共通の話題",
        reason: `お二人とも「${common.join("・")}」に関心があります。${to.name}さんの「${to.current}」を入口に、今回のテーマを話してみませんか。`,
        question: `「${common[0]}」について、最近取り組んでいることを教えてもらえますか？`,
        evidence: `共通テーマ：${common.join("・")}。相手の取り組み：${to.current}`,
        source: "rules",
        published: false,
        answer: null,
        createdAt: now(),
        publishedAt: null,
        reviewedBy: null,
        talked: null,
      });
    degree.set(a.id, (degree.get(a.id) || 0) + 1);
    degree.set(b.id, (degree.get(b.id) || 0) + 1);
    count += 2;
  }
  validRecs(s);
  return count;
}
export function mutualPairs(s: State) {
  return s.recs
    .filter((r) => r.from < r.to && currentPair(s, r.from, r.to))
    .map((r) => [r.from, r.to]);
}
export function schedule(s: State) {
  s.meetings = s.meetings.filter(
    (m) =>
      m.people.every((id) => s.people.some((p) => p.id === id && p.approved)) &&
      (m.people.length !== 2 || currentPair(s, m.people[0], m.people[1])),
  );
  let count = 0;
  const pairs = mutualPairs(s);
  pairs.sort(
    (a, b) =>
      s.meetings.filter((m) => m.people.some((id) => a.includes(id))).length -
      s.meetings.filter((m) => m.people.some((id) => b.includes(id))).length,
  );
  for (const people of pairs) {
    if (
      s.meetings.some(
        (m) =>
          m.people.length === 2 && m.people.every((id) => people.includes(id)),
      )
    )
      continue;
    if (
      people.some((id) => s.people.find((p) => p.id === id)?.format === "group")
    )
      continue;
    for (const slot of [1, 2] as const) {
      if (
        s.meetings.some(
          (m) => m.slot === slot && m.people.some((id) => people.includes(id)),
        )
      )
        continue;
      const n = s.meetings.filter((m) => m.slot === slot).length + 1;
      s.meetings.push({
        id: crypto.randomUUID(),
        people,
        slot,
        place: `交流テーブル ${n}`,
      });
      count++;
      break;
    }
  }
  return count;
}
export function stats(s: State) {
  const published = s.recs.filter((r) => r.published),
    pairs = mutualPairs(s),
    presentPairs = pairs.filter((ids) =>
      ids.every((id) => s.people.some((p) => p.id === id && p.present)),
    ),
    confirmed = presentPairs.filter((ids) =>
      s.recs
        .filter(
          (r) => ids.includes(r.from) && ids.includes(r.to) && r.published,
        )
        .every((r) => r.talked === "yes"),
    );
  const feedback = Object.values(s.feedback);
  return {
    registered: s.people.length,
    approved: s.people.filter((p) => p.approved).length,
    published: published.length,
    yes: published.filter((r) => r.answer === "yes").length,
    answeredPeople: new Set(
      published.filter((r) => r.answer).map((r) => r.from),
    ).size,
    receivedPeople: new Set(published.map((r) => r.from)).size,
    mutual: pairs.length,
    presentPairs: presentPairs.length,
    confirmedTalks: confirmed.length,
    feedback: feedback.length,
    present: s.people.filter((p) => p.present).length,
    again: feedback.filter((f) => f.again >= 4).length,
    newConnection: feedback.filter(
      (f) => f.newConnection !== null && f.newConnection >= 4,
    ).length,
    newConnectionTotal: feedback.filter((f) => f.newConnection !== null).length,
  };
}
