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
} from "@koreamate/contracts";
import Link from "next/link";
import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { confirmTrip, createConversation, getConversation, jobEventsUrl, sendImageTranslationMessage, sendImportMessage, sendTextMessage } from "../../lib/api";
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
  | { id: string; kind: "imageTranslation"; value: ImageTranslationResult }
  | { id: string; kind: "import"; value: GuideImportPreview }
  | { id: string; kind: "hotels"; value: HotelSearchResult }
  | { id: string; kind: "flights"; value: FlightSearchResult }
  | { id: string; kind: "plan"; value: TripPlan };

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

export function ConversationScreen({
  mode,
  title,
  heading,
  description,
  placeholder,
}: ConversationScreenProps) {
  const conversationId = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [input, setInput] = useState("");
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [selectedImports, setSelectedImports] = useState<Record<string, number[]>>({});
  const [expandedImports, setExpandedImports] = useState<Record<string, boolean>>({});
  const [confirmedTrips, setConfirmedTrips] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("conversation");
    if (!id) return;
    void getConversation(id).then((value) => {
      if (value.mode !== mode) return;
      conversationId.current = value.id;
      const restored = value.timeline.filter((item): item is TimelineItem => Boolean(item && typeof item === "object" && "kind" in item));
      if (value.latestPlan) restored.push({ id: value.latestPlan.versionId, kind: "plan", value: value.latestPlan });
      setTimeline(restored);
    }).catch(() => setError("这条历史记录暂时无法打开。"));
  }, [mode]);

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
    setTimeline((current) => [...current, { id: crypto.randomUUID(), kind: "user", text: text || `已上传 ${attachedImages.length} 张${mode === "TRANSLATION" ? "待翻译照片" : "攻略截图"}` }]);

    try {
      if (!conversationId.current) {
        conversationId.current = (await createConversation(mode)).id;
      }
      const isImageTranslation = mode === "TRANSLATION" && attachedImages.length > 0;
      const isImport = mode === "TRAVEL" && isGuideImport(text, attachedImages.length);
      const accepted = isImageTranslation
        ? await sendImageTranslationMessage(conversationId.current, text, attachedImages, crypto.randomUUID())
        : isImport
        ? await sendImportMessage(conversationId.current, text, attachedImages, crypto.randomUUID())
        : await sendTextMessage(conversationId.current, text, crypto.randomUUID());
      const stream = new EventSource(jobEventsUrl(accepted.jobId), { withCredentials: true });
      stream.addEventListener("message.accepted", () => setStatus("已收到，正在准备下一步…"));
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

  async function confirm(plan: TripPlan): Promise<void> {
    await confirmTrip(plan.tripId, plan.versionId);
    setConfirmedTrips((current) => ({ ...current, [plan.tripId]: true }));
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
          if (item.kind === "imageTranslation") {
            const result = item.value;
            return <article className={styles.imageTranslation} key={item.id}>
              <p className={styles.translationLabel}>{result.kind === "menu" ? "菜单已翻译" : "图片已翻译"}</p>
              <h2>{result.title}</h2>
              <p className={styles.imageSummary}>{result.summary}</p>
              {result.menuItems.length ? <ul className={styles.menuItems}>{result.menuItems.map((dish, index) => <li key={`${dish.originalName}-${index}`}>
                <div><strong>{dish.name}</strong><span>{dish.originalName}</span>{dish.description ? <p>{dish.description}</p> : null}</div>
                {dish.price ? <b>{dish.price}</b> : null}
              </li>)}</ul> : null}
              {result.sections.length ? <div className={styles.translationSections}>{result.sections.map((section, index) => <div key={`${section.source}-${index}`}><small>{section.source}</small><p>{section.translation}</p></div>)}</div> : null}
              {result.uncertainText.length ? <details className={styles.uncertain}><summary>有 {result.uncertainText.length} 处文字不太确定</summary><p>{result.uncertainText.join(" · ")}</p></details> : null}
            </article>;
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
          if (item.kind === "hotels") return <HotelCards key={item.id} hotels={item.value.hotels} title={`${item.value.destination}住宿候选`} />;
          if (item.kind === "flights") return <FlightCards key={item.id} flights={item.value.flights} title={`${item.value.fromCity} → ${item.value.toCity}`} />;
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
          {mode === "TRAVEL" || mode === "TRANSLATION" ? <>
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
          <button className={styles.send} type="submit" disabled={(!input.trim() && images.length === 0) || busy} aria-label="发送">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 19V5m0 0l-6 6m6-6l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
        {images.length > 0 ? <p className={styles.attachmentStatus}>已选择 {images.length} 张{mode === "TRAVEL" ? "攻略截图" : "待翻译照片"}</p> : null}
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
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
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

function HotelCards({ hotels, title, embedded = false }: { hotels: HotelOption[]; title: string; embedded?: boolean }) {
  return <section className={embedded ? styles.hotelSection : styles.hotelCard}>
    <p className={styles.translationLabel}>实时酒店参考</p>
    <h2>{title}</h2>
    <div className={styles.hotelList}>{hotels.slice(0, 3).map((hotel) => <article key={hotel.id} className={styles.hotelItem}>
      <div><strong>{hotel.name}</strong><p>{hotel.starRating ? `${hotel.starRating} 星 · ` : ""}{hotel.recommendation || hotel.address}</p></div>
      <div className={styles.hotelPrice}><strong>约 {hotel.lowestPrice.toLocaleString()} {hotel.currency}</strong><span>每晚起</span></div>
      {hotel.bookingUrl ? <a href={hotel.bookingUrl} target="_blank" rel="noreferrer">查看房型</a> : null}
    </article>)}</div>
    <p className={styles.hotelNotice}>价格与房态来自第三方，预订前请在跳转页面再次确认。</p>
  </section>;
}

function FlightCards({ flights, title, embedded = false }: { flights: FlightOption[]; title: string; embedded?: boolean }) {
  return <section className={embedded ? styles.hotelSection : styles.hotelCard}>
    <p className={styles.translationLabel}>实时航班参考</p>
    <h2>{title}</h2>
    <div className={styles.hotelList}>{flights.slice(0, 3).map((flight) => <article key={flight.id} className={styles.flightItem}>
      <div className={styles.flightRoute}><strong>{flight.flightNumbers}</strong><span>{flight.direct ? "直飞" : `${flight.transferCity ?? "中转"}转机`}</span></div>
      <div className={styles.flightTimes}><time>{flight.departureAt.slice(11, 16)}</time><span>{flight.duration}</span><time>{flight.arrivalAt.slice(11, 16)}</time></div>
      <div className={styles.hotelPrice}><strong>约 {flight.price.toLocaleString()} {flight.currency}</strong><span>经济舱参考价</span></div>
    </article>)}</div>
    <p className={styles.hotelNotice}>价格与余票来自第三方实时查询，购买前请在出票平台再次确认。</p>
  </section>;
}
