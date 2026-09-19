"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ConversationMode } from "@koreamate/contracts";
import { listHistory } from "../../lib/api";
import styles from "../library.module.css";

type Item = { conversationId: string; mode: ConversationMode; title: string; updatedAt: string; tripId: string | null; confirmed: boolean };

export default function HistoryPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => { const load = () => void listHistory().then((value) => setItems(value.items)).catch(() => setItems([])); load(); window.addEventListener("koreamate-auth-changed", load); return () => window.removeEventListener("koreamate-auth-changed", load); }, []);
  return <main className={styles.page}><header><p>KoreaMate</p><h1>历史记录</h1><span>你规划过的旅行和翻译，都在这里。</span></header>{items === null ? <p className={styles.empty}>正在加载…</p> : items.length === 0 ? <section className={styles.empty}><h2>还没有历史记录</h2><p>从一句话开始规划，记录会自动保存在这里。</p><Link href="/travel">开始规划</Link></section> : <section className={styles.list}>{items.map((item) => { const path = item.mode === "TRAVEL" ? "/travel" : item.mode === "TRANSLATION" ? "/translate" : "/"; return <Link key={item.conversationId} href={`${path}?conversation=${encodeURIComponent(item.conversationId)}`}><div><small>{item.mode === "TRAVEL" ? "旅行规划" : item.mode === "TRANSLATION" ? "韩语翻译" : "KoreaMate 助手"}{item.confirmed ? " · 已确认" : ""}</small><h2>{item.title}</h2></div><time>{new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(item.updatedAt))}</time></Link>; })}</section>}</main>;
}
