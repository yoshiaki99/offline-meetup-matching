import assert from "node:assert/strict";
const origin = "http://localhost:5173";
const sessions = {};
async function req(path, { role, body, method, originHeader = origin } = {}) {
  const response = await fetch(origin + path, {
    method: method ?? (body ? "POST" : "GET"),
    headers: {
      ...(body
        ? { "Content-Type": "application/json", Origin: originHeader }
        : {}),
      ...(role && sessions[role] ? { Cookie: sessions[role] } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.text();
  let data;
  try {
    data = JSON.parse(payload);
  } catch {
    data = { error: payload };
  }
  return { response, data };
}
async function login(role) {
  const { response } = await req("/api/auth/dev", { body: { role } });
  assert.equal(response.status, 200);
  sessions[role] = response.headers.get("set-cookie").split(";")[0];
}
async function action(role, body, expected = 200) {
  const r = await req("/api/action", { role, body });
  assert.equal(r.response.status, expected, JSON.stringify(r.data));
  return r.data;
}
const anonymous = await req("/api/state");
assert.equal(anonymous.data.user, null);
await login("admin");
const before = (await req("/api/state?admin=1", { role: "admin" })).data;
assert.ok(
  before.people.every((p) =>
    ["local-alice", "local-bob", "local-carol"].includes(p.userId),
  ),
  "Refusing to modify non-test participants.",
);
for (const p of before.people) {
  const role = p.userId.replace("local-", "");
  await login(role);
  await action(role, { action: "withdraw" });
}
const now = Date.now(),
  date = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
const end = Date.parse(date + "T23:59:59+09:00");
const event = {
  name: "ローカル検証用オフ会",
  date,
  venue: "テスト会場",
  contact: "@test_admin",
  aiService: "未使用",
  aiDisclosure: "外部AIへ送信しません。",
  deadline: new Date(Math.min(now + 3600000, end - 120000)).toISOString(),
  replyDeadline: new Date(Math.min(now + 7200000, end - 60000)).toISOString(),
  slot1: "18:30",
  slot2: "18:45",
  capacity: 30,
  open: true,
};
await action("admin", { action: "event", event });
for (const role of ["alice", "bob", "carol"]) {
  await login(role);
  await action(role, { action: "event", event }, 403);
  await action(role, {
    action: "profile",
    consentVersion: "2026-09-v1",
    profile: {
      name: role,
      current: "AIを使ったデザイン制作",
      ask: "効率化の方法を話したい",
      offer: "制作経験",
      topics: ["AI活用"],
      purposes: ["情報交換"],
      format: "either",
      avoid: role === "alice" ? "test_bob" : "",
      known: "",
      consent: true,
    },
  });
}
let admin = (await req("/api/state?admin=1", { role: "admin" })).data;
const people = Object.fromEntries(
  admin.people.map((p) => [p.username.replace("test_", ""), p]),
);
for (const p of admin.people)
  await action("admin", { action: "approve", id: p.id, approved: true });
await Promise.all([
  action("admin", { action: "generate" }),
  action("admin", { action: "generate" }),
]);
admin = (await req("/api/state?admin=1", { role: "admin" })).data;
assert.equal(admin.recs.length, 4);
assert.equal(
  admin.recs.some(
    (r) =>
      [r.from, r.to].includes(people.alice.id) &&
      [r.from, r.to].includes(people.bob.id),
  ),
  false,
);
const aliceBefore = (await req("/api/state", { role: "alice" })).data;
assert.equal(aliceBefore.recs.length, 0);
assert.equal(aliceBefore.people, undefined);
await action("alice", { action: "generate" }, 403);
const csrf = await req("/api/action", {
  role: "admin",
  body: { action: "generate" },
  originHeader: "https://untrusted.invalid",
});
assert.ok([400, 403].includes(csrf.response.status));
for (const rec of admin.recs)
  await action("admin", { action: "publish", id: rec.id });
let alice = (await req("/api/state", { role: "alice" })).data;
assert.equal(alice.recs.length, 1);
assert.equal(alice.recs[0].person.avoid, undefined);
assert.equal(alice.recs[0].person.userId, undefined);
assert.equal(alice.recs[0].evidence, undefined);
assert.equal(alice.recs[0].mutual, false);
const bobRec = admin.recs.find((r) => r.from === people.bob.id);
await action("alice", { action: "answer", id: bobRec.id, answer: "yes" }, 400);
for (const r of admin.recs) {
  const role = Object.keys(people).find((k) => people[k].id === r.from);
  await action(role, { action: "answer", id: r.id, answer: "yes" });
}
await action("admin", { action: "schedule" });
admin = (await req("/api/state?admin=1", { role: "admin" })).data;
assert.equal(admin.meetings.length, 2);
assert.notEqual(admin.meetings[0].slot, admin.meetings[1].slot);
alice = (await req("/api/state", { role: "alice" })).data;
assert.equal(alice.recs[0].mutual, true);
assert.equal(alice.meetings.length, 1);
await action("alice", { action: "answer", id: alice.recs[0].id, answer: "no" });
alice = (await req("/api/state", { role: "alice" })).data;
assert.equal(alice.meetings.length, 0);
assert.equal(alice.recs[0].mutual, false);
await action("alice", {
  action: "feedback",
  feedback: { helpful: 4, newConnection: 5, again: 5, comment: "検証用" },
});
await action("alice", { action: "withdraw" });
admin = (await req("/api/state?admin=1", { role: "admin" })).data;
assert.equal(admin.recs.length, 2);
assert.equal(admin.people.length, 2);
assert.equal(admin.feedback[people.alice.id], undefined);
await action("admin", { action: "ai-export" }, 400);
for (const role of ["bob", "carol"]) await action(role, { action: "withdraw" });
await action("admin", { action: "event", event: { ...event, open: false } });
console.log(
  "PASS: identity, admin authorization, CSRF, consent, exclusion, concurrent generation, private drafts, per-user visibility, mutual agreement, schedule conflicts, decline, feedback, withdrawal, AI export guard.",
);
