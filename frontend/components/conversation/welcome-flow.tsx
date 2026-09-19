"use client";

import { useState } from "react";
import styles from "./welcome-flow.module.css";

type WelcomeFlowProps = { onFinish: () => void };

const steps = [
  { label: "认识 KoreaMate", eyebrow: "你的韩国旅行小助手", title: <>想去韩国<br />怎么玩？</>, description: "告诉我想去哪里、想做什么，或者你现在还没想好。我们会从一句话开始，一步一步帮你把想法变成可以出发的计划。", kind: "start" },
  { label: "旅行规划", eyebrow: "从一句话开始", title: <>不用填表，<br />我会陪你慢慢想。</>, description: "我会理解上下文，只在必要时补问目的地、人数、预算和时间。", kind: "plan" },
  { label: "韩语翻译", eyebrow: "旅行中的每一句话", title: <>看不懂、不会说，<br />发给我就好。</>, description: "文字、语音、菜单或招牌图片，都可以在同一个对话里完成翻译。", kind: "translate" },
  { label: "开始对话", eyebrow: "现在就开始", title: <>你想先聊<br />哪件事？</>, description: "旅行规划和韩语翻译已经合在一起。不用选择模式，直接说话就好。", kind: "chat" },
] as const;

export function WelcomeFlow({ onFinish }: WelcomeFlowProps) {
  const [step, setStep] = useState(0);
  const current = steps[step]!;
  function next(): void { if (step === steps.length - 1) onFinish(); else setStep((value) => value + 1); }
  return <section className={styles.page} aria-labelledby="welcome-title"><header className={styles.top}><strong>KoreaMate</strong><div className={styles.progress}><span>{current.label}</span><div className={styles.dots}>{steps.map((item, index) => <i key={item.label} className={index === step ? styles.active : ""} />)}</div><span>{step + 1} / {steps.length}</span></div></header><div className={styles.hero}><div><p className={styles.eyebrow}>{current.eyebrow}</p><h1 id="welcome-title">{current.title}</h1><p className={styles.description}>{current.description}</p><button className={styles.primary} type="button" onClick={next}>{step === steps.length - 1 ? "开始对话　→" : "下一步　→"}</button>{step === 0 ? <button className={styles.skip} type="button" onClick={onFinish}>跳过介绍</button> : null}</div><Preview kind={current.kind} /></div><div className={styles.features}><div><span>✦</span><strong>帮你规划</strong><small>从一句话整理出韩国行程</small></div><div><span>文</span><strong>帮你翻译</strong><small>文字、语音、菜单和招牌</small></div><div><span>↗</span><strong>随时追问</strong><small>推荐、天气、酒店都接得住</small></div></div></section>;
}

function Preview({ kind }: { kind: (typeof steps)[number]["kind"] }) {
  if (kind === "translate") return <div className={styles.panel}><small>中文</small><p>请问洗手间在哪里？</p><small>韩语 · 礼貌表达</small><p className={styles.korean}>화장실이 어디예요?</p><small>▶ 播放发音　　自然表达　　复制</small></div>;
  if (kind === "plan") return <div className={styles.panel}><Card number="1" title="说出大概想法" text="和朋友去韩国，想吃好吃的。" /><Card number="2" title="逐个补齐关键信息" text="一次只问一个最重要的问题。" /><Card number="3" title="得到可以执行的推荐" text="真实地点、逐日安排、费用参考。" /></div>;
  return <div className={styles.panel}><div className={styles.bubble}>你好！你可以问我去韩国怎么玩，也可以直接发来一句需要翻译的话。</div><div className={`${styles.bubble} ${styles.user}`}>我还没想好去哪，但想去韩国玩。</div><div className={styles.bubble}>那我们先从城市开始。我一次只问一个问题。</div></div>;
}

function Card({ number, title, text }: { number: string; title: string; text: string }) { return <div className={styles.card}><b>{number}</b><div><strong>{title}</strong><small>{text}</small></div></div>; }
