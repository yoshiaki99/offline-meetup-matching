import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  propose,
  validRecs,
  currentPair,
  schedule,
  removePerson,
  eligible,
  prune,
  stats,
  type Person,
  type Event,
} from "../lib/model.ts";
function person(id: string, overrides: Partial<Person> = {}): Person {
  return {
    id,
    userId: id,
    username: id,
    name: id,
    current: "AIを使った制作",
    ask: "効率化を話したい",
    offer: "デザイン経験",
    topics: ["AI活用"],
    purposes: ["情報交換"],
    format: "either",
    avoid: "",
    known: "",
    consent: true,
    approved: true,
    present: true,
    consentAt: "2026-09-16",
    updatedAt: "2026-09-16",
    ...overrides,
  };
}
test("一方の除外申告と未承認を両方向で尊重する", () => {
  const a = person("a", { avoid: "@b" }),
    b = person("b");
  assert.equal(eligible(a, b), false);
  assert.equal(eligible(b, a), false);
  assert.equal(eligible(person("a", { approved: false }), b), false);
});
test("30人の候補数・偏り・重複を制限し、再生成も重複しない", () => {
  const s = emptyState();
  s.people = Array.from({ length: 30 }, (_, i) => person("p" + i));
  propose(s);
  validRecs(s);
  for (const p of s.people) {
    assert.ok(s.recs.filter((r) => r.from === p.id).length <= 2);
    assert.ok(s.recs.filter((r) => r.to === p.id).length <= 4);
  }
  const count = s.recs.length;
  propose(s);
  assert.equal(s.recs.length, count);
});
test("片方だけの希望や未公開の紹介では成立せず、双方希望で予定を作る", () => {
  const s = emptyState();
  s.people = [person("a"), person("b")];
  propose(s);
  s.recs[0].answer = "yes";
  assert.equal(currentPair(s, "a", "b"), false);
  s.recs.forEach((r) => {
    r.answer = "yes";
    r.published = true;
  });
  assert.equal(currentPair(s, "a", "b"), true);
  assert.equal(schedule(s), 1);
  assert.equal(schedule(s), 0);
  assert.equal(stats(s).confirmedTalks, 0);
  s.recs.forEach((r) => (r.talked = "yes"));
  assert.equal(stats(s).confirmedTalks, 1);
});
test("小グループ希望者は自動で1対1に割り当てない", () => {
  const s = emptyState();
  s.people = [person("a", { format: "group" }), person("b")];
  propose(s);
  s.recs.forEach((r) => {
    r.answer = "yes";
    r.published = true;
  });
  assert.equal(schedule(s), 0);
});
test("辞退で相手側の紹介、予定、振り返りも取り除く", () => {
  const s = emptyState();
  s.people = [person("a"), person("b")];
  propose(s);
  s.recs.forEach((r) => {
    r.answer = "yes";
    r.published = true;
  });
  schedule(s);
  s.feedback.a = { helpful: 5, newConnection: 5, again: 5, comment: "test" };
  removePerson(s, "a");
  assert.equal(s.recs.length, 0);
  assert.equal(s.meetings.length, 0);
  assert.equal(Object.keys(s.feedback).length, 0);
});
test("期限後はプロフィール・紹介・予定・振り返りを残さない", () => {
  const s = emptyState();
  s.people = [person("a"), person("b")];
  propose(s);
  s.event = { expiresAt: "2000-01-01", open: true } as Event;
  prune(s);
  assert.equal(s.people.length, 0);
  assert.equal(s.recs.length, 0);
  assert.equal(s.event!.open, false);
});
