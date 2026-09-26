"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Tag, Image, Divider, Title } from "animal-island-ui";
import styles from "./page.module.css";

const places = [
  { name: "济州岛", korean: "제주 · JEJU", note: "风、海与橘子树", image: "/places/jeju.webp" },
  { name: "釜山", korean: "부산 · BUSAN", note: "沿着海岸线慢慢走", image: "/places/busan.webp" },
  { name: "首尔", korean: "서울 · SEOUL", note: "在城市里找到喜欢的日常", image: "/places/seoul.webp" },
];

const steps = [
  { icon: "🌿", color: "app-green", title: "说出你的想法", note: "不用填复杂的表格，一句话告诉我你想怎么旅行。", hint: "“바다 보고 싶어요”" },
  { icon: "🧳", color: "app-blue", title: "一起把它变具体", note: "我会一次问一个问题，帮你找到真正想去的地方。", hint: "路线正在展开…" },
  { icon: "🎫", color: "app-yellow", title: "带着它出发", note: "到了韩国，翻译、路线和临时改变都可以继续问。", hint: "서울역 · 14:20" },
] as const;

export default function HomePage() {
  const router = useRouter();

  return (
    <main className={styles.landing}>
      <header className={styles.nav}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandLogo} aria-hidden="true">🌿</span>
          <b>KoreaMate</b>
        </Link>
        <nav className={styles.navLinks}>
          <a href="#places">去哪里</a>
          <a href="#how">怎么开始</a>
          <Link href="/history">我的行程</Link>
        </nav>
        <Button type="primary" onClick={() => router.push("/travel")}>开始规划 <span aria-hidden="true">↗</span></Button>
      </header>

      <section className={styles.hero}>
        <div className={styles.sky} aria-hidden="true">
          <span className={styles.sun}>☀️</span>
          <span className={styles.cloudOne}>☁️</span>
          <span className={styles.cloudTwo}>☁️</span>
          <span className={styles.cloudThree}>☁️</span>
          <span className={styles.plane}>✈️</span>
        </div>

        <Card className={styles.ticket}>
          <div className={styles.ticketRoute}>
            <div><small>出发地</small><b>你的日常</b></div>
            <span className={styles.ticketPlane} aria-hidden="true">✈️</span>
            <div className={styles.ticketDest}><small>目的地</small><b>韩国</b></div>
          </div>
          <Divider type="dashed-brown" />
          <div className={styles.ticketBody}>
            <p className={styles.kicker}>韩国旅行工作台 · 한국 여행</p>
            <h1 className={styles.headline}>去韩国，<em>说走就走。</em></h1>
            <p className={styles.lede}>从一句“想去韩国玩”，到一段真正能出发的旅程。<br />路线、翻译和旅途中的每个小问题，都有人陪你一起想。</p>
            <div className={styles.heroActions}>
              <Button type="primary" size="large" onClick={() => router.push("/travel")}>出发！规划我的旅行 <span aria-hidden="true">→</span></Button>
              <a className={styles.textLink} href="#places">先看看目的地 <span aria-hidden="true">↓</span></a>
            </div>
          </div>
        </Card>
      </section>

      <section className={styles.steps} id="how">
        <div className={styles.sectionHead}>
          <Title variant="ribbon" color="app-green">怎么开始</Title>
          <h2>别让“想去”停在想象里。</h2>
          <p className={styles.sectionIntro}>告诉我们你想看的风景、想吃的东西，或者只是想离开日常几天。KoreaMate 会把模糊的念头，变成可以打开地图就出发的路线。</p>
        </div>
        <div className={styles.stepGrid}>
          {steps.map((step) => (
            <Card key={step.title} color={step.color} pattern={step.color} hoverable className={styles.step}>
              <span className={styles.stepIcon} aria-hidden="true">{step.icon}</span>
              <h3>{step.title}</h3>
              <p>{step.note}</p>
              <span className={styles.stepHint}>{step.hint}</span>
            </Card>
          ))}
        </div>
      </section>

      <section className={styles.places} id="places">
        <div className={styles.sectionHead}>
          <Title variant="ribbon" color="app-blue">你想从哪里开始</Title>
          <h2>韩国，等你亲自去看。</h2>
        </div>
        <div className={styles.placeGrid}>
          {places.map((place) => (
            <Link key={place.name} href="/travel" className={styles.place}>
              <Image src={place.image} alt={place.name} variant="stamp" stampYear="2026" lazy preview={false} />
              <div className={styles.placeCopy}>
                <Tag color="app-green" size="small">{place.korean}</Tag>
                <h3>{place.name}</h3>
                <p>{place.note}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <Title variant="tab" color="app-yellow">下一站，交给你决定</Title>
        <h2>世界很大，<em>先去韩国。</em></h2>
        <Button type="primary" size="large" onClick={() => router.push("/travel")}>开始我的旅程 <span aria-hidden="true">→</span></Button>
      </section>

      <footer className={styles.footer}>
        <span>© KoreaMate</span>
        <span>서울 · 제주 · 부산</span>
        <span>为每一次出发准备</span>
      </footer>
    </main>
  );
}
