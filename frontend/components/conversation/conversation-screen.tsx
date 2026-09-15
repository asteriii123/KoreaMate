"use client";

import {
  JobEventSchema,
  TranslationResultSchema,
  TripPlanSchema,
  type ConversationMode,
  type TranslationResult,
  type TripPlan,
} from "@koreamate/contracts";
import Link from "next/link";
import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import { createConversation, jobEventsUrl, sendTextMessage } from "../../lib/api";
import styles from "./conversation-screen.module.css";

type ConversationScreenProps = {
  mode: ConversationMode;
  title: string;
  heading: string;
  description: string;
  placeholder: string;
};

type TimelineItem =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "question"; text: string }
  | { id: string; kind: "translation"; value: TranslationResult }
  | { id: string; kind: "plan"; value: TripPlan };

export function shouldSubmitOnEnter(key: string, shiftKey: boolean, isComposing: boolean): boolean {
  return key === "Enter" && !shiftKey && !isComposing;
}

function weatherText(plan: TripPlan): string | null {
  if (!plan.weather) return null;
  if (plan.weather.status === "pending") return plan.weather.reason === "date_required" ? "确定日期后更新天气" : "临近出发时更新天气";
  const day = plan.weather.days[0];
  if (!day) return null;
  const rain = Math.max(...plan.weather.days.map((value) => value.precipitationProbability));
  return `${Math.round(day.temperatureMin)}–${Math.round(day.temperatureMax)}°C · 降雨概率最高 ${rain}%`;
}

export function ConversationScreen({
  mode,
  title,
  heading,
  description,
  placeholder,
}: ConversationScreenProps) {
  const conversationId = useRef<string | null>(null);
  const [input, setInput] = useState("");
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    setBusy(true);
    setError("");
    setStatus("正在接收你的想法…");
    setInput("");
    setTimeline((current) => [...current, { id: crypto.randomUUID(), kind: "user", text }]);

    try {
      if (!conversationId.current) {
        conversationId.current = (await createConversation(mode)).id;
      }
      const accepted = await sendTextMessage(conversationId.current, text, crypto.randomUUID());
      const stream = new EventSource(jobEventsUrl(accepted.jobId));
      stream.addEventListener("message.accepted", () => setStatus("已收到，正在准备下一步…"));
      stream.addEventListener("translation.started", () => setStatus("正在理解这句话…"));
      stream.addEventListener("travel.started", () => setStatus("正在整理你的旅行需求…"));
      stream.addEventListener("translation.ready", (rawEvent) => {
        const event = JobEventSchema.parse(JSON.parse((rawEvent as MessageEvent<string>).data));
        const translation = TranslationResultSchema.parse(event.data.translation);
        setTimeline((current) => [...current, { id: translation.id, kind: "translation", value: translation }]);
        setStatus("");
      });
      stream.addEventListener("travel.question", (rawEvent) => {
        const event = JobEventSchema.parse(JSON.parse((rawEvent as MessageEvent<string>).data));
        const question = typeof event.data.question === "string" ? event.data.question : "还需要补充一点信息。";
        setTimeline((current) => [...current, { id: event.eventId, kind: "question", text: question }]);
        setStatus("");
      });
      stream.addEventListener("travel.answer", (rawEvent) => {
        const event = JobEventSchema.parse(JSON.parse((rawEvent as MessageEvent<string>).data));
        const answer = typeof event.data.answer === "string" ? event.data.answer : "暂时无法回答这个问题。";
        setTimeline((current) => [...current, { id: event.eventId, kind: "question", text: answer }]);
        setStatus("");
      });
      stream.addEventListener("travel.plan.ready", (rawEvent) => {
        const event = JobEventSchema.parse(JSON.parse((rawEvent as MessageEvent<string>).data));
        const plan = TripPlanSchema.parse(event.data.plan);
        setTimeline((current) => [...current, { id: plan.versionId, kind: "plan", value: plan }]);
        setStatus("");
      });
      stream.addEventListener("job.completed", () => {
        setBusy(false);
        stream.close();
      });
      stream.addEventListener("job.failed", (rawEvent) => {
        const event = JobEventSchema.parse(JSON.parse((rawEvent as MessageEvent<string>).data));
        setError(typeof event.data.message === "string" ? event.data.message : "暂时无法完成，请稍后再试。");
        setStatus("");
        setBusy(false);
        stream.close();
      });
      stream.onerror = () => {
        setStatus("内容已发送，进度连接暂时中断。");
        setBusy(false);
        stream.close();
      };
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "暂时无法完成，请稍后再试。");
      setStatus("");
      setBusy(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (shouldSubmitOnEnter(event.key, event.shiftKey, event.nativeEvent.isComposing)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.back} href="/" aria-label="返回首页">
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <p className={styles.title}>{title}</p>
      </header>

      <section className={styles.conversation} aria-live="polite" aria-busy={busy}>
        <div className={styles.intro}>
          <h1>{heading}</h1>
          <p>{description}</p>
        </div>
        {timeline.map((item) => {
          if (item.kind === "user") return <p className={styles.bubble} key={item.id}>{item.text}</p>;
          if (item.kind === "question") return <p className={styles.assistantBubble} key={item.id}>{item.text}</p>;
          if (item.kind === "translation") {
            const translation = item.value;
            return <article className={styles.translation} key={item.id}>
            <p className={styles.translationLabel}>
              {translation.targetLanguage === "ko" ? "韩语表达" : "中文意思"}
            </p>
            <p className={styles.translationText}>{translation.translatedText}</p>
            {translation.naturalExpression !== translation.translatedText ? (
              <p className={styles.translationDetail}>更自然：{translation.naturalExpression}</p>
            ) : null}
            {translation.pronunciation ? (
              <p className={styles.translationDetail}>发音提示：{translation.pronunciation}</p>
            ) : null}
          </article>;
          }
          const plan = item.value;
          const weather = weatherText(plan);
          return <article className={styles.plan} key={item.id}>
            <div className={styles.planHeader}>
              <div>
                <p className={styles.translationLabel}>第 {plan.versionNumber} 版行程</p>
                <h2>{plan.title}</h2>
              </div>
              <p className={styles.planCost}>约 {plan.totalEstimatedCost.toLocaleString()} {plan.currency}</p>
            </div>
            <p className={styles.planSummary}>{plan.summary}</p>
            {weather || plan.exchangeRate ? (
              <div className={styles.tripContext}>
                {weather ? <span>{weather}</span> : null}
                {plan.exchangeRate ? <span>1 {plan.exchangeRate.base} ≈ {plan.exchangeRate.rate.toLocaleString(undefined, { maximumFractionDigits: 2 })} KRW · {plan.exchangeRate.date}</span> : null}
              </div>
            ) : null}
            <div className={styles.days}>
              {plan.days.map((day) => (
                <section className={styles.day} key={day.dayNumber}>
                  <div className={styles.dayHeading}>
                    <p>Day {day.dayNumber}{day.date ? ` · ${day.date.slice(5)}` : ""}</p>
                    <h3>{day.title}</h3>
                  </div>
                  {day.items.map((item) => (
                    <div className={styles.planItem} key={item.id}>
                      <time>{item.time}</time>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.description}</p>
                        {item.place ? (
                          <div className={styles.placeMeta}>
                            {item.place.address ? <span>{item.place.address}</span> : null}
                            {item.place.mapUrl ? <a href={item.place.mapUrl} target="_blank" rel="noreferrer">地图</a> : null}
                          </div>
                        ) : null}
                      </div>
                      <span>{item.estimatedCost > 0 ? `约 ${item.estimatedCost}` : "免费"}</span>
                    </div>
                  ))}
                  <p className={styles.dayCost}>当天约 {day.estimatedCost.toLocaleString()} {plan.currency}</p>
                </section>
              ))}
            </div>
          </article>;
        })}
        {status ? <p className={styles.status}>{status}</p> : null}
      </section>

      <div className={styles.composerWrap}>
        <form className={styles.composer} onSubmit={submit}>
          <label className={styles.visuallyHidden} htmlFor={`${mode}-message`}>输入内容</label>
          <textarea
            id={`${mode}-message`}
            className={styles.input}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            maxLength={4_000}
          />
          <button className={styles.send} type="submit" disabled={!input.trim() || busy} aria-label="发送">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 19V5m0 0l-6 6m6-6l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
      </div>
    </main>
  );
}
