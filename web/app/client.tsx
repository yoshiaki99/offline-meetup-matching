"use client";
import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import {
  UsersRound,
  MessageCircle,
  ShieldCheck,
  CalendarDays,
  MapPin,
  Check,
  RefreshCw,
  Settings2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  TOPICS,
  PURPOSES,
  type Person,
  type Profile,
  type Event,
  type Rec,
  type User,
  type Feedback,
  type Meeting,
  personPublic,
} from "@/lib/model";
type Intro = Rec & {
  person?: ReturnType<typeof personPublic>;
  mutual?: boolean;
};
type MeetingView = Omit<Meeting, "people"> & {
  people: (string | { id: string; name: string })[];
};
type View = {
  user: User | null;
  admin?: boolean;
  ready?: boolean;
  dev?: boolean;
  event?: Event | null;
  people?: Person[];
  me?: Person | null;
  recs?: Intro[];
  meetings?: MeetingView[];
  feedback?: Feedback | null;
  stats?: Record<string, number>;
};
type Action = (
  body: Record<string, unknown>,
) => Promise<Record<string, unknown> | null>;
const dateLabel = (s: string) =>
  new Date(s).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const formatLabel = { pair: "1対1", group: "小グループ", either: "どちらでも" };
const emptyProfile: Profile = {
  name: "",
  current: "",
  ask: "",
  offer: "",
  topics: [],
  purposes: [],
  format: "either",
  avoid: "",
  known: "",
  consent: true,
};
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function ConfirmButton({
  children,
  title,
  description,
  onConfirm,
  disabled = false,
}: {
  children: ReactNode;
  title: string;
  description: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>戻る</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>実行する</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export default function MeetupApp({
  adminPage = false,
}: {
  adminPage?: boolean;
}) {
  const [view, setView] = useState<View | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const response = await fetch(
      adminPage ? "/api/state?admin=1" : "/api/state",
      { cache: "no-store" },
    );
    const data = (await response.json()) as View & { error?: string };
    if (!response.ok) throw Error(data.error);
    setView(data);
    return data as View;
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context) return;
    const controller = new AbortController();
    const tool = {
      name: "get_meetup_summary",
      title: "現在のオフ会の状態を確認",
      description:
        "ログイン中の本人向けに、イベント名・登録状況・紹介件数・予定件数を確認します。登録や希望回答は変更しません。",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input: unknown) => {
        if (
          !input ||
          typeof input !== "object" ||
          Array.isArray(input) ||
          Object.keys(input).length
        )
          throw Error("入力は空のオブジェクトにしてください。");
        const s = await load();
        return {
          signedIn: !!s.user,
          event: s.event?.name ?? null,
          registered: !!s.me,
          approved: !!s.me?.approved,
          introductions: s.recs?.length ?? 0,
          meetings: s.meetings?.length ?? 0,
        };
      },
    };
    try {
      Promise.resolve(
        context.registerTool(tool, { signal: controller.signal }),
      ).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, []);
  const action: Action = async (body) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as Record<string, unknown>;
      if (!response.ok) throw Error(String(data.error));
      await load();
      setMessage(String(data.message ?? "完了しました。"));
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作できませんでした。");
      return null;
    } finally {
      setBusy(false);
    }
  };
  async function logout() {
    setError("");
    try {
      const r = await fetch("/api/auth/logout", { method: "POST" });
      if (!r.ok) throw Error("ログアウトできませんでした。");
      setView(null);
      await load();
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <main className="shell">
      <header className="topbar">
        <a href="/" className="brand">
          <UsersRound />
          オフ会コネクト
        </a>
        <nav className="nav">
          {view?.user && <span className="muted">{view.user.name}</span>}
          {view?.admin && (
            <a href={adminPage ? "/" : "/admin"}>
              {adminPage ? "参加者画面" : "運営画面"}
            </a>
          )}
          {view?.user && (
            <Button variant="ghost" onClick={logout}>
              ログアウト
            </Button>
          )}
        </nav>
      </header>
      {error && (
        <div className="notice error" role="alert">
          {error}{" "}
          <Button
            variant="outline"
            onClick={() =>
              load()
                .then(() => setError(""))
                .catch((e) => setError(e.message))
            }
          >
            <RefreshCw size={16} />
            再読み込み
          </Button>
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
      {!view && !error && (
        <p className="loading" role="status">
          読み込んでいます…
        </p>
      )}
      {view && !view.user && <Welcome ready={view.ready ?? false} />}
      {view?.user &&
        (adminPage ? (
          view.admin ? (
            <Admin view={view} action={action} busy={busy} />
          ) : (
            <section className="panel section">
              <h1>運営専用の画面です</h1>
              <p>このアカウントには運営権限がありません。</p>
              <p className="muted">DiscordユーザーID：{view.user.id}</p>
              <Button asChild>
                <a href="/">参加者画面へ</a>
              </Button>
            </section>
          )
        ) : (
          <Participant view={view} action={action} busy={busy} />
        ))}
      {view?.dev && (
        <details className="dev">
          <summary>ローカル開発用のテストログイン</summary>
          <p>この操作は公開版では使用できません。</p>
          <div className="actions">
            {["admin", "alice", "bob", "carol", "dave"].map((role) => (
              <Button
                key={role}
                variant="outline"
                onClick={async () => {
                  await fetch("/api/auth/dev", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role }),
                  });
                  await load();
                }}
              >
                {role}
              </Button>
            ))}
          </div>
        </details>
      )}
      <footer>
        <a href="/privacy">情報の取り扱い</a>
        <span>
          紹介は会話のきっかけです。参加・交流はいつでも辞退できます。
        </span>
      </footer>
    </main>
  );
}
function Welcome({ ready }: { ready: boolean }) {
  const [notice, setNotice] = useState("");
  useEffect(
    () => setNotice(new URLSearchParams(location.search).get("notice") ?? ""),
    [],
  );
  return (
    <>
      <div className="workspace">
        <section className="intro">
          <span className="label">MEETUP CONNECT</span>
          <h1>
            次のオフ会で、
            <br />
            話すきっかけを。
          </h1>
          <p>
            今取り組んでいること、聞いてみたいこと。
            <br />
            あなたの関心から、会話が生まれる相手を紹介します。
          </p>
          {ready ? (
            <Button asChild size="lg">
              <a href="/api/auth/discord">
                Discordでログイン <ArrowRight size={18} />
              </a>
            </Button>
          ) : (
            <div className="notice">
              参加受付の準備中です。運営からの案内をお待ちください。
            </div>
          )}
          {notice === "login-failed" && (
            <p role="alert" className="notice error">
              ログインを完了できませんでした。もう一度お試しください。
            </p>
          )}
          {notice === "setup" && (
            <p className="notice">認証設定を準備しています。</p>
          )}
          <p className="muted">
            Discordの投稿やDMは読み取りません。登録前にプロフィールの公開範囲を確認できます。
          </p>
        </section>
        <aside className="panel">
          <div className="panel-icon">
            <MessageCircle />
          </div>
          <h2>参加から当日まで</h2>
          <ol className="steps">
            <li>
              <b>01</b>
              <div>
                <strong>今回の目的を登録</strong>
                <p>話したいテーマと、今の取り組みを教えてください。</p>
              </div>
            </li>
            <li>
              <b>02</b>
              <div>
                <strong>紹介を確認</strong>
                <p>運営が確認した接点と、最初の話題が届きます。</p>
              </div>
            </li>
            <li>
              <b>03</b>
              <div>
                <strong>会場で話す</strong>
                <p>双方が希望したら、集合場所と時間を確認します。</p>
              </div>
            </li>
          </ol>
          <div className="privacy-note">
            <ShieldCheck size={20} />
            <span>
              プロフィールは、紹介された参加者と運営だけが閲覧できます。
            </span>
          </div>
        </aside>
      </div>
    </>
  );
}
function Participant({
  view,
  action,
  busy,
}: {
  view: View;
  action: Action;
  busy: boolean;
}) {
  const e = view.event,
    me = view.me;
  return (
    <div className="section">
      {!e ? (
        <section className="panel">
          <h1>次回のオフ会は準備中です</h1>
          <p>開催案内が届いたら、このページから参加登録できます。</p>
          {view.admin && (
            <Button asChild>
              <a href="/admin">イベントを設定する</a>
            </Button>
          )}
          <p className="muted">DiscordユーザーID：{view.user?.id}</p>
        </section>
      ) : (
        <>
          <EventHeader event={e} />
          {Date.parse(e.expiresAt) <= Date.now() ? (
            <div className="notice">
              このイベントの紹介サービスは終了しました。登録情報は閲覧できません。
            </div>
          ) : (
            <>
              <Tabs
                defaultValue={me ? "introductions" : "profile"}
                key={me?.id ?? "new"}
              >
                <TabsList className="tabbar">
                  <TabsTrigger value="introductions">
                    あなたへの紹介
                  </TabsTrigger>
                  <TabsTrigger value="profile">プロフィール</TabsTrigger>
                  <TabsTrigger value="feedback">振り返り</TabsTrigger>
                </TabsList>
                <TabsContent value="introductions">
                  <div className="section-heading">
                    <div>
                      <h2>今回、話してみると面白そうな人</h2>
                      <p className="muted">
                        希望回答の締切：{dateLabel(e.replyDeadline)}
                      </p>
                    </div>
                  </div>
                  {!me ? (
                    <Empty
                      title="プロフィールを登録しましょう"
                      text="「プロフィール」から今回話したいことを登録すると、運営が参加を確認します。"
                    />
                  ) : !me.approved ? (
                    <Empty
                      title="運営が参加を確認しています"
                      text="参加名簿との照合後、紹介の準備を進めます。"
                    />
                  ) : !view.recs?.length ? (
                    <Empty
                      title="あなたへの紹介を準備中です"
                      text="運営が接点と話題を確認すると、このページに表示されます。条件によって紹介人数は異なります。"
                    />
                  ) : (
                    <div className="cards">
                      {view.recs.map((r) => (
                        <article className="panel intro-card" key={r.id}>
                          <div className="card-top">
                            <span className="pill">{r.kind}</span>
                            {r.mutual && (
                              <span className="pill green">
                                <Check size={14} />
                                双方が希望
                              </span>
                            )}
                          </div>
                          <h2>
                            {r.person?.name}
                            <small>さん</small>
                          </h2>
                          <p>{r.person?.current}</p>
                          <div className="tags">
                            {r.person?.topics.map((t) => (
                              <span key={t}>{t}</span>
                            ))}
                          </div>
                          <h3>おすすめの理由</h3>
                          <p>{r.reason}</p>
                          <div className="question">
                            <MessageCircle size={18} />
                            <div>
                              <strong>最初の話題</strong>
                              <p>{r.question}</p>
                            </div>
                          </div>
                          <div className="actions">
                            <Button
                              disabled={
                                busy || Date.now() > Date.parse(e.replyDeadline)
                              }
                              variant={
                                r.answer === "yes" ? "default" : "outline"
                              }
                              onClick={() =>
                                action({
                                  action: "answer",
                                  id: r.id,
                                  answer: "yes",
                                })
                              }
                            >
                              {r.answer === "yes" && <Check size={16} />}
                              話してみたい
                            </Button>
                            <Button
                              disabled={
                                busy || Date.now() > Date.parse(e.replyDeadline)
                              }
                              variant={
                                r.answer === "no" ? "secondary" : "ghost"
                              }
                              onClick={() =>
                                action({
                                  action: "answer",
                                  id: r.id,
                                  answer: "no",
                                })
                              }
                            >
                              今回は見送る
                            </Button>
                          </div>
                          <p className="muted">
                            {r.mutual
                              ? "双方の希望を確認しました。当日の案内をお待ちください。"
                              : "相手の回答は、双方が希望した場合にだけ表示されます。"}
                          </p>
                          {Date.now() >=
                            Date.parse(e.date + "T00:00:00+09:00") && (
                            <div className="talked">
                              <p>当日、この方と話せましたか？</p>
                              <div className="actions">
                                {(
                                  [
                                    ["yes", "話せた"],
                                    ["no", "話せなかった"],
                                    ["absent", "どちらかが欠席"],
                                  ] as const
                                ).map(([value, label]) => (
                                  <Button
                                    variant={
                                      r.talked === value
                                        ? "secondary"
                                        : "outline"
                                    }
                                    key={value}
                                    disabled={busy}
                                    onClick={() =>
                                      action({
                                        action: "talked",
                                        id: r.id,
                                        talked: value,
                                      })
                                    }
                                  >
                                    {label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                  {!!view.meetings?.length && (
                    <section className="panel section">
                      <h2>当日の紹介予定</h2>
                      {view.meetings.map((m) => (
                        <div className="meeting" key={m.id}>
                          <strong>
                            {m.slot === 1 ? e.slot1 : e.slot2}〜（10分）
                          </strong>
                          <span>{m.place}</span>
                          <span>
                            {m.people
                              .map((p) => (typeof p === "string" ? p : p.name))
                              .join("・")}
                          </span>
                        </div>
                      ))}
                      <p className="muted">
                        欠席・辞退は運営（{e.contact}）へお知らせください。
                      </p>
                    </section>
                  )}
                </TabsContent>
                <TabsContent value="profile">
                  <ProfileForm
                    key={me?.updatedAt ?? "new"}
                    event={e}
                    initial={me ?? null}
                    action={action}
                    busy={busy}
                  />
                  {me && (
                    <div className="section">
                      <ConfirmButton
                        title="登録を削除して辞退しますか？"
                        description="プロフィール、紹介、希望回答、振り返りを削除します。すでに相手が確認した情報は回収できない場合があります。"
                        onConfirm={() => action({ action: "withdraw" })}
                        disabled={busy}
                      >
                        紹介への参加を辞退・データ削除
                      </ConfirmButton>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="feedback">
                  {me ? (
                    <FeedbackForm
                      initial={view.feedback ?? null}
                      action={action}
                      busy={busy}
                      enabled={
                        Date.now() >= Date.parse(e.date + "T00:00:00+09:00")
                      }
                    />
                  ) : (
                    <Empty
                      title="登録後に回答できます"
                      text="開催後、紹介が役立ったかを教えてください。"
                    />
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
          <p className="muted section">
            運営への連絡：{e.contact} ／ データ利用期限：
            {dateLabel(e.expiresAt)}
          </p>
        </>
      )}
    </div>
  );
}
function EventHeader({ event: e }: { event: Event }) {
  return (
    <div className="event-header">
      <div>
        <span className="label">今回のオフ会</span>
        <h1>{e.name}</h1>
        <div className="event-meta">
          <span>
            <CalendarDays size={18} />
            {e.date}
          </span>
          <span>
            <MapPin size={18} />
            {e.venue}
          </span>
        </div>
      </div>
      <span className="pill">
        {e.open && Date.now() < Date.parse(e.deadline)
          ? "参加登録 受付中"
          : "参加登録 締切"}
      </span>
    </div>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <section className="panel empty">
      <MessageCircle />
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}
function ProfileForm({
  event,
  initial,
  action,
  busy,
}: {
  event: Event;
  initial: Person | null;
  action: Action;
  busy: boolean;
}) {
  const [p, setP] = useState<Profile>(
    initial
      ? {
          name: initial.name,
          current: initial.current,
          ask: initial.ask,
          offer: initial.offer,
          topics: initial.topics,
          purposes: initial.purposes,
          format: initial.format,
          avoid: initial.avoid,
          known: initial.known,
          consent: true,
        }
      : { ...emptyProfile },
  );
  const [review, setReview] = useState(false),
    [consent, setConsent] = useState(false);
  const editable = event.open && Date.now() < Date.parse(event.deadline);
  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setP({ ...p, [key]: value });
  }
  return (
    <section className="panel form-panel">
      <h2>
        {review ? "紹介に使う内容を確認" : "今回、どんな話をしたいですか？"}
      </h2>
      <p className="muted">
        {initial
          ? "変更すると紹介が取り消され、運営が改めて確認します。"
          : "入力の目安は3分です。詳しい経験がなくても参加できます。"}
      </p>
      {!editable && (
        <div className="notice">
          登録・修正の受付を終了しています。変更は運営にご相談ください。
        </div>
      )}
      <form
        onSubmit={async (e: FormEvent) => {
          e.preventDefault();
          if (!review) {
            setReview(true);
            return;
          }
          if (!consent) return;
          await action({
            action: "profile",
            profile: p,
            consentVersion: event.consentVersion,
          });
        }}
      >
        {review ? (
          <>
            <dl className="profile-review">
              <dt>名札名</dt>
              <dd>{p.name}</dd>
              <dt>取り組んでいること</dt>
              <dd>{p.current}</dd>
              <dt>話したい・聞きたいこと</dt>
              <dd>{p.ask}</dd>
              <dt>共有できる経験</dt>
              <dd>{p.offer || "未入力"}</dd>
              <dt>興味・目的</dt>
              <dd>
                {p.topics.join("・")} ／ {p.purposes.join("・")}
              </dd>
              <dt>交流形式</dt>
              <dd>{formatLabel[p.format]}</dd>
            </dl>
            <div className="notice">
              上記の内容が紹介相手に表示されます。既知の相手・紹介を避けたい相手は運営だけが確認します。
            </div>
            <Consent event={event} />
            <label className="checkline">
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
              />
              <span>
                内容と公開範囲を確認し、今回の紹介への参加に同意します。
              </span>
            </label>
            <div className="actions">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReview(false)}
              >
                修正する
              </Button>
              <Button type="submit" disabled={!consent || busy || !editable}>
                この内容で登録する
              </Button>
            </div>
          </>
        ) : (
          <>
            <Field label="当日の名札名 *">
              <Input
                value={p.name}
                maxLength={30}
                required
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            {(
              [
                ["current", "現在取り組んでいること *"],
                ["ask", "今回話したい・聞きたいこと *"],
                ["offer", "話せること・共有できる経験"],
              ] as const
            ).map(([key, label]) => (
              <Field
                key={key}
                label={label}
                hint="150文字まで。公開してよい内容だけを入力してください。"
              >
                <Textarea
                  value={p[key]}
                  maxLength={150}
                  required={key !== "offer"}
                  onChange={(e) => set(key, e.target.value)}
                />
              </Field>
            ))}
            <fieldset>
              <legend>興味のあるテーマ *（最大3つ）</legend>
              <div className="choices">
                {TOPICS.map((t) => (
                  <label key={t} className="choice">
                    <Checkbox
                      checked={p.topics.includes(t)}
                      disabled={!p.topics.includes(t) && p.topics.length >= 3}
                      onCheckedChange={(v) =>
                        set(
                          "topics",
                          v
                            ? [...p.topics, t]
                            : p.topics.filter((x) => x !== t),
                        )
                      }
                    />
                    {t}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>今回の交流目的 *</legend>
              <div className="choices">
                {PURPOSES.map((t) => (
                  <label key={t} className="choice">
                    <Checkbox
                      checked={p.purposes.includes(t)}
                      onCheckedChange={(v) =>
                        set(
                          "purposes",
                          v
                            ? [...p.purposes, t]
                            : p.purposes.filter((x) => x !== t),
                        )
                      }
                    />
                    {t}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>希望する交流形式 *</legend>
              <RadioGroup
                value={p.format}
                onValueChange={(v) => set("format", v as Profile["format"])}
                className="choices"
              >
                {Object.entries(formatLabel).map(([value, label]) => (
                  <label key={value} className="choice">
                    <RadioGroupItem value={value} />
                    {label}
                  </label>
                ))}
              </RadioGroup>
            </fieldset>
            <details>
              <summary>運営だけに伝える情報（任意）</summary>
              <Field
                label="すでに十分話したことがある相手"
                hint="Discordのユーザー名をカンマ区切りで入力してください。表示名ではなく @ の後のユーザー名を使います。"
              >
                <Input
                  value={p.known}
                  maxLength={300}
                  onChange={(e) => set("known", e.target.value)}
                />
              </Field>
              <Field
                label="紹介を避けたい相手"
                hint="Discordのユーザー名をカンマ区切りで入力してください。理由は不要で、相手には伝わりません。ユーザー名が不明な場合は運営へ個別にご連絡ください。"
              >
                <Input
                  value={p.avoid}
                  maxLength={300}
                  onChange={(e) => set("avoid", e.target.value)}
                />
              </Field>
            </details>
            <Button
              type="submit"
              disabled={
                busy || !editable || !p.topics.length || !p.purposes.length
              }
            >
              公開される内容を確認 <ArrowRight size={16} />
            </Button>
          </>
        )}
      </form>
    </section>
  );
}
function Consent({ event: e }: { event: Event }) {
  return (
    <div className="consent">
      <h3>情報の利用について</h3>
      <p>
        今回のオフ会で紹介を行うため、運営がプロフィールとDiscordのID・ユーザー名を管理します。公開用プロフィールは、運営が紹介した参加者に表示されます。希望回答は双方が希望した場合だけ相手に伝わります。
      </p>
      <p>
        AIの利用：{e.aiService}。{e.aiDisclosure}
      </p>
      <p>
        登録は任意です。プロフィール画面から辞退・削除できます。データ利用期限は
        {dateLabel(e.expiresAt)}です。運営窓口：{e.contact}。詳しくは
        <a href="/privacy" target="_blank" rel="noreferrer">
          情報の取り扱い
        </a>
        をご確認ください。
      </p>
    </div>
  );
}
function FeedbackForm({
  initial,
  action,
  busy,
  enabled,
}: {
  initial: Feedback | null;
  action: Action;
  busy: boolean;
  enabled: boolean;
}) {
  const [f, setF] = useState<Feedback>(
    initial ?? { helpful: null, newConnection: null, again: 0, comment: "" },
  );
  return (
    <section className="panel form-panel">
      <h2>紹介はいかがでしたか？</h2>
      <p>次回の改善のため、短い振り返りにご協力ください。</p>
      {!enabled && <div className="notice">開催日から回答できます。</div>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          action({ action: "feedback", feedback: f });
        }}
      >
        {(
          [
            ["helpful", "紹介理由や話題は、声をかける助けになった"],
            ["newConnection", "普段なら話さなかった人と話せた"],
            ["again", "次回も使いたい"],
          ] as const
        ).map(([key, label]) => (
          <fieldset key={key}>
            <legend>{label}</legend>
            <small>1：まったくそう思わない〜5：とてもそう思う</small>
            <RadioGroup
              value={f[key] === null ? "na" : String(f[key])}
              onValueChange={(v) =>
                setF({ ...f, [key]: v === "na" ? null : Number(v) })
              }
              className="choices"
            >
              {[
                "1",
                "2",
                "3",
                "4",
                "5",
                ...(key !== "again" ? ["na"] : []),
              ].map((value) => (
                <label className="choice" key={value}>
                  <RadioGroupItem value={value} />
                  {value === "na" ? "該当なし" : value}
                </label>
              ))}
            </RadioGroup>
          </fieldset>
        ))}
        <Field label="改善してほしいこと（任意）">
          <Textarea
            value={f.comment}
            maxLength={500}
            onChange={(e) => setF({ ...f, comment: e.target.value })}
          />
        </Field>
        <Button type="submit" disabled={!enabled || busy || !f.again}>
          振り返りを保存
        </Button>
      </form>
    </section>
  );
}
function Admin({
  view,
  action,
  busy,
}: {
  view: View;
  action: Action;
  busy: boolean;
}) {
  const people = view.people ?? [],
    recs = view.recs ?? [],
    s = view.stats ?? {};
  const name = (id: string) =>
    people.find((p) => p.id === id)?.name ?? "削除済み";
  return (
    <div className="section">
      <div className="section-heading">
        <div>
          <span className="label">運営</span>
          <h1 className="small-title">オフ会の紹介を管理</h1>
        </div>
        <span className="pill">
          <Settings2 size={16} />
          運営専用
        </span>
      </div>
      <div className="metrics">
        {[
          ["登録", s.registered],
          ["参加確認済み", s.approved],
          ["公開した紹介", s.published],
          ["双方が希望", s.mutual],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>
              {value ?? 0}
              <small>{label === "双方が希望" ? "組" : "件"}</small>
            </strong>
          </div>
        ))}
      </div>
      <Tabs defaultValue={view.event ? "people" : "event"}>
        <TabsList className="tabbar admin-tabs">
          <TabsTrigger value="event">開催設定</TabsTrigger>
          <TabsTrigger value="people">参加者</TabsTrigger>
          <TabsTrigger value="recs">紹介の確認</TabsTrigger>
          <TabsTrigger value="meetings">当日の案内</TabsTrigger>
          <TabsTrigger value="results">実験結果</TabsTrigger>
        </TabsList>
        <TabsContent value="event">
          <EventForm initial={view.event ?? null} action={action} busy={busy} />
        </TabsContent>
        <TabsContent value="people">
          <div className="section-heading">
            <h2>参加名簿と照合して承認</h2>
          </div>
          {!people.length ? (
            <Empty
              title="参加登録を待っています"
              text="開催設定を保存して受付を開いたら、参加者へサイトのURLをご案内ください。"
            />
          ) : (
            <div className="cards">
              {people.map((p) => (
                <article className="panel" key={p.id}>
                  <div className="card-top">
                    <h2>{p.name}</h2>
                    <span className="pill">
                      {p.approved ? "確認済み" : "確認待ち"}
                    </span>
                  </div>
                  <p className="muted">
                    @{p.username} ／ {formatLabel[p.format]}
                  </p>
                  <p>{p.current}</p>
                  <h3>今回話したいこと</h3>
                  <p>{p.ask}</p>
                  <h3>話せること</h3>
                  <p>{p.offer || "未入力"}</p>
                  <div className="tags">
                    {p.topics.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  <details>
                    <summary>運営だけの情報</summary>
                    <p>
                      既知：{p.known || "なし"}
                      <br />
                      紹介を避けたい相手：{p.avoid || "なし"}
                    </p>
                    <p className="muted">
                      同意：{dateLabel(p.consentAt)}
                      <br />
                      Discord ID：{p.userId}
                    </p>
                  </details>
                  <div className="actions">
                    <Button
                      disabled={busy}
                      variant={p.approved ? "outline" : "default"}
                      onClick={() =>
                        action({
                          action: "approve",
                          id: p.id,
                          approved: !p.approved,
                        })
                      }
                    >
                      {p.approved
                        ? "承認を取り消す"
                        : "参加名簿との照合済み・承認"}
                    </Button>
                    <Button
                      disabled={busy}
                      variant={p.present ? "secondary" : "outline"}
                      onClick={() =>
                        action({
                          action: "attendance",
                          id: p.id,
                          present: !p.present,
                        })
                      }
                    >
                      {p.present ? "来場済み" : "来場を記録"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="recs">
          <div className="section-heading">
            <div>
              <h2>紹介の下書きを確認</h2>
              <p className="muted">
                共通テーマの候補はルールで作成します。理由・根拠・公開範囲を確認して1件ずつ公開してください。
              </p>
            </div>
            <Button
              disabled={busy || !view.event}
              onClick={() => action({ action: "generate" })}
            >
              共通テーマから下書きを作る
            </Button>
          </div>
          <ManualRec people={people} action={action} busy={busy} />
          <AITransfer action={action} busy={busy} />
          {!recs.length && (
            <Empty
              title="紹介の下書きはまだありません"
              text="参加者を承認し、共通テーマから候補を作成するか、手動で紹介を追加してください。"
            />
          )}
          <div className="cards">
            {recs.map((r) => (
              <RecEditor
                key={r.id + String(r.published)}
                rec={r}
                from={name(r.from)}
                to={name(r.to)}
                action={action}
                busy={busy}
              />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="meetings">
          <div className="section-heading">
            <div>
              <h2>当日の紹介予定</h2>
              <p className="muted">
                10分×2枠。双方が希望した1対1の組に、重複しない時間を割り当てます。
              </p>
            </div>
            <Button
              disabled={busy || !view.event}
              onClick={() => action({ action: "schedule" })}
            >
              双方希望の組を割り当てる
            </Button>
          </div>
          {(view.meetings ?? []).map((m) => (
            <div className="panel meeting" key={m.id}>
              <strong>
                {m.slot === 1 ? view.event?.slot1 : view.event?.slot2}〜
              </strong>
              <span>
                {m.people
                  .map((p) => (typeof p === "string" ? name(p) : p.name))
                  .join("・")}
              </span>
              <span>{m.place}</span>
              <ConfirmButton
                title="この紹介枠を取り消しますか？"
                description="参加者の当日案内からこの予定が削除されます。"
                onConfirm={() => action({ action: "delete-meeting", id: m.id })}
                disabled={busy}
              >
                取り消す
              </ConfirmButton>
            </div>
          ))}
          <GroupMeeting people={people} action={action} busy={busy} />
        </TabsContent>
        <TabsContent value="results">
          <section className="panel">
            <h2>実験の振り返り</h2>
            <p className="muted">
              割合だけでなく分子・分母を確認します。0件の分母は「対象なし」です。
            </p>
            <dl className="result-list">
              {[
                ["希望回答の回収", s.answeredPeople, s.receivedPeople],
                ["話してみたい", s.yes, s.published],
                ["双方が会話を確認した組", s.confirmedTalks, s.presentPairs],
                ["振り返り回答", s.feedback, s.present],
                ["次回も使いたい（4・5）", s.again, s.feedback],
                [
                  "新しい接点があった（4・5）",
                  s.newConnection,
                  s.newConnectionTotal,
                ],
              ].map(([label, n, d]) => (
                <div key={String(label)}>
                  <dt>{label}</dt>
                  <dd>
                    {d
                      ? `${n} / ${d}（${Math.round((Number(n) / Number(d)) * 100)}%）`
                      : "対象なし"}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="muted">
              会話実施率は双方が来場し、紹介が成立した組が対象です。運営の作業時間・実費・自由記述は別途振り返ってください。小グループはペアの数値に含めません。
            </p>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
function EventForm({
  initial,
  action,
  busy,
}: {
  initial: Event | null;
  action: Action;
  busy: boolean;
}) {
  const [open, setOpen] = useState(initial?.open ?? false);
  const localDate = (v: string | undefined) =>
    v ? new Date(Date.parse(v) + 9 * 3600000).toISOString().slice(0, 16) : "";
  return (
    <section className="panel form-panel">
      <h2>開催情報と受付設定</h2>
      <p className="muted">
        時刻は日本時間です。募集前に開催情報と同意条件を確定してください。
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const get = (key: string) => String(form.get(key) || "");
          action({
            action: "event",
            event: {
              name: get("name"),
              date: get("date"),
              venue: get("venue"),
              contact: get("contact"),
              aiService: get("aiService"),
              aiDisclosure: get("aiDisclosure"),
              deadline: new Date(get("deadline") + ":00+09:00").toISOString(),
              replyDeadline: new Date(
                get("replyDeadline") + ":00+09:00",
              ).toISOString(),
              slot1: get("slot1"),
              slot2: get("slot2"),
              capacity: Number(get("capacity")),
              open,
            },
          });
        }}
      >
        <Field label="オフ会名 *">
          <Input
            name="name"
            required
            maxLength={80}
            defaultValue={initial?.name}
          />
        </Field>
        <div className="form-row">
          <Field label="開催日 *">
            <Input
              name="date"
              type="date"
              required
              defaultValue={initial?.date}
            />
          </Field>
          <Field label="定員（2〜50人） *">
            <Input
              name="capacity"
              type="number"
              min={2}
              max={50}
              required
              defaultValue={initial?.capacity ?? 30}
            />
          </Field>
        </div>
        <Field label="会場 *">
          <Input
            name="venue"
            required
            maxLength={150}
            defaultValue={initial?.venue}
          />
        </Field>
        <Field
          label="運営の連絡先 *"
          hint="参加者が連絡できるDiscordユーザー名等を入力してください。"
        >
          <Input
            name="contact"
            required
            maxLength={150}
            defaultValue={initial?.contact}
          />
        </Field>
        <div className="form-row">
          <Field label="登録・修正の締切 *">
            <Input
              name="deadline"
              type="datetime-local"
              required
              defaultValue={localDate(initial?.deadline)}
            />
          </Field>
          <Field label="話してみたいの回答締切 *">
            <Input
              name="replyDeadline"
              type="datetime-local"
              required
              defaultValue={localDate(initial?.replyDeadline)}
            />
          </Field>
        </div>
        <div className="form-row">
          <Field label="紹介1枠目 *">
            <Input
              name="slot1"
              type="time"
              required
              defaultValue={initial?.slot1 ?? "18:30"}
            />
          </Field>
          <Field label="紹介2枠目 *">
            <Input
              name="slot2"
              type="time"
              required
              defaultValue={initial?.slot2 ?? "18:45"}
            />
          </Field>
        </div>
        <Field
          label="紹介に使用するAIサービス *"
          hint="APIの自動接続はありません。外部AIで下書きを作る場合はサービスと利用条件を募集前に指定してください。"
        >
          <Input
            name="aiService"
            required
            maxLength={100}
            defaultValue={initial?.aiService ?? "未使用"}
          />
        </Field>
        <Field label="AIに渡す情報・保存条件の説明 *">
          <Textarea
            name="aiDisclosure"
            required
            maxLength={1000}
            defaultValue={
              initial?.aiDisclosure ??
              "このイベントでは外部AIへ情報を送信しません。共通テーマによる候補作成と、運営による紹介を行います。"
            }
          />
        </Field>
        <label className="checkline">
          <Checkbox
            checked={open}
            onCheckedChange={(v) => setOpen(v === true)}
          />
          <span>参加登録を受け付ける</span>
        </label>
        <Button disabled={busy} type="submit">
          開催設定を保存
        </Button>
      </form>
    </section>
  );
}
function RecEditor({
  rec: r,
  from,
  to,
  action,
  busy,
}: {
  rec: Intro;
  from: string;
  to: string;
  action: Action;
  busy: boolean;
}) {
  const [reason, setReason] = useState(r.reason),
    [question, setQuestion] = useState(r.question),
    [evidence, setEvidence] = useState(r.evidence);
  const changed =
    reason !== r.reason || question !== r.question || evidence !== r.evidence;
  return (
    <article className="panel">
      <div className="card-top">
        <span className="pill">{r.published ? "公開済み" : "確認待ち"}</span>
        <span className="muted">
          {r.source === "rules"
            ? "共通テーマから作成"
            : r.source === "ai-import"
              ? "AI出力を取込"
              : "運営が作成"}
        </span>
      </div>
      <h2>
        {from} → {to}
      </h2>
      {r.published ? (
        <>
          <h3>おすすめの理由</h3>
          <p>{r.reason}</p>
          <h3>最初の話題</h3>
          <p>{r.question}</p>
          <p className="muted">
            希望回答：
            {r.answer === "yes"
              ? "話してみたい"
              : r.answer === "no"
                ? "見送り"
                : "未回答"}
          </p>
        </>
      ) : (
        <>
          <Field label="おすすめの理由">
            <Textarea
              value={reason}
              maxLength={700}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Field label="最初の話題">
            <Textarea
              value={question}
              maxLength={700}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </Field>
          <Field label="根拠（運営のみ）">
            <Textarea
              value={evidence}
              maxLength={700}
              onChange={(e) => setEvidence(e.target.value)}
            />
          </Field>
          <div className="actions">
            <Button
              disabled={busy || !changed}
              variant="outline"
              onClick={() =>
                action({
                  action: "save-rec",
                  id: r.id,
                  rec: {
                    from: r.from,
                    to: r.to,
                    kind: r.kind,
                    reason,
                    question,
                    evidence,
                  },
                })
              }
            >
              修正を保存
            </Button>
            <Button
              disabled={busy || changed}
              onClick={() => action({ action: "publish", id: r.id })}
            >
              内容・根拠を確認済み・公開
            </Button>
          </div>
        </>
      )}
      <ConfirmButton
        title="この紹介を取り消しますか？"
        description="公開済みの場合は本人のページから紹介が消え、関連する当日予定も取り消されます。"
        onConfirm={() => action({ action: "delete-rec", id: r.id })}
        disabled={busy}
      >
        紹介を取り消す
      </ConfirmButton>
    </article>
  );
}
function PersonChoice({
  people,
  value,
  onChange,
  label,
}: {
  people: Person[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <RadioGroup value={value} onValueChange={onChange} className="choices">
        {people
          .filter((p) => p.approved)
          .map((p) => (
            <label className="choice" key={p.id}>
              <RadioGroupItem value={p.id} />
              {p.name}
            </label>
          ))}
      </RadioGroup>
    </fieldset>
  );
}
function ManualRec({
  people,
  action,
  busy,
}: {
  people: Person[];
  action: Action;
  busy: boolean;
}) {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [kind, setKind] = useState("共通の話題");
  return (
    <details className="panel section">
      <summary>紹介を手動で追加する</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          action({
            action: "save-rec",
            rec: {
              from,
              to,
              kind,
              reason: form.get("reason"),
              question: form.get("question"),
              evidence: form.get("evidence"),
            },
          });
        }}
      >
        <PersonChoice
          people={people}
          value={from}
          onChange={setFrom}
          label="紹介を受け取る人"
        />
        <PersonChoice
          people={people.filter((p) => p.id !== from)}
          value={to}
          onChange={setTo}
          label="おすすめする相手"
        />
        <RadioGroup value={kind} onValueChange={setKind} className="choices">
          {["共通の話題", "経験の交換", "新しい視点"].map((value) => (
            <label className="choice" key={value}>
              <RadioGroupItem value={value} />
              {value}
            </label>
          ))}
        </RadioGroup>
        <Field label="おすすめの理由">
          <Textarea name="reason" required maxLength={700} />
        </Field>
        <Field label="最初の話題">
          <Textarea name="question" required maxLength={700} />
        </Field>
        <Field label="根拠（運営のみ）">
          <Textarea name="evidence" required maxLength={700} />
        </Field>
        <Button disabled={busy || !from || !to || from === to}>
          下書きを追加
        </Button>
      </form>
    </details>
  );
}
function AITransfer({ action, busy }: { action: Action; busy: boolean }) {
  const [output, setOutput] = useState(""),
    [input, setInput] = useState(""),
    [error, setError] = useState("");
  return (
    <details className="panel section">
      <summary>外部AIで作った紹介を取り込む</summary>
      <p>
        募集時に明示したAIサービスだけを使ってください。非公開の除外情報とDiscordアカウント情報は出力に含みません。氏名等が本文に含まれることがあるため、出力内容も確認してください。
      </p>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          const result = await action({ action: "ai-export" });
          if (result)
            setOutput(
              JSON.stringify(
                { prompt: result.prompt, profiles: result.profiles },
                null,
                2,
              ),
            );
        }}
      >
        AI用の指示と公開用プロフィールを表示
      </Button>
      {output && (
        <Field label="外部AIへ渡す内容">
          <Textarea value={output} readOnly rows={8} />
        </Field>
      )}
      <Field label="AIから返されたJSON配列">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={6}
          maxLength={80000}
        />
      </Field>
      {error && <p role="alert">{error}</p>}
      <Button
        disabled={busy || !input}
        onClick={() => {
          try {
            const recs = JSON.parse(input);
            setError("");
            action({ action: "ai-import", recs });
          } catch {
            setError("JSONを読み取れません。配列の形式を確認してください。");
          }
        }}
      >
        下書きとして取り込む
      </Button>
    </details>
  );
}
function GroupMeeting({
  people,
  action,
  busy,
}: {
  people: Person[];
  action: Action;
  busy: boolean;
}) {
  const [ids, setIds] = useState<string[]>([]),
    [slot, setSlot] = useState("1"),
    [confirmed, setConfirmed] = useState(false);
  return (
    <details className="panel section">
      <summary>本人確認済みの小グループを手動で追加</summary>
      <p>
        参加者全員に、形式・メンバー・時間の希望を別途確認してください。小グループ可の方を3〜4人選びます。
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          action({
            action: "meeting",
            meeting: {
              people: ids,
              slot: Number(slot),
              place: data.get("place"),
              confirmed,
            },
          });
        }}
      >
        <div className="choices">
          {people
            .filter((p) => p.approved && p.format !== "pair")
            .map((p) => (
              <label className="choice" key={p.id}>
                <Checkbox
                  checked={ids.includes(p.id)}
                  disabled={!ids.includes(p.id) && ids.length >= 4}
                  onCheckedChange={(v) =>
                    setIds(v ? [...ids, p.id] : ids.filter((id) => id !== p.id))
                  }
                />
                {p.name}
              </label>
            ))}
        </div>
        <RadioGroup value={slot} onValueChange={setSlot} className="choices">
          {["1", "2"].map((v) => (
            <label className="choice" key={v}>
              <RadioGroupItem value={v} />
              {v}枠目
            </label>
          ))}
        </RadioGroup>
        <Field label="集合場所">
          <Input name="place" required maxLength={80} />
        </Field>
        <label className="checkline">
          <Checkbox
            checked={confirmed}
            onCheckedChange={(v) => setConfirmed(v === true)}
          />
          <span>
            全員に形式・メンバー・時間を伝え、参加希望を確認しました。
          </span>
        </label>
        <Button disabled={busy || !confirmed || ids.length < 3}>
          小グループの案内を保存
        </Button>
      </form>
    </details>
  );
}
