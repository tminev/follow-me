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
    throw new Error(typeof data?.message === "string" ? data.message : "ÐÐµÑƒÑÐ¿ÐµÑˆÐµÐ½ Ð¾Ð¿Ð¸Ñ‚. ÐžÐ¿Ð¸Ñ‚Ð°Ð¹ Ð¾Ñ‚Ð½Ð¾Ð²Ð¾.");
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
      setError("ÐŸÐ¾Ñ‚Ñ€ÐµÐ±Ð¸Ñ‚ÐµÐ»ÑÐºÐ¾Ñ‚Ð¾ Ð¸Ð¼Ðµ Ðµ Ñ 3â€“24 Ð»Ð°Ñ‚Ð¸Ð½ÑÐºÐ¸ Ð±ÑƒÐºÐ²Ð¸, Ñ†Ð¸Ñ„Ñ€Ð¸ Ð¸Ð»Ð¸ _. ");
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
      setError(cause instanceof Error ? cause.message : "ÐÐµÑƒÑÐ¿ÐµÑˆÐµÐ½ Ð¾Ð¿Ð¸Ñ‚. ÐžÐ¿Ð¸Ñ‚Ð°Ð¹ Ð¾Ñ‚Ð½Ð¾Ð²Ð¾.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className={`auth-landing${logoAwake ? " logo-awake" : ""}`} ref={scene} onPointerMove={moveScene} onPointerLeave={resetScene}>
    <div className="auth-grid" aria-hidden="true" />

    <section className="auth-intro">
      <button type="button" className="auth-logo" aria-label="ÐÐºÑ‚Ð¸Ð²Ð¸Ñ€Ð°Ð¹ Ð°Ð½Ð¸Ð¼Ð°Ñ†Ð¸ÑÑ‚Ð° Ð½Ð° Ð»Ð¾Ð³Ð¾Ñ‚Ð¾" onClick={() => setLogoAwake((value) => !value)}>
        <span className="auth-logo-container">
          <span className="auth-logo-artwork">
            <img className="auth-logo-background" src="/follow-me-logo-base-v3.png" alt="Follow Me" />
            <img className="auth-logo-main-pin" src="/main-location-pin.png" alt="" aria-hidden="true" />
            <img className="auth-logo-piece auth-logo-piece-curve-long" src="/login-logo-layer-5.png" alt="" aria-hidden="true" />
            <img className="auth-logo-piece auth-logo-piece-curve-short" src="/login-logo-layer-4.png" alt="" aria-hidden="true" />
            <svg className="auth-road-lights" viewBox="0 0 1254 1254" aria-hidden="true">
              <defs>
                <filter id="road-light-blue" x="-200%" y="-200%" width="400%" height="400%">
                  <feGaussianBlur stdDeviation="15" result="glow" />
                  <feGaussianBlur stdDeviation="38" result="outerGlow" />
                  <feComponentTransfer in="outerGlow" result="outerGlowBright"><feFuncA type="linear" slope="2.7" /></feComponentTransfer>
                  <feComponentTransfer in="glow" result="glowBright"><feFuncA type="linear" slope="2" /></feComponentTransfer>
                  <feMerge><feMergeNode in="outerGlowBright" /><feMergeNode in="outerGlowBright" /><feMergeNode in="glowBright" /><feMergeNode in="glowBright" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="road-light-pink" x="-200%" y="-200%" width="400%" height="400%">
                  <feGaussianBlur stdDeviation="15" result="glow" />
                  <feGaussianBlur stdDeviation="38" result="outerGlow" />
                  <feComponentTransfer in="outerGlow" result="outerGlowBright"><feFuncA type="linear" slope="2.7" /></feComponentTransfer>
                  <feComponentTransfer in="glow" result="glowBright"><feFuncA type="linear" slope="2" /></feComponentTransfer>
                  <feMerge><feMergeNode in="outerGlowBright" /><feMergeNode in="outerGlowBright" /><feMergeNode in="glowBright" /><feMergeNode in="glowBright" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <circle className="auth-road-light auth-road-light-blue" cx="0" cy="0" r="32" filter="url(#road-light-blue)">
                <animateMotion dur="12.5s" repeatCount="indefinite" path="M 184 765 C 326 628 568 642 683 808 C 796 972 651 1152 420 1120 C 184 1087 103 901 184 765 Z" />
              </circle>
              <circle className="auth-road-light auth-road-light-pink" cx="0" cy="0" r="32" filter="url(#road-light-pink)">
                <animateMotion dur="15.75s" begin="-6.4s" repeatCount="indefinite" path="M 1072 756 C 932 638 715 684 641 856 C 564 1032 707 1175 908 1117 C 1114 1057 1189 870 1072 756 Z" />
              </circle>
            </svg>
            <img className="auth-logo-wordmark" src="/follow-me-wordmark-final.png" alt="" aria-hidden="true" />
            <img className="auth-logo-piece auth-logo-piece-arrow" src="/login-logo-layer-3.png" alt="" aria-hidden="true" />
            <span className="auth-chat-impulse auth-chat-impulse-outgoing" aria-hidden="true" />
            <span className="auth-chat-impulse auth-chat-impulse-returning" aria-hidden="true" />
            <svg className="auth-signal-network" viewBox="0 0 1254 1254" aria-hidden="true">
              <defs>
                <linearGradient id="message-packet-out" x1="765" y1="777" x2="627" y2="702" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#61dcff" /><stop offset=".52" stopColor="#9579ff" /><stop offset="1" stopColor="#ff50cb" />
                </linearGradient>
                <linearGradient id="message-packet-back" x1="627" y1="702" x2="765" y2="777" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#ff50cb" /><stop offset=".52" stopColor="#9579ff" /><stop offset="1" stopColor="#61dcff" />
                </linearGradient>
              </defs>
              <path className="auth-signal-packet auth-signal-packet-out" d="M 765 777 L 627 702" pathLength="100" stroke="url(#message-packet-out)" />
              <path className="auth-signal-packet auth-signal-packet-back" d="M 627 702 L 765 777" pathLength="100" stroke="url(#message-packet-back)" />
            </svg>
            <LogoPin className="pin-left-top" src="/login-pin-classic.png" />
            <span className="auth-star-pin-trail-mask" aria-hidden="true">
              <img className="auth-star-pin-trail" src="/login-pin-star-underline.png" alt="" />
            </span>
            <LogoPin className="pin-left-bottom" src="/login-pin-star.png" />
            <LogoPin className="pin-right-top" src="/login-pin-diamond.png" />
            <LogoPin className="pin-right-bottom" src="/login-pin-heart.png" />
          </span>
        </span>
        <span className="auth-logo-pulse" />
      </button>
      <div className="auth-copy">
        <span className="auth-kicker"><i /> FOLLOW ME</span>
        <h1>Ð¡Ñ€ÐµÑ‰Ð¸Ñ‚Ðµ Ð·Ð°Ð¿Ð¾Ñ‡Ð²Ð°Ñ‚<br /><em>Ð½Ð°Ð±Ð»Ð¸Ð·Ð¾.</em></h1>
        <p>ÐžÑ‚ÐºÑ€Ð¸Ð²Ð°Ð¹ Ñ…Ð¾Ñ€Ð° Ð¾ÐºÐ¾Ð»Ð¾ ÑÐµÐ±Ðµ ÑÐ¸, ÑÐ¿Ð¾Ð´ÐµÐ»ÑÐ¹ Ð¿Ñ€Ð¸ÑÑŠÑÑ‚Ð²Ð¸Ðµ ÑÐ°Ð¼Ð¾ Ð¿Ð¾ Ñ‚Ð²Ð¾Ð¹ Ð¸Ð·Ð±Ð¾Ñ€ Ð¸ Ð·Ð°Ð¿Ð¾Ñ‡Ð²Ð°Ð¹ Ñ€Ð°Ð·Ð³Ð¾Ð²Ð¾Ñ€, ÐºÐ¾Ð³Ð°Ñ‚Ð¾ Ð¼Ð¾Ð¼ÐµÐ½Ñ‚ÑŠÑ‚ Ðµ Ð¿Ñ€Ð°Ð²Ð¸Ð»ÐµÐ½.</p>
      </div>
      <div className="auth-features" aria-label="Ð’ÑŠÐ·Ð¼Ð¾Ð¶Ð½Ð¾ÑÑ‚Ð¸">
        <span><b>âŒ–</b> Ð¢Ð¸ Ð¸Ð·Ð±Ð¸Ñ€Ð°Ñˆ Ð²Ð¸Ð´Ð¸Ð¼Ð¾ÑÑ‚Ñ‚Ð°</span>
        <span><b>âœ¦</b> Ð¥Ð¾Ñ€Ð° Ð¾Ñ‚ Ñ‚Ð²Ð¾Ñ Ñ€Ð°Ð¹Ð¾Ð½</span>
        <span><b>â—Œ</b> Ð›Ð¸Ñ‡Ð½Ð¸ Ñ€Ð°Ð·Ð³Ð¾Ð²Ð¾Ñ€Ð¸</span>
      </div>
    </section>

    <section className="auth-panel" aria-label={register ? "Ð ÐµÐ³Ð¸ÑÑ‚Ñ€Ð°Ñ†Ð¸Ñ" : "Ð’Ñ…Ð¾Ð´"}>
      <form className="auth-form" onSubmit={submit}>
        <header>
          <span className="auth-form-mark">{register ? "+" : "â†—"}</span>
          <div><h2>{register ? "Ð¡ÑŠÐ·Ð´Ð°Ð¹ ÑÐ²Ð¾Ñ Ð¿Ñ€Ð¾Ñ„Ð¸Ð»" : "Ð”Ð¾Ð±Ñ€Ðµ Ð´Ð¾ÑˆÑŠÐ» Ð¾Ñ‚Ð½Ð¾Ð²Ð¾"}</h2><p>{register ? "Ð—Ð°Ð¿Ð¾Ñ‡Ð²Ð°Ñˆ Ð½ÐµÐ²Ð¸Ð´Ð¸Ð¼. Ð¢Ð¸ Ñ€ÐµÑˆÐ°Ð²Ð°Ñˆ ÐºÐ¾Ð³Ð° Ð´Ð° ÑÐµ Ð¿Ð¾ÐºÐ°Ð¶ÐµÑˆ." : "Ð’Ð»ÐµÐ· Ð¸ Ð²Ð¸Ð¶ ÐºÐ°ÐºÐ²Ð¾ ÑÐµ ÑÐ»ÑƒÑ‡Ð²Ð° Ð¾ÐºÐ¾Ð»Ð¾ Ñ‚ÐµÐ±."}</p></div>
        </header>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <label>Ð˜Ð¼ÐµÐ¹Ð»<input name="email" type="email" autoComplete="email" placeholder="you@email.com" required /></label>
        {register && <div className="auth-form-split">
          <label>ÐŸÐ¾Ñ‚Ñ€ÐµÐ±Ð¸Ñ‚ÐµÐ»ÑÐºÐ¾ Ð¸Ð¼Ðµ<input name="handle" pattern="[a-zA-Z0-9_]{3,24}" title="3â€“24 Ð»Ð°Ñ‚Ð¸Ð½ÑÐºÐ¸ Ð±ÑƒÐºÐ²Ð¸, Ñ†Ð¸Ñ„Ñ€Ð¸ Ð¸Ð»Ð¸ _" placeholder="alex_01" required /></label>
          <label>Ð˜Ð¼Ðµ Ð·Ð° Ð¿Ð¾ÐºÐ°Ð·Ð²Ð°Ð½Ðµ<input name="displayName" autoComplete="name" placeholder="ÐÐ»ÐµÐºÑ" required /></label>
        </div>}
        {register && <label>Ð”Ð°Ñ‚Ð° Ð½Ð° Ñ€Ð°Ð¶Ð´Ð°Ð½Ðµ<input name="dateOfBirth" type="date" required /></label>}
        <label>ÐŸÐ°Ñ€Ð¾Ð»Ð°<input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={8} placeholder="ÐœÐ¸Ð½Ð¸Ð¼ÑƒÐ¼ 8 ÑÐ¸Ð¼Ð²Ð¾Ð»Ð°" required /></label>
        {register && <label className="auth-adult"><input name="declaredAdult" type="checkbox" required /><span>Ð”ÐµÐºÐ»Ð°Ñ€Ð¸Ñ€Ð°Ð¼, Ñ‡Ðµ ÑÑŠÐ¼ Ð½Ð° 18+.</span></label>}
        <button className="auth-submit" disabled={submitting}>{submitting ? "ÐœÐ¾Ð¼ÐµÐ½Ñ‚â€¦" : register ? "Ð¡ÑŠÐ·Ð´Ð°Ð¹ Ð¿Ñ€Ð¾Ñ„Ð¸Ð»" : "Ð’Ð»ÐµÐ· Ð² Follow Me"}<span>â†’</span></button>
      </form>
      <p className="auth-footer">{register ? "Ð’ÐµÑ‡Ðµ Ð¸Ð¼Ð°Ñˆ Ð¿Ñ€Ð¾Ñ„Ð¸Ð»? " : "ÐÑÐ¼Ð°Ñˆ Ð¿Ñ€Ð¾Ñ„Ð¸Ð»? "}<button type="button" onClick={() => { setRegister(!register); setError(""); }}>{register ? "Ð’Ð»ÐµÐ·" : "Ð ÐµÐ³Ð¸ÑÑ‚Ñ€Ð¸Ñ€Ð°Ð¹ ÑÐµ"}</button></p>
    </section>
  </main>;
}
