"use client";

import {
  JobEventSchema,
  GuideImportPreviewSchema,
  HotelSearchResultSchema,
  FlightSearchResultSchema,
  TranslationResultSchema,
  ImageTranslationResultSchema,
  TripPlanSchema,
  type ConversationMode,
  type TranslationResult,
  type ImageTranslationResult,
  type TripPlan,
  type GuideImportPreview,
  type HotelOption,
  type HotelSearchResult,
  type FlightOption,
  type FlightSearchResult,
  type Citation,
} from "@koreamate/contracts";
import Link from "next/link";
import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { confirmTrip, createConversation, deleteSavedPlace, getConversation, jobEventsUrl, listSavedPlaces, savePlace, sendImageTranslationMessage, sendImportMessage, sendTextMessage, transcribeSpeech } from "../../lib/api";
import { ImageTranslationCard } from "./image-translation-card";
import { audioRecordingSupported, createAudioRecorder, recorderErrorMessage, type AudioRecorderController } from "../../lib/audio-recorder";
import { speakKorean, speechSynthesisSupported, stopSpeaking } from "../../lib/speech-synthesis";
import styles from "./conversation-screen.module.css";
import { WelcomeFlow } from "./welcome-flow";

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
  | { id: string; kind: "imageTranslation"; value: ImageTranslationResult }
  | { id: string; kind: "import"; value: GuideImportPreview }
  | { id: string; kind: "hotels"; value: HotelSearchResult }
  | { id: string; kind: "flights"; value: FlightSearchResult }
  | { id: string; kind: "plan"; value: TripPlan };

const subscribeToStaticCapability = () => () => undefined;
const serverCapability = () => false;
const subscribeToWelcome = (callback: () => void) => { window.addEventListener("storage", callback); window.addEventListener("koreamate-welcome-changed", callback); return () => { window.removeEventListener("storage", callback); window.removeEventListener("koreamate-welcome-changed", callback); }; };
const welcomeVisible = () => {
  if (new URLSearchParams(window.location.search).get("welcome") === "1") return true;
  return localStorage.getItem("koreamate-welcome-seen") !== "true";
};
const welcomeHiddenOnServer = () => false;

export function shouldSubmitOnEnter(key: string, shiftKey: boolean, isComposing: boolean): boolean {
  return key === "Enter" && !shiftKey && !isComposing;
}

export function isGuideImport(text: string, imageCount: number): boolean {
  return imageCount > 0 || /https?:\/\/(?:www\.)?(?:xiaohongshu\.com|xhslink\.(?:cn|com))\//iu.test(text);
}

function weatherText(plan: TripPlan): string | null {
  if (!plan.weather) return null;
  if (plan.weather.status === "pending") return plan.weather.reason === "date_required" ? "确定日期后更新天气" : "临近出发时更新天气";
  const day = plan.weather.days[0];
  if (!day) return null;
  const rain = Math.max(...plan.weather.days.map((value) => value.precipitationProbability));
  return `${Math.round(day.temperatureMin)}–${Math.round(day.temperatureMax)}°C · 降雨概率最高 ${rain}%`;
}

function AssistantAnswer({ text }: { text: string }) {
  const blocks = text.split(/\n+/u).map((value) => value.trim()).filter(Boolean);
  const lines = blocks.length > 1 ? blocks : text.split(/(?=\d+[、.)])/u).map((value) => value.trim()).filter(Boolean);
  return <article className={styles.answerCard}>
    {lines.map((line, index) => /^\d+[、.)]/u.test(line) ? <div className={styles.answerItem} key={`${line}-${index}`}><span>{line.match(/^\d+/u)?.[0]}</span><p>{line.replace(/^\d+[、.)]\s*/u, "")}</p></div> : <p className={styles.answerParagraph} key={`${line}-${index}`}>{line}</p>)}
  </article>;
}

export function ConversationScreen({
  mode,
  title,
  heading,
  description,
  placeholder,
}: ConversationScreenProps) {
  const conversationId = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const recorder = useRef<AudioRecorderController | null>(null);
  const [input, setInput] = useState("");
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [selectedImports, setSelectedImports] = useState<Record<string, number[]>>({});
  const [expandedImports, setExpandedImports] = useState<Record<string, boolean>>({});
  const [confirmedTrips, setConfirmedTrips] = useState<Record<string, boolean>>({});
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const welcomeReady = useSyncExternalStore(subscribeToWelcome, welcomeVisible, welcomeHiddenOnServer);
  const forceWelcome = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("welcome") === "1";
  const showWelcome = mode === "UNIFIED" && (forceWelcome || !welcomeReady);
  const [savedPlaces, setSavedPlaces] = useState<Record<string, string>>({});
  const canRecordAudio = useSyncExternalStore(subscribeToStaticCapability, audioRecordingSupported, serverCapability);
  const canSpeak = useSyncExternalStore(subscribeToStaticCapability, speechSynthesisSupported, serverCapability);

  useEffect(() => () => {
    recorder.current?.destroy();
    stopSpeaking();
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("conversation");
    const prefill = new URLSearchParams(window.location.search).get("prefill");
    if (prefill) void Promise.resolve(prefill).then(setInput);
    if (!id) return;
    void getConversation(id).then((value) => {
      if (value.mode !== mode) return;
      conversationId.current = value.id;
      const restored = value.timeline.filter((item): item is TimelineItem => Boolean(item && typeof item === "object" && "kind" in item));
      if (value.latestPlan) restored.push({ id: value.latestPlan.versionId, kind: "plan", value: value.latestPlan });
      setTimeline(restored);
    }).catch(() => setError("这条历史记录暂时无法打开。"));
  }, [mode]);

  function finishWelcome(): void { localStorage.setItem("koreamate-welcome-seen", "true"); window.dispatchEvent(new Event("koreamate-welcome-changed")); }

  useEffect(() => { if (mode === "TRANSLATION") return; void listSavedPlaces().then(({ items }) => setSavedPlaces(Object.fromEntries(items.map((item) => [item.placeId, item.id])))).catch(() => undefined); }, [mode]);

  async function toggleSaved(placeId: string): Promise<void> {
    const savedId = savedPlaces[placeId];
    setSavedPlaces((current) => { const next = { ...current }; if (savedId) delete next[placeId]; else next[placeId] = "pending"; return next; });
    try {
      if (savedId && savedId !== "pending") await deleteSavedPlace(savedId);
      else { const saved = await savePlace(placeId); setSavedPlaces((current) => ({ ...current, [placeId]: saved.id })); }
    } catch { setSavedPlaces((current) => { const next = { ...current }; if (savedId) next[placeId] = savedId; else delete next[placeId]; return next; }); setError("收藏操作失败，请重试。"); }
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const text = input.trim();
    if ((!text && images.length === 0) || busy) return;

    await send(text, images);
  }

  async function send(text: string, attachedImages: string[] = []): Promise<void> {

    setBusy(true);
    setError("");
    setStatus("正在接收你的想法…");
    setInput("");
    setImages([]);
    setTimeline((current) => [...current, { id: crypto.randomUUID(), kind: "user", text: text || `已上传 ${attachedImages.length} 张${mode === "TRAVEL" ? "攻略截图" : "待翻译照片"}` }]);

    try {
      if (!conversationId.current) {
        conversationId.current = (await createConversation(mode)).id;
      }
      const isImageTranslation = mode !== "TRAVEL" && attachedImages.length > 0;
      const isImport = mode !== "TRANSLATION" && mode !== "UNIFIED" && isGuideImport(text, attachedImages.length);
      const accepted = isImageTranslation
        ? await sendImageTranslationMessage(conversationId.current, text, attachedImages, crypto.randomUUID())
        : isImport
        ? await sendImportMessage(conversationId.current, text, attachedImages, crypto.randomUUID())
        : await sendTextMessage(conversationId.current, text, crypto.randomUUID());
      const stream = new EventSource(jobEventsUrl(accepted.jobId), { withCredentials: true });
      stream.addEventListener("message.accepted", () => setStatus("已收到，正在准备下一步…"));
      stream.addEventListener("conversation.started", () => setStatus("正在开始理解你的话…"));
      stream.addEventListener("conversation.understanding", () => setStatus("正在理解你的需求…"));
      stream.addEventListener("conversation.routing", () => setStatus("正在判断要帮你做什么…"));
      stream.addEventListener("conversation.executing", () => setStatus("正在整理结果…"));
      stream.addEventListener("conversation.result.ready", () => setStatus("结果准备好了"));
      stream.addEventListener("translation.started", () => setStatus("正在理解这句话…"));
      stream.addEventListener("translation.image.started", () => setStatus("正在识别图片里的韩文…"));
      stream.addEventListener("translation.image.ocr.ready", () => setStatus("文字识别完成，正在整理中文…"));
      stream.addEventListener("travel.started", () => setStatus("正在整理你的旅行需求…"));
      stream.addEventListener("translation.ready", (rawEvent) => {
        const event = JobEventSchema.parse(JSON.parse((rawEvent as MessageEvent<string>).data));
        const translation = TranslationResultSchema.parse(event.data.translation);
        setTimeline((current) => [...current, { id: translation.id, kind: "translation", value: translation }]);
        setStatus("");
      });
      stream.addEventListener("translation.image.ready", (rawEvent) => {
        const event = JobEventSchema.parse(JSON.parse((rawEvent as MessageEvent<string>).data));
        const result = ImageTranslationResultSchema.parse(event.data.result);
        setTimeline((current) => [...current, { id: event.eventId, kind: "imageTranslation", value: result }]);
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
      stream.addEventListener("travel.trip.confirmed", (rawEvent) => {
        const event = JobEventSchema.parse(JSON.parse((rawEvent as MessageEvent<string>).data));
        const tripId = typeof event.data.tripId === "string" ? event.data.tripId : "";
        if (tripId) setConfirmedTrips((current) => ({ ...current, [tripId]: true }));
        setTimeline((current) => [...current, { id: event.eventId, kind: "question", text: "行程已确认，已经放进“开始出发吧”。" }]);
      });
      stream.addEventListener("travel.saved-place.ready", (rawEvent) => {
        const event = JobEventSchema.parse(JSON.parse((rawEvent as MessageEvent<string>).data));
        const answer = typeof event.data.answer === "string" ? event.data.answer : "收藏已更新。";
        const savedPlace = event.data.savedPlace && typeof event.data.savedPlace === "object" ? event.data.savedPlace as { id?: unknown; placeId?: unknown } : null;
        const removedPlaceId = typeof event.data.placeId === "string" ? event.data.placeId : null;
        if (typeof savedPlace?.id === "string" && typeof savedPlace.placeId === "string") setSavedPlaces((current) => ({ ...current, [savedPlace.placeId as string]: savedPlace.id as string }));
        if (removedPlaceId) setSavedPlaces((current) => { const next = { ...current }; delete next[removedPlaceId]; return next; });
        setTimeline((current) => [...current, { id: event.eventId, kind: "question", text: answer }]);
        setStatus("");
      });
      stream.addEventListener("travel.saved-place.question", (rawEvent) => {
        const event = JobEventSchema.parse(JSON.parse((rawEvent as MessageEvent<string>).data));
        const question = typeof event.data.question === "string" ? event.data.question : "请告诉我想收藏哪个地点。";
        setTimeline((current) => [...current, { id: event.eventId, kind: "question", text: question }]);
        setStatus("");
      });
      stream.addEventListener("travel.memory.updated", (rawEvent) => {
        const event = JobEventSchema.parse(JSON.parse((rawEvent as MessageEvent<string>).data));
        if (event.data.action === "saved") return;
        const answer = typeof event.data.answer === "string" ? event.data.answer : null;
        const summary = typeof event.data.summary === "string" ? event.data.summary : "旅行偏好";
        setTimeline((current) => [...current, { id: event.eventId, kind: "question", text: answer ?? `已记住：${summary}` }]);
        setStatus("");
      });
      stream.addEventListener("travel.memory.question", (rawEvent) => {
        const event = JobEventSchema.parse(JSON.parse((rawEvent as MessageEvent<string>).data));
        const question = typeof event.data.question === "string" ? event.data.question : "请告诉我想删除哪项偏好。";
        setTimeline((current) => [...current, { id: event.eventId, kind: "question", text: question }]);
        setStatus("");
      });
      stream.addEventListener("travel.import.ready", (rawEvent) => {
        const event = JobEventSchema.parse(JSON.parse((rawEvent as MessageEvent<string>).data));
        const preview = GuideImportPreviewSchema.parse(event.data.preview);
        setTimeline((current) => [...current, { id: preview.id, kind: "import", value: preview }]);
        setSelectedImports((current) => ({ ...current, [preview.id]: preview.items.flatMap((item, index) => item.verified ? [index] : []) }));
        setStatus("");
      });
      stream.addEventListener("travel.hotel.ready", (rawEvent) => {
        const event = JobEventSchema.parse(JSON.parse((rawEvent as MessageEvent<string>).data));
        const result = HotelSearchResultSchema.parse(event.data.result);
        setTimeline((current) => [...current, { id: event.eventId, kind: "hotels", value: result }]);
        setStatus("");
      });
      stream.addEventListener("travel.flight.ready", (rawEvent) => {
        const event = JobEventSchema.parse(JSON.parse((rawEvent as MessageEvent<string>).data));
        const result = FlightSearchResultSchema.parse(event.data.result);
        setTimeline((current) => [...current, { id: event.eventId, kind: "flights", value: result }]);
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

  async function handleFiles(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files ?? []).slice(0, 4);
    try {
      setImages(await Promise.all(files.map(resizeImage)));
      setError("");
    } catch {
      setError("图片读取失败，请选择 JPG、PNG 或 WebP 图片。");
    } finally {
      event.target.value = "";
    }
  }

  async function createPlanFromImport(preview: GuideImportPreview): Promise<void> {
    const selected = new Set(selectedImports[preview.id] ?? []);
    const names = preview.items.filter((item, index) => item.verified && selected.has(index)).map((item) => item.place?.name ?? item.name);
    if (names.length === 0) {
      setError("没有可核验的地点，暂时无法生成行程。");
      return;
    }
    await send(`请根据这些已核验的攻略地点生成行程：${names.join("、")}`);
  }

  function toggleImportItem(previewId: string, index: number): void {
    setSelectedImports((current) => {
      const selected = new Set(current[previewId] ?? []);
      if (selected.has(index)) selected.delete(index); else selected.add(index);
      return { ...current, [previewId]: [...selected] };
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (shouldSubmitOnEnter(event.key, event.shiftKey, event.nativeEvent.isComposing)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function toggleRecording(): Promise<void> {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    setSpeechError("");
    recorder.current?.destroy();
    try {
      recorder.current = await createAudioRecorder({
        onComplete: (audio) => {
          setRecording(false);
          setTranscribing(true);
          void transcribeSpeech(audio).then((result) => {
            setInput((current) => `${current}${current.trim() ? " " : ""}${result.text}`);
          }).catch((error: unknown) => {
            setSpeechError(error instanceof Error ? error.message : "语音识别失败，请重试或直接输入文字。");
          }).finally(() => setTranscribing(false));
        },
        onError: (message) => { setRecording(false); setSpeechError(message); },
      });
      setRecording(true);
    } catch (error) {
      setSpeechError(recorderErrorMessage(error));
    }
  }

  function toggleSpeaking(id: string, text: string): void {
    if (speakingId === id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    setSpeakingId(id);
    if (!speakKorean(text, () => setSpeakingId(null))) setSpeakingId(null);
  }

  async function confirm(plan: TripPlan): Promise<void> {
    await confirmTrip(plan.tripId, plan.versionId);
    setConfirmedTrips((current) => ({ ...current, [plan.tripId]: true }));
  }

  if (showWelcome) return <WelcomeFlow onFinish={finishWelcome} />;

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
          if (item.kind === "question") return <AssistantAnswer key={item.id} text={item.text} />;
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
            {translation.targetLanguage === "ko" && canSpeak ? (
              <button className={styles.speakAction} type="button" onClick={() => toggleSpeaking(item.id, translation.naturalExpression)} aria-label={speakingId === item.id ? "停止朗读韩语" : "朗读韩语"}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M11 5L6 9H3v6h3l5 4V5zM15 9a4 4 0 010 6M18 6a8 8 0 010 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {speakingId === item.id ? "停止朗读" : "朗读韩语"}
              </button>
            ) : null}
          </article>;
          }
          if (item.kind === "imageTranslation") {
            return <ImageTranslationCard result={item.value} key={item.id} />;
          }
          if (item.kind === "import") {
            const preview = item.value;
            const verified = preview.items.filter((value) => value.verified).length;
            const selected = selectedImports[preview.id] ?? [];
            const visibleItems = expandedImports[preview.id] ? preview.items : preview.items.slice(0, 8);
            return <article className={styles.importCard} key={item.id}>
              <p className={styles.translationLabel}>攻略解析完成</p>
              <h2>识别到 {preview.items.length} 个地点</h2>
              <p className={styles.importSummary}>已核验 {verified} 个 · 待确认 {preview.items.length - verified} 个{preview.failedSourceCount ? ` · ${preview.failedSourceCount} 个链接无法读取` : ""}</p>
              {preview.needsFallback ? <p className={styles.importHint}>这个链接暂时无法直接读取，请上传攻略截图或粘贴正文。</p> : null}
              <ul className={styles.importPlaces}>{visibleItems.map((value, index) => <li key={`${value.name}-${index}`}>
                <label>
                  <input type="checkbox" checked={selected.includes(index)} disabled={!value.verified || busy} onChange={() => toggleImportItem(preview.id, index)} />
                  <span className={styles.importPlaceName}>
                    <strong>{value.name}</strong>
                    {value.place?.name && value.place.name !== value.name ? <small>{value.place.name}</small> : null}
                  </span>
                </label>
                <small>{value.verified ? "已核验" : "待确认"}</small>
              </li>)}</ul>
              {preview.items.length > 8 ? <button className={styles.importMore} type="button" aria-expanded={Boolean(expandedImports[preview.id])} onClick={() => setExpandedImports((current) => ({ ...current, [preview.id]: !current[preview.id] }))}>{expandedImports[preview.id] ? "收起" : `查看全部 ${preview.items.length} 个地点`}</button> : null}
              <button className={styles.importAction} type="button" disabled={busy || selected.length === 0} onClick={() => void createPlanFromImport(preview)}>用已选 {selected.length} 个地点生成行程</button>
            </article>;
          }
          if (item.kind === "hotels") return <HotelCards key={item.id} hotels={item.value.hotels} title={`${item.value.destination}住宿候选`} citation={item.value.citation} />;
          if (item.kind === "flights") return <FlightCards key={item.id} flights={item.value.flights} title={`${item.value.fromCity} → ${item.value.toCity}`} citation={item.value.citation} />;
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
                {weather ? <span>{weather}{plan.weather?.status === "available" ? <CitationBadge citation={plan.weather.citation} /> : null}</span> : null}
                {plan.exchangeRate ? <span>1 {plan.exchangeRate.base} ≈ {plan.exchangeRate.rate.toLocaleString(undefined, { maximumFractionDigits: 2 })} KRW · {plan.exchangeRate.date}<CitationBadge citation={plan.exchangeRate.citation} /></span> : null}
              </div>
            ) : null}
            {plan.hotels.length > 0 ? <HotelCards hotels={plan.hotels} title="住宿候选" embedded /> : null}
            {plan.flights.length > 0 ? <FlightCards flights={plan.flights} title="航班候选" embedded /> : null}
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
                            <CitationBadge citation={item.place.citation} />
                            <button className={styles.savePlace} type="button" aria-pressed={Boolean(savedPlaces[item.place.id])} aria-label={savedPlaces[item.place.id] ? "取消收藏" : "收藏地点"} onClick={() => void toggleSaved(item.place!.id)}>{savedPlaces[item.place.id] ? "♥ 已收藏" : "♡ 收藏"}</button>
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
            <button className={styles.confirmAction} type="button" disabled={busy || confirmedTrips[plan.tripId]} onClick={() => void confirm(plan)}>{confirmedTrips[plan.tripId] ? "已放入开始出发吧" : "确认这个行程"}</button>
          </article>;
        })}
        {status ? <p className={styles.status}>{status}</p> : null}
      </section>

      <div className={styles.composerWrap}>
        <form className={styles.composer} onSubmit={submit}>
          {mode === "TRAVEL" || mode === "TRANSLATION" || mode === "UNIFIED" ? <>
            <input ref={fileInput} className={styles.visuallyHidden} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void handleFiles(event)} />
            <button className={styles.attach} type="button" aria-label={mode === "TRAVEL" ? "上传攻略截图" : "上传需要翻译的照片"} onClick={() => fileInput.current?.click()}>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </> : null}
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
          <button className={`${styles.mic} ${recording ? styles.micActive : ""}`} type="button" disabled={!canRecordAudio || busy || transcribing} aria-label={!canRecordAudio ? "当前浏览器不支持录音" : transcribing ? "正在识别语音" : recording ? "停止录音" : "开始语音输入"} aria-pressed={recording} onClick={() => void toggleRecording()}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2" /><path d="M5 11a7 7 0 0014 0M12 18v3M9 21h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          <button className={styles.send} type="submit" disabled={(!input.trim() && images.length === 0) || busy} aria-label="发送">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 19V5m0 0l-6 6m6-6l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
        {images.length > 0 ? <p className={styles.attachmentStatus}>已选择 {images.length} 张{mode === "TRAVEL" ? "攻略截图" : "待翻译照片"}</p> : null}
        {recording ? <p className={styles.speechStatus} role="status" aria-atomic="true">正在录音，再点一次麦克风停止，最长 30 秒。</p> : null}
        {transcribing ? <p className={styles.speechStatus} role="status" aria-atomic="true">正在识别语音，首次加载模型可能需要几分钟…</p> : null}
        {!canRecordAudio ? <p className={styles.speechStatus}>当前浏览器暂不支持录音，可继续使用文字或图片。</p> : null}
        {speechError ? <p className={styles.error} role="alert">{speechError}</p> : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
      </div>
    </main>
  );
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) return reject(new Error("Unsupported image"));
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Invalid image")); };
    image.src = url;
  });
}

function CitationBadge({ citation }: { citation?: Citation | null }) {
  if (!citation) return null;
  const fetchedAt = citation.fetchedAt ? new Date(citation.fetchedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
  return <details className={styles.citation}>
    <summary>{citation.label}</summary>
    <div>{citation.stale ? <strong>数据可能已变化</strong> : null}{fetchedAt ? <span>更新于 {fetchedAt}</span> : <span>由 KoreaMate 小助理根据你的需求整理</span>}{citation.sourceUrl ? <a href={citation.sourceUrl} target="_blank" rel="noreferrer">查看来源</a> : null}</div>
  </details>;
}

function HotelCards({ hotels, title, embedded = false, citation }: { hotels: HotelOption[]; title: string; embedded?: boolean; citation?: Citation | null }) {
  return <section className={embedded ? styles.hotelSection : styles.hotelCard}>
    <p className={styles.translationLabel}>实时酒店参考</p>
    <h2>{title}</h2><CitationBadge citation={citation} />
    <div className={styles.hotelList}>{hotels.slice(0, 3).map((hotel) => <article key={hotel.id} className={styles.hotelItem}>
      <div><strong>{hotel.name}</strong><p>{hotel.starRating ? `${hotel.starRating} 星 · ` : ""}{hotel.recommendation || hotel.address}</p></div>
      <div className={styles.hotelPrice}><strong>约 {hotel.lowestPrice.toLocaleString()} {hotel.currency}</strong><span>每晚起</span></div>
      {hotel.bookingUrl ? <a href={hotel.bookingUrl} target="_blank" rel="noreferrer">查看房型</a> : null}
    </article>)}</div>
    <p className={styles.hotelNotice}>价格与房态来自第三方，预订前请在跳转页面再次确认。</p>
  </section>;
}

function FlightCards({ flights, title, embedded = false, citation }: { flights: FlightOption[]; title: string; embedded?: boolean; citation?: Citation | null }) {
  return <section className={embedded ? styles.hotelSection : styles.hotelCard}>
    <p className={styles.translationLabel}>实时航班参考</p>
    <h2>{title}</h2><CitationBadge citation={citation} />
    <div className={styles.hotelList}>{flights.slice(0, 3).map((flight) => <article key={flight.id} className={styles.flightItem}>
      <div className={styles.flightRoute}><strong>{flight.flightNumbers}</strong><span>{flight.direct ? "直飞" : `${flight.transferCity ?? "中转"}转机`}</span></div>
      <div className={styles.flightTimes}><time>{flight.departureAt.slice(11, 16)}</time><span>{flight.duration}</span><time>{flight.arrivalAt.slice(11, 16)}</time></div>
      <div className={styles.hotelPrice}><strong>约 {flight.price.toLocaleString()} {flight.currency}</strong><span>经济舱参考价</span></div>
    </article>)}</div>
    <p className={styles.hotelNotice}>价格与余票来自第三方实时查询，购买前请在出票平台再次确认。</p>
  </section>;
}
