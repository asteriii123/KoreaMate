import Link from "next/link";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.main}>
      <section className={styles.shell} aria-labelledby="home-title">
        <h1 id="home-title" className={styles.brand}>KoreaMate</h1>
        <p className={styles.prompt}>今天需要我帮你做什么？</p>
        <div className={styles.actions}>
          <Link className={styles.action} href="/travel">
            <strong>帮我规划韩国旅行</strong>
            <span>从一句话开始</span>
          </Link>
          <Link className={styles.action} href="/translate">
            <strong>帮我翻译韩语</strong>
            <span>输入、说话，或者拍张照片</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
