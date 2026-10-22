"use client";

import { FormEvent, useRef, useState } from "react";

type AuthLandingProps = {
  onDone?: () => void;
};

function LogoPin({ className, src }: { className: string; src: string }) {
  return <span className={`auth-logo-pin ${className}`} aria-hidden="true">
    <img src={src} alt="" />
  </span>;
}

async function authenticate(path: string, body: unknown) {
  const response = await fetch(`/api/v1/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.message === "string" ? data.message : "Неуспешен опит. Опитай отново.");
  }
}

export function AuthLanding({ onDone }: AuthLandingProps) {
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [logoAwake, setLogoAwake] = useState(false);
  const scene = useRef<HTMLElement>(null);

  const moveScene = (event: React.PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    scene.current?.style.setProperty("--logo-tilt-x", `${(-y * 10).toFixed(2)}deg`);
    scene.current?.style.setProperty("--logo-tilt-y", `${(x * 12).toFixed(2)}deg`);
    scene.current?.style.setProperty("--panel-tilt-x", `${(y * 4).toFixed(2)}deg`);
    scene.current?.style.setProperty("--panel-tilt-y", `${(-x * 5).toFixed(2)}deg`);
  };

  const resetScene = () => {
    scene.current?.style.setProperty("--logo-tilt-x", "0deg");
    scene.current?.style.setProperty("--logo-tilt-y", "0deg");
    scene.current?.style.setProperty("--panel-tilt-x", "0deg");
    scene.current?.style.setProperty("--panel-tilt-y", "0deg");
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const handle = String(form.get("handle") ?? "");
    if (register && !/^[a-zA-Z0-9_]{3,24}$/.test(handle)) {
      setError("Потребителското име е с 3–24 латински букви, цифри или _. ");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await authenticate(register ? "register" : "login", register
        ? { email: form.get("email"), handle, password: form.get("password"), displayName: form.get("displayName"), dateOfBirth: form.get("dateOfBirth"), declaredAdult: form.get("declaredAdult") === "on" }
        : { email: form.get("email"), password: form.get("password") });
      if (onDone) onDone();
      else window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Неуспешен опит. Опитай отново.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className={`auth-landing${logoAwake ? " logo-awake" : ""}`} ref={scene} onPointerMove={moveScene} onPointerLeave={resetScene}>
    <div className="auth-grid" aria-hidden="true" />
    <div className="auth-orb auth-orb-blue" aria-hidden="true" />
    <div className="auth-orb auth-orb-pink" aria-hidden="true" />
    <div className="auth-orbit auth-orbit-one" aria-hidden="true" />
    <div className="auth-orbit auth-orbit-two" aria-hidden="true" />

    <section className="auth-intro">
      <button type="button" className="auth-logo" aria-label="Активирай анимацията на логото" onClick={() => setLogoAwake((value) => !value)}>
        <span className="auth-logo-glow" />
        <span className="auth-logo-artwork">
          <img className="auth-logo-background" src="/follow-me-logo-main.png" alt="Follow Me" />
          <img className="auth-logo-wordmark" src="/follow-me-wordmark-final.png" alt="" aria-hidden="true" />
          <LogoPin className="pin-left-top" src="/login-pin-classic.png" />
          <LogoPin className="pin-left-bottom" src="/login-pin-star.png" />
          <LogoPin className="pin-right-top" src="/login-pin-diamond.png" />
          <LogoPin className="pin-right-bottom" src="/login-pin-heart.png" />
        </span>
        <span className="auth-logo-pulse" />
      </button>
      <div className="auth-copy">
        <span className="auth-kicker"><i /> FOLLOW ME</span>
        <h1>Срещите започват<br /><em>наблизо.</em></h1>
        <p>Откривай хора около себе си, споделяй присъствие само по твой избор и започвай разговор, когато моментът е правилен.</p>
      </div>
      <div className="auth-features" aria-label="Възможности">
        <span><b>⌖</b> Ти избираш видимостта</span>
        <span><b>✦</b> Хора от твоя район</span>
        <span><b>◌</b> Лични разговори</span>
      </div>
    </section>

    <section className="auth-panel" aria-label={register ? "Регистрация" : "Вход"}>
      <div className="auth-panel-light" aria-hidden="true" />
      <form className="auth-form" onSubmit={submit}>
        <header>
          <span className="auth-form-mark">{register ? "+" : "↗"}</span>
          <div><h2>{register ? "Създай своя профил" : "Добре дошъл отново"}</h2><p>{register ? "Започваш невидим. Ти решаваш кога да се покажеш." : "Влез и виж какво се случва около теб."}</p></div>
        </header>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <label>Имейл<input name="email" type="email" autoComplete="email" placeholder="you@email.com" required /></label>
        {register && <div className="auth-form-split">
          <label>Потребителско име<input name="handle" pattern="[a-zA-Z0-9_]{3,24}" title="3–24 латински букви, цифри или _" placeholder="alex_01" required /></label>
          <label>Име за показване<input name="displayName" autoComplete="name" placeholder="Алекс" required /></label>
        </div>}
        {register && <label>Дата на раждане<input name="dateOfBirth" type="date" required /></label>}
        <label>Парола<input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={8} placeholder="Минимум 8 символа" required /></label>
        {register && <label className="auth-adult"><input name="declaredAdult" type="checkbox" required /><span>Декларирам, че съм на 18+.</span></label>}
        <button className="auth-submit" disabled={submitting}>{submitting ? "Момент…" : register ? "Създай профил" : "Влез в Follow Me"}<span>→</span></button>
      </form>
      <p className="auth-footer">{register ? "Вече имаш профил? " : "Нямаш профил? "}<button type="button" onClick={() => { setRegister(!register); setError(""); }}>{register ? "Влез" : "Регистрирай се"}</button></p>
    </section>
  </main>;
}
