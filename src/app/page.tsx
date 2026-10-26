"use client";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { PushNotifications } from "@/components/PushNotifications";
import { AuthLanding } from "@/components/AuthLanding";
import type { MapMarker } from "@/components/MapCanvas";
import type { ChatClientEvents, ChatMessage, ChatServerEvents } from "@/lib/chat-socket";
import { parseProfileVisibility } from "@/lib/profile-visibility";
const MapCanvas = dynamic(() => import("@/components/MapCanvas"), { ssr: false, loading: () => <div className="map-loading">Зареждане на картата…</div> });
type ProfileData = { displayName: string; bio?: string | null; city?: string | null; neighborhood?: string | null; avatarUrl?: string | null; heightCm?: number | null; hairColor?: string | null; interestsText?: string | null; lookingFor?: string | null; favoriteMovie?: string | null; favoriteBook?: string | null; occupation?: string | null; education?: string | null; languages?: string | null; weekendStyle?: string | null; firstDateIdea?: string | null; profileVisibility?: string | null }; type Me = { id: string; handle: string; declaredAdult: boolean; ageVerificationStatus: string; profile: ProfileData }; type Person = { id: string; handle: string; isLocationVisible?: boolean; lastActiveAt?: string | null; profile: ProfileData }; type RequestItem = { id: string; status: string; sender?: Person; receiver?: Person }; type Conversation = { id: string; person: Person; lastMessage?: { body: string } };
type ChatAlert = { id: string; sender: { handle: string; displayName: string }; body: string };
async function api(path: string, init?: RequestInit) { const r = await fetch(`/api/v1${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } }); const text = await r.text(); let data: unknown; try { data = text ? JSON.parse(text) : {} } catch { throw new Error(r.status === 502 ? "Връзката към локалния сървър е прекъсната. Рестартирай тунела и опитай отново." : "Сървърът върна невалиден отговор.") } if (!r.ok) throw new Error(typeof data === "object" && data !== null && "message" in data ? String(data.message) : "Грешка"); return data }
export default function Home() {
  const [me, setMe] = useState<Me | null | undefined>();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [chatAlerts, setChatAlerts] = useState<ChatAlert[]>([]);
  const [incomingRequestVersion, setIncomingRequestVersion] = useState(0);
  const refresh = () => api("/me").then((data) => setMe(data.user)).catch(() => setMe(null));
  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
      setProfileOpen(false);
      setMe(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Неуспешен изход от профила.");
    }
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => { if (!profileOpen) return; const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setProfileOpen(false); }; window.addEventListener("keydown", closeOnEscape); return () => window.removeEventListener("keydown", closeOnEscape); }, [profileOpen]);
  useEffect(() => {
    if (!me) return;
    const client = io() as Socket<ChatServerEvents, ChatClientEvents>;
    client.on("notification:friend-request", ({ sender }) => {
      setNotice(`Нова покана от ${sender.displayName} (@${sender.handle}).`);
      setIncomingRequestVersion((version) => version + 1);
    });
    client.on("notification:friend-request-updated", ({ status, recipient }) => setNotice(status === "ACCEPTED" ? `${recipient.displayName} прие поканата ти.` : `${recipient.displayName} отказа поканата ти.`));
    client.on("notification:message", ({ sender, message }) => { setNotice(`Ново съобщение от ${sender.displayName}: ${message.body.slice(0, 80)}`); setChatAlerts((alerts) => [{ id: message.id, sender, body: message.body }, ...alerts.filter((alert) => alert.id !== message.id)].slice(0, 5)); });
    return () => client.disconnect();
  }, [me]);

  if (me === undefined) return <main className="center"><div className="loader" />Зареждане…</main>;
  if (!me) return <AuthLanding onDone={refresh} />;

  return <main className="shell">
    <header>
      <div className="brand"><img src="/follow-me-logo.png" alt="Follow Me" onError={(event) => { event.currentTarget.style.display = "none"; }} /><span className="brand-wordmark">Follow<span>Me</span></span><small>Свързване с контрол</small></div>
      <div className="actions">
        <PushNotifications notify={setNotice} />
        <button className="profile-trigger" aria-label="Отвори профила" title="Профил" onClick={() => setProfileOpen(true)}>
          {me.profile.avatarUrl ? <img src={me.profile.avatarUrl} alt="" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.42 0-8 2.01-8 4.5V20h16v-1.5c0-2.49-3.58-4.5-8-4.5Z" /></svg>}
        </button>
        <button type="button" className="ghost small header-logout" onClick={() => void logout()}>Изход</button>
      </div>
    </header>
    {notice && <div className="notice">{notice}</div>}
    <section className="content one-page">
      <section id="map" className="one-page-section"><MapPanel me={me} notify={setNotice} chatAlerts={chatAlerts} onReadMessages={(handle) => setChatAlerts((alerts) => alerts.filter((alert) => alert.sender.handle !== handle))} /></section>
    </section>
    {profileOpen && <div className="profile-modal-backdrop" role="presentation" onMouseDown={() => setProfileOpen(false)}>
      <section className="profile-modal" role="dialog" aria-modal="true" aria-label="Твоят профил" onMouseDown={(event) => event.stopPropagation()}>
        <Profile me={me} reload={refresh} notify={setNotice} onClose={() => setProfileOpen(false)} />
      </section>
    </div>}
  </main>;
}
function Discover({ notify }: { notify: (x: string) => void }) { const [users, setUsers] = useState<Person[]>([]); useEffect(() => { api("/discover/users").then(x => setUsers(x.users)) }, []); return <Panel title="Открий хора" subtitle="Публични профили без имейл, рождена дата или местоположение."><Grid>{users.map(u => <PersonCard key={u.id} p={u}><button className="primary small" onClick={async () => { try { await api("/friend-requests", { method: "POST", body: JSON.stringify({ recipientId: u.id }) }); notify("Поканата е изпратена.") } catch (e) { notify((e as Error).message) } }}>Добави</button></PersonCard>)}</Grid></Panel> }
function Requests({ notify, refreshToken }: { notify: (x: string) => void; refreshToken: number }) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [processingId, setProcessingId] = useState<string>();
  const load = useCallback(() => api("/friend-requests?direction=incoming").then((data) => setItems(data.requests)), []);

  useEffect(() => {
    load().catch((error: unknown) => notify(error instanceof Error ? error.message : "Поканите не могат да бъдат заредени."));
  }, [load, notify, refreshToken]);

  async function respond(id: string, action: "accept" | "decline") {
    setProcessingId(id);
    try {
      await api(`/friend-requests/${id}/${action}`, { method: "POST" });
      await load();
      if (action === "accept") notify("Вече сте приятели.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Поканата не можа да бъде обработена.");
      if (action === "accept") {
        load().catch((loadError: unknown) => notify(loadError instanceof Error ? loadError.message : "Поканите не могат да бъдат заредени."));
      }
    } finally {
      setProcessingId(undefined);
    }
  }

  return <Panel title="Покани" subtitle="Приеми само хора, които разпознаваш.">
    <Grid>{items.map((request) =>
      <PersonCard key={request.id} p={request.sender!}><div className="actions">
        <button className="primary small" disabled={processingId === request.id} onClick={() => respond(request.id, "accept")}>Приеми</button>
        <button className="ghost small" disabled={processingId === request.id} onClick={() => respond(request.id, "decline")}>Откажи</button>
      </div></PersonCard>,
    )}</Grid>
  </Panel>;
}
function Chats({ meId, openPersonId, embedded = false, onBack, onBlock }: { meId: string; openPersonId?: string; embedded?: boolean; onBack?: () => void; onBlock?: () => void }) {
  const [list, setList] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket<ChatServerEvents, ChatClientEvents> | null>(null);
  const activeId = useRef<string | null>(null);

  const loadMessages = useCallback((id: string) => {
    api(`/conversations/${id}/messages`)
      .then((data) => {
        if (activeId.current === id) setMessages(data.messages);
      })
      .catch((reason: unknown) => {
        if (activeId.current === id) setError(reason instanceof Error ? reason.message : "Грешка при зареждане на съобщенията.");
      });
  }, []);

  useEffect(() => {
    api("/conversations").then((data) => setList(data.conversations));
  }, []);

  useEffect(() => {
    const conversation = list.find((item) => item.person?.id === openPersonId);
    if (!conversation) return;
    activeId.current = conversation.id;
    setMessages([]);
    setError("");
    setActive(conversation);
  }, [list, openPersonId]);

  useEffect(() => {
    const client = io({ autoConnect: false }) as Socket<ChatServerEvents, ChatClientEvents>;
    socketRef.current = client;
    client.on("connect_error", () => {
      setConnected(false);
      setError("Връзката с чата е прекъсната. Прави се нов опит за свързване.");
    });
    client.on("connect", () => {
      setConnected(true);
      setError("");
      const id = activeId.current;
      if (!id) return;
      client.emit("chat:join", { conversationId: id }, (result) => {
        if (!result.ok) setError("Нямате достъп до този разговор.");
      });
      loadMessages(id);
    });
    client.on("chat:message", ({ conversationId, message }) => {
      setList((previous) => previous.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, lastMessage: { body: message.body } }
          : conversation,
      ));
      if (activeId.current === conversationId) {
        setMessages((previous) => previous.some((item) => item.id === message.id) ? previous : [...previous, message]);
      }
    });
    client.on("disconnect", () => setConnected(false));
    client.connect();
    return () => {
      socketRef.current = null;
      client.disconnect();
    };
  }, [loadMessages]);

  useEffect(() => {
    const id = active?.id;
    if (!id) return;
    loadMessages(id);
    const client = socketRef.current;
    if (client?.connected) {
      client.emit("chat:join", { conversationId: id }, (result) => {
        if (!result.ok) setError("Нямате достъп до този разговор.");
      });
    }
    return () => {
      if (client?.connected) client.emit("chat:leave", { conversationId: id });
    };
  }, [active, loadMessages]);

  function selectConversation(conversation: Conversation) {
    activeId.current = conversation.id;
    setMessages([]);
    setError("");
    setActive(conversation);
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const conversation = active;
    const client = socketRef.current;
    if (!conversation || !client?.connected) {
      setError("Няма връзка с чата. Опитай отново след свързване.");
      return;
    }
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body"));
    client.emit("chat:send", { conversationId: conversation.id, body }, (result) => {
      if (result.ok) {
        form.reset();
        setError("");
      } else {
        setError(result.error === "BLOCKED" ? "Съобщението не може да бъде изпратено." : "Неуспешно изпращане на съобщението.");
      }
    });
  }

  const chatLayout = <div className="chat-layout">
    <aside>{list.map((conversation) => <button key={conversation.id} onClick={() => selectConversation(conversation)} className={active?.id === conversation.id ? "selected" : ""}>
      <b>{conversation.person?.profile.displayName}</b><small>{conversation.lastMessage?.body ?? "Нов разговор"}</small>
    </button>)}</aside>
    <div className="thread">{active ? <>
      <h3>{active.person.profile.displayName}</h3>
      {error && <p className="error">{error}</p>}
      <div className="messages">{messages.map((message) => <p key={message.id} className={`bubble ${(message.isMine ?? (message.senderId === meId)) ? "mine" : "theirs"}`}>{message.body}</p>)}</div>
      <form onSubmit={send} className="send"><textarea name="body" rows={1} placeholder="Напиши съобщение…" required disabled={!connected} onInput={(event) => { const field = event.currentTarget; field.style.height = "auto"; field.style.height = `${Math.min(field.scrollHeight, 160)}px`; }} /><button className="primary" disabled={!connected}>Изпрати</button></form>
    </> : <div className="empty">Избери разговор</div>}</div>
  </div>;
  if (embedded) return <div className="map-chat-replacement"><div className="map-chat-head"><button className="ghost small" onClick={onBack}>← Към картата</button><span>{connected ? "Чат на живо" : "Свързване…"}</span>{onBlock && <button className="chat-block" onClick={onBlock}>Блокирай</button>}</div>{chatLayout}</div>;
  return <Panel title="Чат" subtitle={connected ? "Свързан в реално време. Съобщенията са видими само за участниците." : "Свързване с чата…"}>{chatLayout}</Panel>;
}
function MapPanel({ me, notify, chatAlerts, onReadMessages }: { me: Me; notify: (x: string) => void; chatAlerts: ChatAlert[]; onReadMessages: (handle: string) => void }) {
  const [state, setState] = useState<{ visible: boolean; session?: { continuous?: boolean } | null }>();
  const [nearby, setNearby] = useState<MapMarker[]>([]);
  const [discoveryRadius, setDiscoveryRadius] = useState<{ meters: number; loyaltyLabel: string }>();
  const [people, setPeople] = useState<Person[]>([]);
  const [cityQuery, setCityQuery] = useState("");
  const [audience, setAudience] = useState<"all" | "friends" | "others">("all");
  const [sortBy, setSortBy] = useState<"distance" | "interests" | "activity">("distance");
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [invitesOpen, setInvitesOpen] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState<RequestItem>();
  const [selectedPublicProfile, setSelectedPublicProfile] = useState<Person>();
  const [selectedFriendId, setSelectedFriendId] = useState<string>();
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [drawerHandleY, setDrawerHandleY] = useState(220);
  const drawerHandleMoved = useRef(false);
  const [ownPosition, setOwnPosition] = useState<{ latitude: number; longitude: number }>();
  const interestTerms = (value?: string | null) => new Set((value ?? "").toLocaleLowerCase("bg").split(/[;,|\n]+/).map((item) => item.trim()).filter(Boolean));
  const ownInterests = interestTerms(me.profile.interestsText);
  const distanceToPerson = (person: Person) => {
    const marker = nearby.find((item) => item.id === person.id);
    if (!ownPosition || !marker) return Number.POSITIVE_INFINITY;
    const earthRadius = 6_371_000;
    const radians = (value: number) => value * Math.PI / 180;
    const latitude = radians(marker.latitude - ownPosition.latitude);
    const longitude = radians(marker.longitude - ownPosition.longitude);
    const value = Math.sin(latitude / 2) ** 2 + Math.cos(radians(ownPosition.latitude)) * Math.cos(radians(marker.latitude)) * Math.sin(longitude / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  };
  const sharedInterestCount = (person: Person) => [...interestTerms(person.profile.interestsText)].filter((item) => ownInterests.has(item)).length;
  const proximityState = useRef(new Map<string, boolean>());
  const lastLocationSent = useRef<{ latitude: number; longitude: number; sentAt: number }>();
  const load = async () => { const next = await api("/visibility/me"); setState(next); if (next.visible) { const result = await api("/discovery/nearby") as { users: MapMarker[]; radiusMeters: number; loyaltyLabel: string }; setNearby(result.users); setDiscoveryRadius({ meters: result.radiusMeters, loyaltyLabel: result.loyaltyLabel }); } else { setNearby([]); setDiscoveryRadius(undefined); } };
  useEffect(() => { Promise.all([load(), api("/discover/users").then((result) => setPeople(result.users)), api("/friends").then((result) => setFriendIds(result.friends.map((person: Person) => person.id))), api("/friend-requests?direction=incoming").then((result) => setRequests(result.requests))]).catch((error) => notify((error as Error).message)) }, []);
  useEffect(() => { const timer = window.setInterval(() => { Promise.all([load(), api("/discover/users").then((result) => setPeople(result.users))]).catch((error) => notify((error as Error).message)) }, 15000); return () => window.clearInterval(timer) }, []);
  useEffect(() => {
    const client = io() as Socket<ChatServerEvents, ChatClientEvents>;
    const refreshMap = () => {
      void load().catch((error: unknown) => notify((error as Error).message));
    };
    client.on("map:refresh", refreshMap);
    return () => client.disconnect();
  }, []);
  useEffect(() => {
    if (!state?.visible || !navigator.geolocation) { lastLocationSent.current = undefined; return; }
    const distanceInMeters = (first: { latitude: number; longitude: number }, second: { latitude: number; longitude: number }) => {
      const earthRadius = 6_371_000;
      const radians = (value: number) => value * Math.PI / 180;
      const latitude = radians(second.latitude - first.latitude);
      const longitude = radians(second.longitude - first.longitude);
      const value = Math.sin(latitude / 2) ** 2 + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitude / 2) ** 2;
      return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
    };
    const watchId = navigator.geolocation.watchPosition((position) => {
      if (position.coords.accuracy > 500) return;
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setOwnPosition(next);
      const previous = lastLocationSent.current;
      const hasMoved = !previous || distanceInMeters(previous, next) >= 25;
      const hasWaited = !previous || Date.now() - previous.sentAt >= 30_000;
      if (!hasMoved && !hasWaited) return;
      lastLocationSent.current = { ...next, sentAt: Date.now() };
      void api("/visibility/location", { method: "PUT", body: JSON.stringify({ latitude: next.latitude, longitude: next.longitude, accuracyMeters: position.coords.accuracy }) }).catch(() => undefined);
    }, () => undefined, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [state?.visible]);
  useEffect(() => {
    if (!state?.visible || !ownPosition) { proximityState.current.clear(); return; }
    const distanceTo = (person: MapMarker) => {
      const radius = 6_371_000;
      const radians = (value: number) => value * Math.PI / 180;
      const latitude = radians(person.latitude - ownPosition.latitude);
      const longitude = radians(person.longitude - ownPosition.longitude);
      const value = Math.sin(latitude / 2) ** 2 + Math.cos(radians(ownPosition.latitude)) * Math.cos(radians(person.latitude)) * Math.sin(longitude / 2) ** 2;
      return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
    };
    const activeIds = new Set(nearby.map((person) => person.id));
    for (const person of nearby) {
      const isClose = distanceTo(person) <= 200;
      const wasClose = proximityState.current.get(person.id) ?? false;
      if (isClose && !wasClose) {
        const message = `${person.displayName} е на по-малко от 200 м от теб.`;
        notify(message);
        if ("Notification" in window && Notification.permission === "granted") new Notification("Follow Me: човек наблизо", { body: message });
        if ("vibrate" in navigator) navigator.vibrate([140, 80, 140]);
      }
      proximityState.current.set(person.id, isClose);
    }
    for (const id of proximityState.current.keys()) if (!activeIds.has(id)) proximityState.current.delete(id);
  }, [nearby, notify, ownPosition, state?.visible]);  const unreadHandles = new Set(chatAlerts.map((alert) => alert.sender.handle));
  const filteredPeople = people
    .filter((person) => audience === "all" || (audience === "friends" ? friendIds.includes(person.id) : !friendIds.includes(person.id)))
    .sort((first, second) => {
      const unreadOrder = Number(unreadHandles.has(second.handle)) - Number(unreadHandles.has(first.handle));
      if (unreadOrder) return unreadOrder;
      if (sortBy === "distance") return distanceToPerson(first) - distanceToPerson(second);
      if (sortBy === "interests") return sharedInterestCount(second) - sharedInterestCount(first) || first.profile.displayName.localeCompare(second.profile.displayName, "bg");
      return (Date.parse(second.lastActiveAt ?? "") || 0) - (Date.parse(first.lastActiveAt ?? "") || 0);
    });
  const cities = filteredPeople.reduce<Record<string, Person[]>>((groups, person) => { const city = person.profile.city?.trim() || "Без посочен град"; (groups[city] ??= []).push(person); return groups }, {});
  const visibleCities = Object.entries(cities).filter(([city]) => city.toLocaleLowerCase("bg").includes(cityQuery.trim().toLocaleLowerCase("bg"))).sort(([a], [b]) => a.localeCompare(b, "bg"));
  async function start(continuous = false) {
    try {
      if (!window.isSecureContext) throw new Error("За GPS на телефон отвори приложението през HTTPS адреса от npm run tunnel.");
      if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
      await api("/visibility/start", { method: "POST", body: JSON.stringify(continuous ? { continuous: true } : { durationMinutes: 15 }) });
      if (!navigator.geolocation) throw new Error("Браузърът няма геолокация.");
      let bestPoint: GeolocationPosition | undefined;
      let completed = false;
      let timeoutId: number | undefined;
      const publish = async (point: GeolocationPosition) => {
        if (completed) return;
        completed = true;
        if (timeoutId) window.clearTimeout(timeoutId);
        const position = { latitude: point.coords.latitude, longitude: point.coords.longitude };
        await api("/visibility/location", { method: "PUT", body: JSON.stringify({ latitude: point.coords.latitude, longitude: point.coords.longitude, accuracyMeters: point.coords.accuracy }) });
        setOwnPosition(position);
        notify(`${continuous ? "Постоянната видимост е включена." : "Видимостта е включена за 15 минути."} Точност: ±${Math.round(point.coords.accuracy)} m.`);
        await load();
      };
      const watchId = navigator.geolocation.watchPosition((point) => {
        if (!bestPoint || point.coords.accuracy < bestPoint.coords.accuracy) bestPoint = point;
        if (point.coords.accuracy <= 100) {
          navigator.geolocation.clearWatch(watchId);
          void publish(point);
        }
      }, (error) => notify(error.message), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      timeoutId = window.setTimeout(() => {
        navigator.geolocation.clearWatch(watchId);
        if (bestPoint && bestPoint.coords.accuracy <= 500) void publish(bestPoint);
        else notify(`Локацията не е достатъчно точна${bestPoint ? ` (±${Math.round(bestPoint.coords.accuracy)} m)` : ""}. Опитай на открито или включи точната локация за браузъра.`);
      }, 20000);
    } catch (error) { notify((error as Error).message) }
  }
  async function stop() { await api("/visibility/stop", { method: "POST" }); setNearby([]); setOwnPosition(undefined); notify("Видимостта е изключена."); await load() }
  async function respondToRequest(request: RequestItem, action: "accept" | "decline") { try { await api(`/friend-requests/${request.id}/${action}`, { method: "POST" }); setRequests((items) => items.filter((item) => item.id !== request.id)); if (action === "accept") { const result = await api("/friends"); setFriendIds(result.friends.map((person: Person) => person.id)); notify("Вече сте приятели.") } } catch (error) { notify((error as Error).message) } }
  async function block(person: Person) { try { await api(`/users/${person.id}/block`, { method: "POST" }); setFriendIds((ids) => ids.filter((id) => id !== person.id)); setPeople((items) => items.filter((item) => item.id !== person.id)); if (selectedFriendId === person.id) setSelectedFriendId(undefined); notify("Потребителят е блокиран.") } catch (error) { notify((error as Error).message) } }
  function moveDrawerHandle(event: React.PointerEvent<HTMLButtonElement>) { if (!window.matchMedia("(max-width: 800px)").matches) return; event.preventDefault(); const startY = event.clientY; const startTop = drawerHandleY; drawerHandleMoved.current = false; const move = (next: PointerEvent) => { const delta = next.clientY - startY; if (Math.abs(delta) > 4) drawerHandleMoved.current = true; setDrawerHandleY(Math.max(92, Math.min(window.innerHeight - 92, startTop + delta))) }; const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.setTimeout(() => { drawerHandleMoved.current = false }, 0) }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", end) }
  return <Panel title="Карта и хора" subtitle="Виж хора по градове; картата се отваря само при доброволно споделена локация.">
    <div className="map-directory">
<div className={`map-card ${selectedFriendId ? "showing-chat" : ""}`}><button className="mobile-directory-handle" style={{ top: drawerHandleY }} onPointerDown={moveDrawerHandle} onClick={() => { if (!drawerHandleMoved.current) setDirectoryOpen(true) }} aria-label="Отвори хора и известия"><b>☰</b></button>{selectedFriendId ? <Chats meId={me.id} openPersonId={selectedFriendId} embedded onBack={() => setSelectedFriendId(undefined)} onBlock={() => { const person = people.find((item) => item.id === selectedFriendId); if (person && window.confirm(`Сигурен ли си, че искаш да блокираш ${person.profile.displayName}?`)) void block(person) }} /> : state?.visible ? <><MapCanvas people={nearby} ownPosition={ownPosition} radiusMeters={discoveryRadius?.meters} onPersonClick={(person) => { if (person.profile) setSelectedPublicProfile({ id: person.id, handle: person.handle, profile: person.profile }); }} /><div className="map-radius" aria-live="polite"><b>Радиус на виждане</b><span>{discoveryRadius ? `${discoveryRadius.meters >= 1000 ? `${discoveryRadius.meters / 1000} км` : `${discoveryRadius.meters} м`} · ${discoveryRadius.loyaltyLabel}` : "Зареждане…"}</span></div><p>{state.session?.continuous ? (nearby.length > 0 ? "Видим си постоянно. Маркерите показват споделените позиции в твоя радиус." : "Видим си постоянно. В момента няма други хора с включена видимост в твоя радиус.") : (nearby.length > 0 ? "Видим си за ограничен срок. Маркерите показват споделените позиции в твоя радиус." : "Видим си за ограничен срок. В момента няма други хора с включена видимост в твоя радиус.")}</p><button className="danger" onClick={stop}>Спри веднага</button></> : <><div className="map-hidden-brand"><img src="/follow-me-logo.png" alt="Follow Me" /><b>СКРИТ СЪМ</b></div><p>{me.declaredAdult ? "Картата не се зарежда, докато не включиш доброволно видимост. Сесията изтича автоматично." : "Картата е достъпна само за профили, които са декларирали 18+ и са посочили пълнолетна възраст."}</p><div className="map-visibility-actions"><button className="primary" onClick={() => start()}>Включи за 15 мин.</button><button className="primary" onClick={() => start(true)}>Видим постоянно</button></div></>}</div>
      {directoryOpen && <button className="directory-backdrop" onClick={() => setDirectoryOpen(false)} aria-label="Затвори панела" />}<aside className={`city-directory ${directoryOpen ? "open" : ""}`}><button className="directory-close" onClick={() => setDirectoryOpen(false)} aria-label="Затвори списъка">×</button><div className="city-status-bar"><div className={`city-invites ${invitesOpen ? "open" : ""}`}><button className="invites-toggle" onClick={() => setInvitesOpen((open) => !open)} aria-expanded={invitesOpen}><span>Покани</span><b>{requests.length}</b></button><div className={`invites-list ${invitesOpen ? "open" : ""}`}>{requests.length > 0 ? requests.map((request) => { const sender = request.sender; const profile = sender?.profile; if (!sender || !profile) return null; return <button type="button" className="invite-summary" key={request.id} onClick={() => setSelectedInvite(request)}>{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span className="invite-avatar">{profile.displayName.slice(0, 1).toUpperCase()}</span>}<span className="invite-summary-copy"><b>{profile.displayName}</b><small>{[profile.city, profile.neighborhood].filter(Boolean).join(" · ") || "Градът не е посочен"}</small>{profile.lookingFor && <em>{profile.lookingFor}</em>}</span><i aria-hidden="true">›</i></button> }) : <small className="invites-empty">Няма нови покани.</small>}</div></div></div>{visibleCities.map(([city, cityPeople]) => <section key={city} className="city-group">{cityPeople.map((person) => { const isFriend = friendIds.includes(person.id); return <button key={person.id} className={`city-person ${selectedFriendId === person.id ? "selected" : ""}`} title={isFriend ? "Отвори чат" : "Изпрати покана"} onClick={async () => { if (isFriend) { const nextSelected = selectedFriendId === person.id ? undefined : person.id; setSelectedFriendId(nextSelected); if (nextSelected) { setDirectoryOpen(false); onReadMessages(person.handle); } return } setSelectedPublicProfile(person); setDirectoryOpen(false) }}><span>{person.profile.displayName.slice(0, 1).toUpperCase()}</span><div><b>{person.profile.displayName}{unreadHandles.has(person.handle) && <span className="city-message-badge" role="img" aria-label="Ново съобщение" title="Ново съобщение" />}{person.isLocationVisible && <svg className="location-live" viewBox="0 0 24 24" role="img" aria-label="Споделя локация"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" /></svg>}</b></div><span className="city-person-action" aria-hidden="true">{isFriend ? <svg viewBox="0 0 24 24"><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2h9A3.5 3.5 0 0 1 20 5.5v6a3.5 3.5 0 0 1-3.5 3.5H11l-4.6 4.1c-.65.57-1.65.11-1.65-.76V15.1A3.5 3.5 0 0 1 4 11.5v-6ZM8 8h8M8 11h5" /></svg> : <svg viewBox="0 0 24 24"><path d="M15 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20m6.5-9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19 8v6m-3-3h6" /></svg>}</span></button> })}</section>)}{visibleCities.length === 0 && <p className="city-empty">Няма намерени хора според избрания филтър.</p>}<div className="audience-filter" aria-label="Филтър хора"><button className={audience === "friends" ? "active" : ""} aria-pressed={audience === "friends"} onClick={() => setAudience(audience === "friends" ? "all" : "friends")}>Приятели</button><button className={audience === "others" ? "active" : ""} aria-pressed={audience === "others"} onClick={() => setAudience(audience === "others" ? "all" : "others")}>Останали</button></div><input className="city-search" value={cityQuery} onChange={(event) => setCityQuery(event.target.value)} placeholder="Търси град, например София" aria-label="Търси град" /><div className="directory-sort" role="group" aria-label={"\u041f\u043e\u0434\u0440\u0435\u0434\u0438 \u0445\u043e\u0440\u0430\u0442\u0430"}><button type="button" className={sortBy === "distance" ? "active" : ""} onClick={() => setSortBy("distance")}>{"\u0411\u043b\u0438\u0437\u043e\u0441\u0442"}</button><button type="button" className={sortBy === "interests" ? "active" : ""} onClick={() => setSortBy("interests")}>{"\u041e\u0431\u0449\u0438 \u0438\u043d\u0442\u0435\u0440\u0435\u0441\u0438"}</button><button type="button" className={sortBy === "activity" ? "active" : ""} onClick={() => setSortBy("activity")}>{"\u0410\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442"}</button></div></aside>
    </div>
    {selectedInvite?.sender && <InvitationPreview request={selectedInvite} onClose={() => setSelectedInvite(undefined)} onRespond={async (action) => { await respondToRequest(selectedInvite, action); setSelectedInvite(undefined); }} />}    {selectedPublicProfile && <PublicProfilePreview person={selectedPublicProfile} onClose={() => setSelectedPublicProfile(undefined)} onSend={async () => { try { await api("/friend-requests", { method: "POST", body: JSON.stringify({ recipientId: selectedPublicProfile.id }) }); notify("Поканата е изпратена."); setSelectedPublicProfile(undefined); } catch (error) { notify((error as Error).message); } }} onHideFromMap={async () => { if (!window.confirm(`Сигурен ли си, че искаш ${selectedPublicProfile.profile.displayName} да не вижда местоположението ти на картата?`)) return; try { await api(`/users/${selectedPublicProfile.id}/hide`, { method: "POST" }); setNearby((items) => items.filter((item) => item.id !== selectedPublicProfile.id)); notify("Вече си скрит от този човек на картата."); } catch (error) { notify((error as Error).message); } }} />}
  </Panel>
}
function PublicProfilePreview({ person, onClose, onSend, onHideFromMap }: { person: Person; onClose: () => void; onSend: () => Promise<void>; onHideFromMap: () => Promise<void> }) {
  const profile = person.profile;
  const rows = [{ label: "Ръст", value: profile.heightCm ? `${profile.heightCm} см` : null }, { label: "Коса", value: profile.hairColor }, { label: "Интереси", value: profile.interestsText }, { label: "Любим филм", value: profile.favoriteMovie }, { label: "Любима книга", value: profile.favoriteBook }, { label: "Занимание", value: profile.occupation }, { label: "Образование", value: profile.education }, { label: "Езици", value: profile.languages }, { label: "Уикенд", value: profile.weekendStyle }, { label: "Първа среща", value: profile.firstDateIdea }].filter((row): row is { label: string; value: string } => typeof row.value === "string" && row.value.trim().length > 0);
  return <div className="invitation-modal-backdrop" role="presentation" onMouseDown={onClose}><section className="invitation-modal" role="dialog" aria-modal="true" aria-label={`Публичен профил на ${profile.displayName}`} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" aria-label="Затвори профила" onClick={onClose}>×</button><div className="invitation-hero">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{profile.displayName.slice(0, 1).toUpperCase()}</span>}<div><p>Публичен профил</p><h2>{profile.displayName}</h2><small>{[profile.city, profile.neighborhood].filter(Boolean).join(" · ") || `@${person.handle}`}</small>{profile.lookingFor && <b>{profile.lookingFor}</b>}</div></div>{profile.bio && <p className="invitation-bio">{profile.bio}</p>}{rows.length > 0 && <dl className="invitation-details">{rows.map(({ label, value }) => <div key={label}><span className="invitation-detail-label">{label}</span><span className="invitation-detail-value">{value}</span></div>)}</dl>}<div className="invitation-actions"><button className="primary" onClick={() => void onSend()}>Изпрати покана</button><button type="button" className="profile-map-hide" onClick={() => void onHideFromMap()}>Скрий ме от този човек на картата</button></div></section></div>;
}function InvitationPreview({ request, onClose, onRespond }: { request: RequestItem; onClose: () => void; onRespond: (action: "accept" | "decline") => Promise<void> }) {
  const person = request.sender;
  if (!person) return null;
  const profile = person.profile;
  const rows = [{ label: "Ръст", value: profile.heightCm ? `${profile.heightCm} см` : null }, { label: "Коса", value: profile.hairColor }, { label: "Интереси", value: profile.interestsText }, { label: "Любим филм", value: profile.favoriteMovie }, { label: "Любима книга", value: profile.favoriteBook }, { label: "Занимание", value: profile.occupation }, { label: "Образование", value: profile.education }, { label: "Езици", value: profile.languages }, { label: "Уикенд", value: profile.weekendStyle }, { label: "Първа среща", value: profile.firstDateIdea }].filter((row): row is { label: string; value: string } => typeof row.value === "string" && row.value.trim().length > 0);
  return <div className="invitation-modal-backdrop" role="presentation" onMouseDown={onClose}><section className="invitation-modal" role="dialog" aria-modal="true" aria-label={`Профил на ${profile.displayName}`} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" aria-label="Затвори поканата" onClick={onClose}>×</button><div className="invitation-hero">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{profile.displayName.slice(0, 1).toUpperCase()}</span>}<div><p>Покана за приятелство</p><h2>{profile.displayName}</h2><small>{[profile.city, profile.neighborhood].filter(Boolean).join(" · ") || "Градът не е посочен"}</small>{profile.lookingFor && <b>{profile.lookingFor}</b>}</div></div><p className="invitation-bio">{profile.bio || "Все още няма описание."}</p>{rows.length > 0 && <dl className="invitation-details">{rows.map(({ label, value }) => <div key={label}><span className="invitation-detail-label">{label}</span><span className="invitation-detail-value">{value}</span></div>)}</dl>}<div className="invitation-actions"><button className="primary" onClick={() => void onRespond("accept")}>Приеми</button><button className="invite-decline" onClick={() => void onRespond("decline")}>Откажи</button></div></section></div>;
}function VisibilityToggle({ name, value }: { name: string; value: "PUBLIC" | "FRIENDS" }) {
  const [friendsOnly, setFriendsOnly] = useState(value === "FRIENDS");
  return <label className={`visibility-switch ${friendsOnly ? "friends" : "public"}`}><input type="checkbox" checked={friendsOnly} onChange={(event) => setFriendsOnly(event.target.checked)} aria-label="Видимост: публично или само приятели" /><input type="hidden" name={name} value={friendsOnly ? "FRIENDS" : "PUBLIC"} /><span className="visibility-switch-track" aria-hidden="true"><i /></span><b>{friendsOnly ? "Само приятели" : "Публично"}</b></label>;
}const lookingForOptions = ["", "Сериозна връзка", "Опознаване", "Приключение", "Приятелство", "Игра и общи хобита"];
function ProfileDropdown({ value: initialValue }: { value: string }) {
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, lookingForOptions.indexOf(initialValue)));
  const [position, setPosition] = useState<React.CSSProperties>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(0, lookingForOptions.indexOf(value));
  const selectedLabel = value || "Не е посочено";

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const bounds = trigger.getBoundingClientRect();
    const margin = 12;
    const gap = 6;
    const desiredHeight = Math.min(240, window.innerHeight - margin * 2);
    const below = window.innerHeight - bounds.bottom - margin - gap;
    const above = bounds.top - margin - gap;
    const placeAbove = below < desiredHeight && above > below;
    const maxHeight = Math.max(0, Math.min(desiredHeight, placeAbove ? above : below));
    const width = Math.min(bounds.width, window.innerWidth - margin * 2);
    const left = Math.max(margin, Math.min(bounds.left, window.innerWidth - margin - width));
    const top = Math.max(
      margin,
      Math.min(window.innerHeight - margin - maxHeight, placeAbove ? bounds.top - gap - maxHeight : bounds.bottom + gap),
    );
    setPosition({ position: "fixed", left, top, width, maxHeight });
  }, []);

  function showMenu() {
    setActiveIndex(selectedIndex);
    updatePosition();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const reposition = () => updatePosition();
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
    };
  }, [open, updatePosition]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) showMenu();
      else setActiveIndex((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + lookingForOptions.length) % lookingForOptions.length);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "Enter" || event.key === " ") {
      if (!open) {
        event.preventDefault();
        showMenu();
      } else {
        event.preventDefault();
        setValue(lookingForOptions[activeIndex]);
        setOpen(false);
      }
    } else if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(lookingForOptions.length - 1);
    }
  }

  return <>
    <input type="hidden" name="lookingFor" value={value} />
    <button
      ref={triggerRef}
      type="button"
      id="profile-lookingFor"
      className="profile-dropdown-trigger"
      role="combobox"
      aria-label="Намерения"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls="profile-lookingFor-options"
      aria-activedescendant={open ? `profile-lookingFor-option-${activeIndex}` : undefined}
      onClick={() => open ? setOpen(false) : showMenu()}
      onKeyDown={handleKeyDown}
    >
      <span>{selectedLabel}</span><span className={`profile-dropdown-chevron${open ? " open" : ""}`} aria-hidden="true">⌄</span>
    </button>
    {open && position && createPortal(
      <div ref={menuRef} id="profile-lookingFor-options" className="profile-dropdown-menu" role="listbox" aria-label="Намерения" style={position}>
        {lookingForOptions.map((option, index) => (
          <div
            key={option || "unspecified"}
            id={`profile-lookingFor-option-${index}`}
            className={`profile-dropdown-option${index === selectedIndex ? " selected" : ""}${index === activeIndex ? " active" : ""}`}
            role="option"
            aria-selected={index === selectedIndex}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => { setValue(option); setOpen(false); triggerRef.current?.focus(); }}
          >{option || "Не е посочено"}</div>
        ))}
      </div>,
      document.body,
    )}
  </>;
}
function Profile({ me, reload, notify, onClose }: { me: Me; reload: () => void; notify: (x: string) => void; onClose: () => void }) {
  const [avatarUrl, setAvatarUrl] = useState(me.profile.avatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const visibility = parseProfileVisibility(me.profile.profileVisibility);
  const emptyToNull = (value: FormDataEntryValue | null) => {
    const text = String(value ?? "").trim();
    return text || null;
  };
  async function choosePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const input = event.currentTarget;
    if (!file) return;
    const supportedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!supportedTypes.includes(file.type)) { notify("Избери снимка във формат JPG, PNG, WebP или GIF."); input.value = ""; return; }
    if (file.size > 10_000_000) { notify("Снимката е твърде голяма. Избери файл до 10 MB."); input.value = ""; return; }
    if (file.type === "image/gif") {
      if (file.size > 1_000_000) { notify("GIF снимките трябва да са до 1 MB."); input.value = ""; return; }
      const reader = new FileReader();
      reader.onload = () => setAvatarUrl(String(reader.result));
      reader.readAsDataURL(file);
      return;
    }
    try {
      const sourceUrl = URL.createObjectURL(file);
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const preview = new Image();
        preview.onload = () => resolve(preview);
        preview.onerror = reject;
        preview.src = sourceUrl;
      });
      const scale = Math.min(1, 720 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      let imageData = canvas.toDataURL("image/jpeg", 0.82);
      if (imageData.length > 1_450_000) imageData = canvas.toDataURL("image/jpeg", 0.62);
      URL.revokeObjectURL(sourceUrl);
      if (imageData.length > 1_500_000) { notify("Снимката не може да бъде компресирана достатъчно. Избери друга."); input.value = ""; return; }
      setAvatarUrl(imageData);
      input.value = "";
    } catch {
      notify("Снимката не можа да бъде обработена. Опитай с JPG, PNG или WebP.");
      input.value = "";
    }
  }  const resizeTextArea = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.max(44, element.scrollHeight)}px`;
  };
  const autoResize = (event: React.FormEvent<HTMLTextAreaElement>) => resizeTextArea(event.currentTarget);  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const height = String(form.get("heightCm") ?? "").trim();
    setSaving(true);
    try {
      await api("/me", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: String(form.get("displayName") ?? "").trim(),
          bio: emptyToNull(form.get("bio")), city: emptyToNull(form.get("city")), neighborhood: emptyToNull(form.get("neighborhood")),
          heightCm: height ? Number(height) : null, hairColor: emptyToNull(form.get("hairColor")), interestsText: emptyToNull(form.get("interestsText")),
          lookingFor: emptyToNull(form.get("lookingFor")), favoriteMovie: emptyToNull(form.get("favoriteMovie")), favoriteBook: emptyToNull(form.get("favoriteBook")),
          occupation: emptyToNull(form.get("occupation")), education: emptyToNull(form.get("education")), languages: emptyToNull(form.get("languages")),
          weekendStyle: emptyToNull(form.get("weekendStyle")), firstDateIdea: emptyToNull(form.get("firstDateIdea")), avatarUrl: avatarUrl || null,
          visibility: { photo: String(form.get("visibilityPhoto")), about: String(form.get("visibilityAbout")), location: String(form.get("visibilityLocation")), appearance: String(form.get("visibilityAppearance")), intentions: String(form.get("visibilityIntentions")), interests: String(form.get("visibilityInterests")), favorites: String(form.get("visibilityFavorites")), professional: String(form.get("visibilityProfessional")), lifestyle: String(form.get("visibilityLifestyle")) },
        }),
      });
      notify("Профилът е запазен.");
      reload();
    } catch (error) {
      notify((error as Error).message);
    } finally { setSaving(false); }
  }
  return <form className="profile-form profile-details-form" onSubmit={save}>
    <section className="profile-photo-row"><div className="profile-photo-preview">{avatarUrl ? <img src={avatarUrl} alt="Твоя профилна снимка" /> : <span>{me.profile.displayName.slice(0, 1).toUpperCase()}</span>}<label className="profile-photo-change" title="Избери снимка" aria-label="Избери профилна снимка"><input className="profile-photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={choosePhoto} /><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5Zm16.7-9.7a1 1 0 0 0 0-1.4l-2.1-2.1a1 1 0 0 0-1.4 0l-1.6 1.6L19.1 8l1.6-1.5Z" /></svg></label></div><div className="profile-photo-info"><div className="profile-photo-info-head"><b>Снимка</b><button type="button" className="modal-close" style={{ position: "static", flex: "0 0 32px", width: 32, height: 32, fontSize: 23 }} aria-label="Затвори профила" title="Затвори" onPointerDown={(event) => event.stopPropagation()} onClick={onClose}>×</button></div><small>JPG · PNG · WebP · GIF · до 10 MB</small><VisibilityToggle name="visibilityPhoto" value={visibility.photo} />{avatarUrl && <button type="button" className="link profile-photo-remove" onClick={() => setAvatarUrl("")}>Премахни снимката</button>}</div></section>
    <section className="profile-section"><div className="profile-category-title"><h3>Местоположение</h3><VisibilityToggle name="visibilityLocation" value={visibility.location} /></div><div className="profile-fields two-columns"><fieldset className="profile-floating-field"><legend><label htmlFor="profile-city">Град</label></legend><input id="profile-city" name="city" defaultValue={me.profile.city ?? ""} /></fieldset><fieldset className="profile-floating-field"><legend><label htmlFor="profile-neighborhood">Квартал</label></legend><input id="profile-neighborhood" name="neighborhood" defaultValue={me.profile.neighborhood ?? ""} placeholder="Например Лозенец" /></fieldset></div></section>
    <section className="profile-section"><div className="profile-category-title"><h3>Външен вид</h3><VisibilityToggle name="visibilityAppearance" value={visibility.appearance} /></div><div className="profile-fields two-columns"><fieldset className="profile-floating-field"><legend><label htmlFor="profile-heightCm">Ръст (см)</label></legend><input id="profile-heightCm" name="heightCm" type="number" min="120" max="240" defaultValue={me.profile.heightCm ?? ""} /></fieldset><fieldset className="profile-floating-field"><legend><label htmlFor="profile-hairColor">Цвят на косата</label></legend><input id="profile-hairColor" name="hairColor" defaultValue={me.profile.hairColor ?? ""} placeholder="Например кестенява" /></fieldset></div></section>
    <section className="profile-section"><div className="profile-category-title"><h3>За мен</h3><VisibilityToggle name="visibilityAbout" value={visibility.about} /></div><fieldset className="profile-floating-field"><legend><label htmlFor="profile-displayName">Име</label></legend><input id="profile-displayName" name="displayName" defaultValue={me.profile.displayName} required /></fieldset><fieldset className="profile-floating-field"><legend><label htmlFor="profile-bio">Описание</label></legend><textarea id="profile-bio" className="profile-text-value" rows={1} onInput={autoResize} ref={resizeTextArea} name="bio" maxLength={500} defaultValue={me.profile.bio ?? ""} placeholder="Няколко думи за теб…" /></fieldset></section>
    <section className="profile-section"><div className="profile-category-title"><h3>Какво търся</h3><VisibilityToggle name="visibilityIntentions" value={visibility.intentions} /></div><fieldset className="profile-floating-field"><legend><label htmlFor="profile-lookingFor">Намерения</label></legend><ProfileDropdown value={me.profile.lookingFor ?? ""} /></fieldset></section>
    <section className="profile-section"><div className="profile-category-title"><h3>Интереси</h3><VisibilityToggle name="visibilityInterests" value={visibility.interests} /></div><fieldset className="profile-floating-field"><legend><label htmlFor="profile-interestsText">Интереси</label></legend><textarea id="profile-interestsText" className="profile-text-value" rows={1} onInput={autoResize} ref={resizeTextArea} name="interestsText" defaultValue={me.profile.interestsText ?? ""} placeholder="Пътувания, фитнес, настолни игри…" /></fieldset></section>
    <section className="profile-section"><div className="profile-category-title"><h3>Любими филм и книга</h3><VisibilityToggle name="visibilityFavorites" value={visibility.favorites} /></div><div className="profile-fields two-columns"><fieldset className="profile-floating-field"><legend><label htmlFor="profile-favoriteMovie">Любим филм</label></legend><textarea id="profile-favoriteMovie" className="profile-text-value" rows={1} onInput={autoResize} ref={resizeTextArea} name="favoriteMovie" defaultValue={me.profile.favoriteMovie ?? ""} /></fieldset><fieldset className="profile-floating-field"><legend><label htmlFor="profile-favoriteBook">Любима книга</label></legend><textarea id="profile-favoriteBook" className="profile-text-value" rows={1} onInput={autoResize} ref={resizeTextArea} name="favoriteBook" defaultValue={me.profile.favoriteBook ?? ""} /></fieldset></div></section>
    <section className="profile-section"><div className="profile-category-title"><h3>Още за мен</h3><VisibilityToggle name="visibilityProfessional" value={visibility.professional} /></div><div className="profile-fields two-columns"><fieldset className="profile-floating-field"><legend><label htmlFor="profile-occupation">Работа / занимание</label></legend><textarea id="profile-occupation" className="profile-text-value" rows={1} onInput={autoResize} ref={resizeTextArea} name="occupation" defaultValue={me.profile.occupation ?? ""} /></fieldset><fieldset className="profile-floating-field"><legend><label htmlFor="profile-education">Образование</label></legend><textarea id="profile-education" className="profile-text-value" rows={1} onInput={autoResize} ref={resizeTextArea} name="education" defaultValue={me.profile.education ?? ""} /></fieldset><fieldset className="profile-floating-field profile-wide"><legend><label htmlFor="profile-languages">Езици</label></legend><textarea id="profile-languages" className="profile-text-value" rows={1} onInput={autoResize} ref={resizeTextArea} name="languages" defaultValue={me.profile.languages ?? ""} placeholder="Български, английски…" /></fieldset></div></section>
    <section className="profile-section"><div className="profile-category-title"><h3>Уикенд и първа среща</h3><VisibilityToggle name="visibilityLifestyle" value={visibility.lifestyle} /></div><div className="profile-fields two-columns"><fieldset className="profile-floating-field"><legend><label htmlFor="profile-weekendStyle">Моят идеален уикенд</label></legend><textarea id="profile-weekendStyle" className="profile-text-value" rows={1} onInput={autoResize} ref={resizeTextArea} name="weekendStyle" defaultValue={me.profile.weekendStyle ?? ""} placeholder="Планина, кино, разходка…" /></fieldset><fieldset className="profile-floating-field"><legend><label htmlFor="profile-firstDateIdea">Идея за първа среща</label></legend><textarea id="profile-firstDateIdea" className="profile-text-value" rows={1} onInput={autoResize} ref={resizeTextArea} name="firstDateIdea" defaultValue={me.profile.firstDateIdea ?? ""} placeholder="Кафе, музей, игра…" /></fieldset></div></section>    <button className="primary" disabled={saving}>{saving ? "Запазване…" : "Запази профила"}</button>
  </form>;
}function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <><div className="section-head"><h1>{title}</h1><p>{subtitle}</p></div>{children}</> }; function Grid({ children }: { children: React.ReactNode }) { return <div className="grid">{children}</div> }; function PersonCard({ p, children }: { p: Person; children: React.ReactNode }) { return <article className="person"><div className="avatar">{p.profile.displayName[0]}</div><div><h3>{p.profile.displayName}</h3><small>@{p.handle}{p.profile.city ? ` · ${p.profile.city}` : ""}</small><p>{p.profile.bio ?? "Нов човек във Follow Me"}</p></div>{children}</article> }
