"use client";

import { useEffect, useState } from "react";

type PushStatus = "loading" | "enabled" | "disabled" | "unavailable";

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? "Грешка");
  return data;
}

function decodeApplicationServerKey(key: string) {
  const base64 = key.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = window.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
  return bytes;
}

export function PushNotifications({ notify }: { notify: (message: string) => void }) {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!window.isSecureContext || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unavailable");
      return;
    }
    api("/push-subscriptions")
      .then(async (settings) => {
        if (!settings.configured || !settings.publicKey) {
          setStatus("unavailable");
          return;
        }
        const registration = await navigator.serviceWorker.register("/sw.js");
        setStatus(await registration.pushManager.getSubscription() ? "enabled" : "disabled");
      })
      .catch((error: unknown) => {
        setStatus("unavailable");
        notify(error instanceof Error ? error.message : "Push известията не могат да бъдат проверени.");
      });
  }, [notify]);

  async function toggle() {
    setBusy(true);
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window) || !window.isSecureContext) {
        throw new Error("Push известията изискват поддържан браузър и защитена HTTPS връзка.");
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const current = await registration.pushManager.getSubscription();
      if (status === "enabled" && current) {
        await api("/push-subscriptions", { method: "DELETE", body: JSON.stringify({ endpoint: current.endpoint }) });
        await current.unsubscribe();
        setStatus("disabled");
        notify("Push известията за Follow Me са изключени.");
        return;
      }
      const settings = await api("/push-subscriptions");
      if (!settings.configured || !settings.publicKey) {
        throw new Error("Push известията не са конфигурирани на сървъра.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Разреши известията в настройките на браузъра.");
      const subscription = current ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(settings.publicKey),
      });
      await api("/push-subscriptions", { method: "POST", body: JSON.stringify(subscription) });
      setStatus("enabled");
      notify("Push известията за Follow Me са включени.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Push известията не могат да бъдат настроени.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className="ghost small"
      aria-label="Push известия за целия сайт"
      title="Настрой push известията за покани и чат из целия сайт"
      disabled={busy || status === "loading" || status === "unavailable"}
      onClick={toggle}
    >
      {busy
        ? "Настройване…"
        : status === "loading"
          ? "Зареждане…"
          : status === "unavailable"
            ? "Push не е настроен"
            : status === "enabled"
              ? "Push за сайта: включени"
              : "Включи push за сайта"}
    </button>
  );
}
