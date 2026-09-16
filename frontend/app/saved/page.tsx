"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SavedPlace } from "@koreamate/contracts";
import { deleteSavedPlace, listSavedPlaces, savePlace } from "../../lib/api";
import styles from "./saved.module.css";

export default function SavedPage() {
  const [items, setItems] = useState<SavedPlace[] | null>(null);
  const [error, setError] = useState("");
  const [removed, setRemoved] = useState<SavedPlace | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = () => void listSavedPlaces().then((value) => setItems(value.items)).catch(() => { setItems([]); setError("收藏暂时无法加载，请稍后重试。"); });
  useEffect(() => { load(); window.addEventListener("koreamate-auth-changed", load); return () => { window.removeEventListener("koreamate-auth-changed", load); if (timer.current) clearTimeout(timer.current); }; }, []);
  async function remove(item: SavedPlace) { setItems((current) => current?.filter((value) => value.id !== item.id) ?? []); setRemoved(item); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setRemoved(null), 5000); try { await deleteSavedPlace(item.id); } catch { setItems((current) => [item, ...(current ?? [])]); setRemoved(null); setError("移除失败，请重试。"); } }
  async function undo() { if (!removed) return; const item = removed; setRemoved(null); try { const restored = await savePlace(item.placeId, item.note); setItems((current) => [restored, ...(current ?? [])]); } catch { setError("恢复失败，请重新收藏。"); } }
  return <main className={styles.page}><header><p>KoreaMate</p><h1>我的收藏</h1><span>把想去的地方留在这里。</span></header>{error ? <p className={styles.error}>{error}</p> : null}{items === null ? <p>正在加载…</p> : items.length === 0 ? <section className={styles.empty}><h2>还没有收藏地点</h2><p>从行程里点一下爱心，就能在这里找到。</p><Link href="/travel">去规划旅行</Link></section> : <section className={styles.list}>{items.map((item) => <article key={item.id}><div><h2>{item.nameZh ?? item.name}</h2>{item.nameZh && item.nameZh !== item.name ? <small>{item.name}</small> : null}<p>{item.address}</p>{item.note ? <p>{item.note}</p> : null}</div><div className={styles.actions}>{item.mapUrl ? <a href={item.mapUrl} target="_blank" rel="noreferrer">地图</a> : null}<Link href={`/travel?prefill=${encodeURIComponent(`请把「${item.nameZh ?? item.name}」加入我的韩国行程`)}`}>用它规划行程</Link><button type="button" onClick={() => void remove(item)}>移除</button></div></article>)}</section>}{removed ? <div className={styles.undo} role="status">已移除 <button type="button" onClick={() => void undo()}>撤销</button></div> : null}</main>;
}
