"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TripPlan } from "@koreamate/contracts";
import { listConfirmedTrips } from "../../lib/api";
import styles from "../library.module.css";

type Confirmed = { tripId: string; title: string; confirmedAt: string; plan: TripPlan };
export default function DepartPage() {
  const [trips, setTrips] = useState<Confirmed[] | null>(null); const [selected, setSelected] = useState(0);
  useEffect(() => { const load = () => void listConfirmedTrips().then(setTrips).catch(() => setTrips([])); load(); window.addEventListener("koreamate-auth-changed", load); return () => window.removeEventListener("koreamate-auth-changed", load); }, []);
  if (trips === null) return <main className={styles.page}><p className={styles.empty}>正在准备行程…</p></main>;
  if (trips.length === 0) return <main className={styles.page}><header><p>KoreaMate</p><h1>开始出发吧</h1></header><section className={styles.empty}><h2>还没有确认的行程</h2><p>和 AI 确认最终安排后，行程会出现在这里。</p><Link href="/travel">去规划行程</Link></section></main>;
  const trip = trips[selected] ?? trips[0];
  return <main className={styles.page}><header><p>开始出发吧</p><h1>{trip.title}</h1><span>按当天顺序行动，不需要重新翻攻略。</span></header>{trips.length > 1 ? <label className={styles.switcher}>切换行程<select value={selected} onChange={(event) => setSelected(Number(event.target.value))}>{trips.map((item, index) => <option key={item.tripId} value={index}>{item.title}</option>)}</select></label> : null}<section className={styles.depart}>{trip.plan.days.map((day) => <article key={day.dayNumber}><div className={styles.dayTitle}><span>Day {day.dayNumber}{day.date ? ` · ${day.date.slice(5)}` : ""}</span><h2>{day.title}</h2></div>{day.items.map((item) => <div className={styles.step} key={item.id}><time>{item.time}</time><div><h3>{item.title}</h3><p>{item.description}</p>{item.place?.mapUrl ? <a href={item.place.mapUrl} target="_blank" rel="noreferrer">打开地图</a> : null}</div></div>)}</article>)}</section></main>;
}
