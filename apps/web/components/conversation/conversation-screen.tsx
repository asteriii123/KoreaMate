"use client";

import {
  JobEventSchema,
  TranslationResultSchema,
  type ConversationMode,
  type TranslationResult,
} from "@koreamate/contracts";
import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { createConversation, jobEventsUrl, sendTextMessage } from "../../lib/api";
import styles from "./conversation-screen.module.css";

type ConversationScreenProps = {
  mode: ConversationMode;
  title: string;
  heading: string;
  description: string;
  placeholder: string;
};

export function ConversationScreen({
  mode,
  title,
  heading,
  description,
  placeholder,
}: ConversationScreenProps) {
  const conversationId = useRef<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [translations, setTranslations] = useState<TranslationResult[]>([]);
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
    setMessages((current) => [...current, text]);

    try {
      if (!conversationId.current) {
        conversationId.current = (await createConversation(mode)).id;
      }
      const accepted = await sendTextMessage(conversationId.current, text, crypto.randomUUID());
      const stream = new EventSource(jobEventsUrl(accepted.jobId));
      stream.addEventListener("message.accepted", () => setStatus("已收到，正在准备下一步…"));
      stream.addEventListener("translation.started", () => setStatus("正在理解这句话…"));
      stream.addEventListener("translation.ready", (rawEvent) => {
        const event = JobEventSchema.parse(JSON.parse((rawEvent as MessageEvent<string>).data));
        const translation = TranslationResultSchema.parse(event.data.translation);
        setTranslations((current) => [...current, translation]);
        setStatus("");
      });
      stream.addEventListener("job.completed", () => {
        if (mode === "TRAVEL") {
          setStatus("内容已安全保存。旅行规划能力将在下一阶段接入。");
        }
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
        {messages.map((message, index) => (
          <p className={styles.bubble} key={`${index}-${message}`}>{message}</p>
        ))}
        {translations.map((translation) => (
          <article className={styles.translation} key={translation.id}>
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
          </article>
        ))}
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
