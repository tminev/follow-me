"use client";

import { useEffect, useId, useRef, useState } from "react";
import { distanceInMeters } from "@/lib/discovery-radius";
import type { MapMarker } from "./MapCanvas";
import "./PeopleDirectory.css";

export type DirectoryPerson = {
  id: string;
  handle: string;
  profile: { displayName: string; avatarUrl?: string | null; city?: string | null; neighborhood?: string | null } | null;
};
type DirectoryRequest = { id: string; sender?: DirectoryPerson };
type NavigationProps = { active: "map" | "people" | "profile"; onMap: () => void; onPeople: () => void; onProfile: () => void };

export function NavigationIcon({ name }: { name: "map" | "people" | "profile" | "chat" }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{name === "map" ? <path d="M12 22s7-8 7-14a7 7 0 0 0-14 0c0 6 7 14 7 14Zm0-11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    : name === "people" ? <><path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-2a7 7 0 0 1 14 0v2H2Z" /><path d="M17 5a3 3 0 1 1 0 6m2 4c2 1 3 3 3 6h-3" /></>
      : name === "chat" ? <path d="M21 11a9 9 0 0 1-9 9H9l-6 2 2-6a9 9 0 1 1 16-5ZM8 11h.01M12 11h.01M16 11h.01" />
        : <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 22v-3a8 8 0 0 1 16 0v3H4Z" />}</svg>;
}

export function BottomNavigation({ active, onMap, onPeople, onProfile }: NavigationProps) {
  return <nav className="app-bottom-navigation" aria-label="Основна навигация">
    {([{ key: "map", label: "Карта", onClick: onMap }, { key: "people", label: "Хора", onClick: onPeople }, { key: "profile", label: "Профил", onClick: onProfile }] as const).map(({ key, label, onClick }) =>
      <button key={key} type="button" aria-current={active === key ? "page" : undefined} onClick={onClick}><NavigationIcon name={key} /><span>{label}</span></button>)}
  </nav>;
}

export function PeopleDirectory({ friends, requests, nearby, ownPosition, unreadHandles, loading, loadError, onRetry, onClose, onChat, onLocate, onRespond, onMap, onProfile }: {
  friends: DirectoryPerson[]; requests: DirectoryRequest[]; nearby: MapMarker[];
  ownPosition?: { latitude: number; longitude: number }; unreadHandles: Set<string>;
  loading: boolean; loadError: string; onRetry: () => void;
  onClose: () => void; onChat: (person: DirectoryPerson) => void; onLocate: (person: MapMarker) => void;
  onRespond: (requestId: string, action: "accept" | "decline") => Promise<void>;
  onMap: () => void; onProfile: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"friends" | "requests">("friends");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string>();
  const responding = useRef(false);
  const [error, setError] = useState("");
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; opener?.focus(); };
  }, []);

  async function respond(requestId: string, action: "accept" | "decline") {
    if (responding.current) return;
    responding.current = true;
    setBusyId(requestId);
    setError("");
    try { await onRespond(requestId, action); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Поканата не беше обработена. Опитай отново."); }
    finally { responding.current = false; setBusyId(undefined); }
  }

  const search = query.trim().toLocaleLowerCase("bg");
  const visibleFriends = friends.filter((person) => `${person.profile?.displayName ?? person.handle} ${person.profile?.city ?? ""}`.toLocaleLowerCase("bg").includes(search));
  const visibleRequests = requests.filter(({ sender }) => sender && `${sender.profile?.displayName ?? sender.handle} ${sender.profile?.city ?? ""}`.toLocaleLowerCase("bg").includes(search));
  function identity(person: DirectoryPerson, point?: MapMarker) {
    const name = person.profile?.displayName || person.handle;
    const meters = ownPosition && point ? distanceInMeters(ownPosition, point) : undefined;
    return <>
      {person.profile?.avatarUrl ? <img className="people-card-photo" src={person.profile.avatarUrl} alt="" /> : <div className="people-card-placeholder" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</div>}
      {point && <span className="people-card-presence" role="img" aria-label="Споделя местоположение" title="Споделя местоположение" />}
      <div className="people-card-copy"><h3>{name}{unreadHandles.has(person.handle) && <span className="people-card-unread" aria-label="Ново съобщение" role="img" />}</h3>
        <p><NavigationIcon name="map" />{person.profile?.city || "Без посочен град"}</p>
        {meters !== undefined && <p>На {meters < 1000 ? `${Math.max(10, Math.round(meters / 10) * 10)} м` : `${(meters / 1000).toFixed(1)} км`}</p>}
      </div>
    </>;
  }

  return <dialog ref={dialog} className="people-directory-modal" aria-labelledby={`${id}-title`} onCancel={(event) => { event.preventDefault(); onClose(); }}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, input, [tabindex="0"]')).filter((node) => !node.matches(":disabled") && node.tabIndex >= 0 && node.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <div className="people-directory-heading"><h2 id={`${id}-title`}>Карта и хора</h2><button type="button" aria-label="Затвори хора и покани" onClick={onClose}>×</button></div>
    <div className="people-directory-tabs" role="tablist" aria-label="Хора и покани" onKeyDown={(event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? "friends" : event.key === "End" ? "requests" : tab === "friends" ? "requests" : "friends";
      setTab(next);
      setQuery("");
      dialog.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(`${id}-${next}-tab`)}`)?.focus();
    }}>
      <button type="button" id={`${id}-friends-tab`} role="tab" aria-selected={tab === "friends"} aria-controls={`${id}-friends-panel`} tabIndex={tab === "friends" ? 0 : -1} onClick={() => { setTab("friends"); setQuery(""); }}><NavigationIcon name="people" />Приятели</button>
      <button type="button" id={`${id}-requests-tab`} role="tab" aria-selected={tab === "requests"} aria-controls={`${id}-requests-panel`} tabIndex={tab === "requests" ? 0 : -1} onClick={() => { setTab("requests"); setQuery(""); }}><NavigationIcon name="profile" />Покани{requests.length > 0 && <span className="people-request-count">{requests.length}</span>}</button>
    </div>
    <label className="people-directory-search"><span className="people-visually-hidden">{tab === "friends" ? "Търси приятел" : "Търси покана"}</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="m15 15 6 6" /></svg><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "friends" ? "Търси приятел…" : "Търси покана…"} /></label>
    <div className="people-directory-content" aria-busy={loading}>
      {loadError && <div className="people-directory-error" role="alert"><p>{loadError}</p><button type="button" onClick={onRetry}>Опитай отново</button></div>}
      {loading && !friends.length && !requests.length ? <p className="people-directory-empty" role="status">Зареждане…</p> : <>
        <div id={`${id}-friends-panel`} role="tabpanel" aria-labelledby={`${id}-friends-tab`} hidden={tab !== "friends"} tabIndex={0}>
          <div className="people-directory-grid">{visibleFriends.map((person) => {
            const point = nearby.find((item) => item.id === person.id);
            const name = person.profile?.displayName || person.handle;
            return <article key={person.id} className="people-card">{identity(person, point)}<div className="people-card-actions">
              <button type="button" className="people-card-chat" aria-label={`Отвори чат с ${name}`} onClick={() => onChat(person)}><NavigationIcon name="chat" /></button>
              <button type="button" className="people-card-locate" aria-label={`Покажи ${name} на картата`} title={point ? "Покажи на картата" : "Няма споделена позиция в твоя радиус"} disabled={!point} onClick={() => { if (point) onLocate(point); }}><NavigationIcon name="map" /></button>
            </div></article>;
          })}</div>
          {!visibleFriends.length && !loading && !loadError && <p className="people-directory-empty">{search ? "Няма приятели с това име или град." : "Все още нямаш приятели. Изпрати покана на човек от картата."}</p>}
        </div>
        <div id={`${id}-requests-panel`} role="tabpanel" aria-labelledby={`${id}-requests-tab`} hidden={tab !== "requests"} tabIndex={0}>
          <div className="people-directory-grid">{visibleRequests.map((request) => request.sender && <article key={request.id} className="people-card people-invitation-card">{identity(request.sender)}<div className="people-card-actions">
            <button type="button" className="people-card-chat" disabled={!!busyId} onClick={() => void respond(request.id, "accept")}>{busyId === request.id ? "Изчакай…" : "Приеми"}</button>
            <button type="button" className="people-card-decline" disabled={!!busyId} onClick={() => void respond(request.id, "decline")}>Откажи</button>
          </div></article>)}</div>
          {!visibleRequests.length && !loading && !loadError && <p className="people-directory-empty">{search ? "Няма покани с това име или град." : "Нямаш нови покани."}</p>}
        </div>
      </>}
      {error && <p className="people-directory-error" role="alert">{error}</p>}
    </div>
    <BottomNavigation active="people" onMap={onMap} onPeople={() => { setTab("friends"); setQuery(""); }} onProfile={onProfile} />
  </dialog>;
}
