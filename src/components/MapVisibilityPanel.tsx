"use client";

import { useRef, useState } from "react";
import "./MapVisibilityPanel.css";

export function MapVisibilityPanel({ continuous, radiusMeters, onStop }: {
  continuous: boolean;
  radiusMeters?: number;
  onStop: () => Promise<void>;
}) {
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  async function stop() {
    if (inFlight.current) return;
    inFlight.current = true;
    setStopping(true);
    setError("");
    try { await onStop(); }
    catch { setError("Видимостта не беше спряна. Опитай отново."); }
    finally { inFlight.current = false; setStopping(false); }
  }

  return <section className="map-visibility-panel" aria-label="Управление на видимостта">
    <div className="map-visibility-panel-copy">
      <span className="map-visibility-panel-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg></span>
      <div><h2>{continuous ? "Видим постоянно" : "Видим за 15 мин."}</h2>
        {radiusMeters !== undefined && <small>Радиус: {radiusMeters >= 1000 ? `${radiusMeters / 1000} км` : `${radiusMeters} м`}</small>}
      </div>
    </div>
    <button type="button" className="map-visibility-stop" disabled={stopping} onClick={() => void stop()}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10 5.2c.6-.1 1.3-.2 2-.2 6 0 10 7 10 7a21 21 0 0 1-3.2 4M6 6.3C3.5 8.4 2 12 2 12s4 7 10 7c1.7 0 3.2-.5 4.5-1.2M10 10a3 3 0 0 0 4 4" /></svg>
      {stopping ? "Спиране…" : "Спри видимостта"}
    </button>
    {error && <p className="map-visibility-panel-error" role="alert">{error}</p>}
  </section>;
}
