"use client";

import { useRef, useState } from "react";
import "./BlockButton.css";

export function BlockButton({ name, onBlock, iconOnly = false }: { name: string; onBlock: () => Promise<void>; iconOnly?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function block() {
    if (inFlight.current || !window.confirm(`Да блокираш ${name}? Приятелството ще бъде премахнато и няма да можете да си пишете.`)) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try { await onBlock(); }
    catch { setError("Неуспешно блокиране. Опитай отново."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <span className="block-action">
    <button type="button" className={`block-button${iconOnly ? " block-button-icon" : ""}`} aria-label={`Блокирай ${name}`} title={`Блокирай ${name}`} disabled={busy} aria-busy={busy} onClick={() => void block()}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></svg>
      {!iconOnly && <span>{busy ? "Блокиране…" : "Блокирай"}</span>}
    </button>
    {error && <span className="block-action-error" role="alert">{error}</span>}
  </span>;
}
