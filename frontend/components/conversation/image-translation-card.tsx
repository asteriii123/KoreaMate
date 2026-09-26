"use client";

import { useState } from "react";
import { Button } from "animal-island-ui";
import type { ImageTranslationResult } from "@koreamate/contracts";
import { resolveApiUrl } from "../../lib/api";
import styles from "./image-translation-card.module.css";

export function ImageTranslationCard({ result }: { result: ImageTranslationResult }) {
  const [original, setOriginal] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<string | null>(null);

  async function share(asset: ImageTranslationResult["assets"][number]) {
    const source = resolveApiUrl(asset.translatedUrl ?? asset.originalUrl);
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await fetch(source, { credentials: "include" }).then((response) => response.blob());
        const file = new File([blob], "koreamate-translated.webp", { type: blob.type });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "KoreaMate 图片翻译" }); return; }
      } catch { /* download fallback */ }
    }
    const anchor = document.createElement("a");
    anchor.href = `${source}${source.includes("?") ? "&" : "?"}download=1`;
    anchor.download = "koreamate-translated.webp";
    anchor.click();
  }

  if (!result.assets.length) return <LegacyDetails result={result} />;
  return <article className={styles.card}>
    <p className={styles.eyebrow}>{result.kind === "menu" ? "菜单已翻译" : "图片已翻译"}</p>
    <h2>{result.title}</h2>
    <p className={styles.summary}>{result.summary}</p>
    <div className={styles.assets}>{result.assets.map((asset, index) => {
      const showOriginal = original[asset.id] || !asset.translatedUrl;
      const url = resolveApiUrl(showOriginal ? asset.originalUrl : asset.translatedUrl!);
      return <section className={styles.asset} key={asset.id}>
        <div className={styles.switcher} aria-label={`第 ${index + 1} 张图片显示方式`}>
          <button aria-pressed={!showOriginal} disabled={!asset.translatedUrl} onClick={() => setOriginal((value) => ({ ...value, [asset.id]: false }))}>译文</button>
          <button aria-pressed={showOriginal} onClick={() => setOriginal((value) => ({ ...value, [asset.id]: true }))}>原图</button>
        </div>
        <button className={styles.imageButton} onClick={() => setPreview(url)} aria-label={`放大第 ${index + 1} 张图片`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={showOriginal ? "待翻译原图" : "中文覆盖译图"} width={asset.width} height={asset.height} />
        </button>
        {asset.translatedUrl ? <div className={styles.actions}>
          <a href={`${resolveApiUrl(asset.translatedUrl)}?download=1`} download>下载译图</a>
          <Button type="default" onClick={() => void share(asset)}>分享</Button>
        </div> : <p className={styles.fallback}>译图生成失败，已保留下方文字翻译。</p>}
      </section>;
    })}</div>
    <LegacyDetails result={result} compact />
    {preview ? <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label="图片预览" onClick={() => setPreview(null)}>
      <button onClick={() => setPreview(null)} aria-label="关闭预览">×</button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview} alt="放大的翻译图片" />
    </div> : null}
  </article>;
}

function LegacyDetails({ result, compact = false }: { result: ImageTranslationResult; compact?: boolean }) {
  return <details className={styles.details} open={!compact}>
    <summary>查看文字与菜品清单</summary>
    {result.menuItems.length ? <ul>{result.menuItems.map((dish, index) => <li key={`${dish.originalName}-${index}`}><span><strong>{dish.name}</strong><small>{dish.originalName}</small></span>{dish.price ? <b>{dish.price}</b> : null}</li>)}</ul> : null}
    {result.sections.length ? <div className={styles.sections}>{result.sections.map((section, index) => <div key={`${section.source}-${index}`}><small>{section.source}</small><p>{section.translation}</p></div>)}</div> : null}
    {result.uncertainText.length ? <p className={styles.uncertain}>有 {result.uncertainText.length} 处识别结果不太确定，译图中已用虚线标出。</p> : null}
  </details>;
}
