"use client";

import { useEffect, useState } from "react";

type Report = { id: string; category: string; details?: string | null; status: string; createdAt: string; reporter: { handle: string; profile: { displayName: string } | null }; targetUser: { id: string; handle: string; accountStatus: string; profile: { displayName: string } | null } | null };

async function api(path: string, init?: RequestInit) { const response = await fetch(`/api/v1${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message ?? "Грешка"); return data; }

export default function ModerationPage() {
  const [reports, setReports] = useState<Report[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState("");
  const load = () => api("/moderation/reports").then((data) => setReports(data.reports)).catch((reason: Error) => setError(reason.message));
  useEffect(() => { load(); }, []);
  const decide = async (reportId: string, decision: string, restriction: string) => { const reason = window.prompt("Причина за решението:", "Прегледан сигнал")?.trim(); if (!reason) return; setBusy(reportId); try { await api("/moderation/reports", { method: "POST", body: JSON.stringify({ reportId, decision, restriction, reason }) }); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Грешка"); } finally { setBusy(""); } };
  return <main className="moderation-page"><header><a href="/">← Follow Me</a><h1>Модерация</h1></header>{error && <p className="error">{error}</p>}<div className="moderation-list">{reports.map((report) => <article key={report.id} className="moderation-report"><div><small>{report.status} · {new Date(report.createdAt).toLocaleString("bg-BG")}</small><h2>{report.category}</h2><p><b>Подател:</b> {report.reporter.profile?.displayName ?? `@${report.reporter.handle}`}</p><p><b>Докладван:</b> {report.targetUser?.profile?.displayName ?? `@${report.targetUser?.handle ?? "изтрит профил"}`}</p>{report.details && <p className="moderation-details">{report.details}</p>}</div><div className="moderation-actions"><button disabled={busy === report.id} onClick={() => void decide(report.id, "UNDER_REVIEW", "NONE")}>В преглед</button><button disabled={busy === report.id} onClick={() => void decide(report.id, "RESOLVED", "RESTRICTED")}>Ограничи</button><button disabled={busy === report.id} onClick={() => void decide(report.id, "RESOLVED", "SUSPENDED")}>Спри</button><button disabled={busy === report.id} onClick={() => void decide(report.id, "RESOLVED", "BANNED")}>Блокирай</button><button disabled={busy === report.id} onClick={() => void decide(report.id, "DISMISSED", "NONE")}>Отхвърли</button></div></article>)}{!reports.length && !error && <p>Няма сигнали за преглед.</p>}</div></main>;
}
