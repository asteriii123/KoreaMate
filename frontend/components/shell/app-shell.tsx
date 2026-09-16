"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import type { UserMemory } from "@koreamate/contracts";
import { deleteMemory, getCurrentUser, listMemories, logout, requestEmailCode, verifyEmailCode } from "../../lib/api";
import styles from "./app-shell.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [memories, setMemories] = useState<UserMemory[] | null>(null);
  const [accountError, setAccountError] = useState("");

  useEffect(() => { void Promise.resolve(localStorage.getItem("koreamate-sidebar") === "collapsed").then(setCollapsed); void getCurrentUser().then(setUser).catch(() => undefined); }, []);
  function toggle(): void { const next = !collapsed; setCollapsed(next); localStorage.setItem("koreamate-sidebar", next ? "collapsed" : "expanded"); }
  const closeMobile = () => setMobileOpen(false);
  function openAccount(): void { setAccountOpen(true); setAccountError(""); setMemories(null); void listMemories().then((value) => setMemories(value.items)).catch(() => { setMemories([]); setAccountError("偏好暂时无法加载，请稍后重试。"); }); }
  async function removeMemory(item: UserMemory): Promise<void> { setMemories((current) => current?.filter((value) => value.id !== item.id) ?? []); try { await deleteMemory(item.id); } catch { setMemories((current) => [item, ...(current ?? [])]); setAccountError("删除失败，请重试。"); } }

  return <div className={`${styles.shell} ${collapsed ? styles.isCollapsed : ""}`}>
    <button className={styles.mobileMenu} type="button" onClick={() => setMobileOpen(true)} aria-label="打开菜单">☰</button>
    {mobileOpen ? <button className={styles.scrim} type="button" aria-label="关闭菜单" onClick={closeMobile} /> : null}
    <aside className={`${styles.sidebar} ${mobileOpen ? styles.mobileOpen : ""}`} aria-label="主导航">
      <div className={styles.brandRow}><Link href="/" onClick={closeMobile}><span className={styles.logo}>K</span><span className={styles.label}>KoreaMate</span></Link><button type="button" onClick={toggle} className={styles.collapse} aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}>‹</button></div>
      <nav className={styles.nav}>
        <Link className={pathname === "/depart" ? styles.active : ""} href="/depart" onClick={closeMobile}><span aria-hidden="true">↗</span><span className={styles.label}>开始出发吧</span></Link>
        <Link className={pathname === "/history" ? styles.active : ""} href="/history" onClick={closeMobile}><span aria-hidden="true">◷</span><span className={styles.label}>历史记录</span></Link>
        <Link className={pathname === "/saved" ? styles.active : ""} href="/saved" onClick={closeMobile}><span aria-hidden="true">♡</span><span className={styles.label}>我的收藏</span></Link>
      </nav>
      <div className={styles.account}><button type="button" className={styles.accountButton} title={user?.email ?? "账户与偏好"} onClick={openAccount}><span className={styles.avatar}>{user?.email[0]?.toUpperCase() ?? "人"}</span><span className={styles.label}>{user?.email ?? "账户与偏好"}</span></button></div>
    </aside>
    <div className={styles.content}>{children}</div>
    {loginOpen ? <LoginDialog onClose={() => setLoginOpen(false)} onLogin={(value) => { setUser(value); setLoginOpen(false); window.dispatchEvent(new Event("koreamate-auth-changed")); }} /> : null}
    {accountOpen ? <AccountDialog user={user} memories={memories} error={accountError} onClose={() => setAccountOpen(false)} onLogin={() => { setAccountOpen(false); setLoginOpen(true); }} onDelete={(item) => void removeMemory(item)} onLogout={() => void logout().then(() => { setUser(null); setAccountOpen(false); window.dispatchEvent(new Event("koreamate-auth-changed")); })} /> : null}
  </div>;
}

const memoryLabels: Record<UserMemory["kind"], string> = { departure_city: "常用出发城市", budget_level: "预算偏好", pace: "行程节奏", interest: "兴趣", constraint: "需要注意" };
const memoryValues: Record<string, string> = { economy: "经济省钱", balanced: "注重性价比", comfortable: "舒适品质", relaxed: "轻松", packed: "紧凑" };

function AccountDialog({ user, memories, error, onClose, onLogin, onDelete, onLogout }: { user: { id: string; email: string } | null; memories: UserMemory[] | null; error: string; onClose: () => void; onLogin: () => void; onDelete: (item: UserMemory) => void; onLogout: () => void }) {
  return <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`${styles.dialog} ${styles.accountDialog}`} role="dialog" aria-modal="true" aria-labelledby="account-title"><button className={styles.dialogClose} type="button" onClick={onClose} aria-label="关闭">×</button><p className={styles.eyebrow}>KoreaMate</p><h2 id="account-title">我的偏好</h2><p>{user ? user.email : "登录后可跨设备保留行程和偏好。"}</p>{error ? <p className={styles.dialogError}>{error}</p> : null}{memories === null ? <p>正在加载…</p> : memories.length === 0 ? <div className={styles.memoryEmpty}>还没有长期偏好，正常规划时我会逐渐了解你。</div> : <ul className={styles.memoryList}>{memories.map((item) => <li key={item.id}><div><small>{memoryLabels[item.kind]}</small><strong>{memoryValues[item.value] ?? item.value}</strong></div><button type="button" aria-label={`删除${memoryLabels[item.kind]}：${memoryValues[item.value] ?? item.value}`} onClick={() => onDelete(item)}>删除</button></li>)}</ul>}<div className={styles.accountActions}>{user ? <button type="button" onClick={onLogout}>退出登录</button> : <button type="button" onClick={onLogin}>登录并保留偏好</button>}</div></section></div>;
}

function LoginDialog({ onClose, onLogin }: { onClose: () => void; onLogin: (user: { id: string; email: string }) => void }) {
  const [email, setEmail] = useState(""); const [code, setCode] = useState(""); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { if (!sent) { await requestEmailCode(email); setSent(true); } else onLogin(await verifyEmailCode(email, code)); } catch (cause) { setError(cause instanceof Error ? cause.message : "登录失败，请稍后重试"); } finally { setBusy(false); } }
  return <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="login-title"><button className={styles.dialogClose} type="button" onClick={onClose} aria-label="关闭">×</button><p className={styles.eyebrow}>KoreaMate</p><h2 id="login-title">{sent ? "输入验证码" : "登录后保存所有行程"}</h2><p>{sent ? `验证码已发送到 ${email}` : "不用设置密码，输入邮箱即可。"}</p><form onSubmit={submit}>{!sent ? <input type="email" required autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder="你的邮箱" /> : <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="6 位验证码" />}<button type="submit" disabled={busy}>{busy ? "请稍候…" : sent ? "登录" : "发送验证码"}</button></form>{error ? <p className={styles.dialogError}>{error}</p> : null}{sent ? <button className={styles.textButton} type="button" onClick={() => { setSent(false); setCode(""); }}>更换邮箱</button> : null}</section></div>;
}
