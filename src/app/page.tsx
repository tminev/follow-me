"use client";
import dynamic from "next/dynamic";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { PushNotifications } from "@/components/PushNotifications";
import { AuthLanding } from "@/components/AuthLanding";
import { MapVisibilityPanel } from "@/components/MapVisibilityPanel";
import { BottomNavigation, NavigationIcon, PeopleDirectory } from "@/components/PeopleDirectory";
import type { MapMarker } from "@/components/MapCanvas";
import type { ChatClientEvents, ChatMessage, ChatServerEvents } from "@/lib/chat-socket";
import { parseProfileVisibility } from "@/lib/profile-visibility";
const MapCanvas = dynamic(() => import("@/components/MapCanvas"), { ssr: false, loading: () => <div className="map-loading">Зареждане на картата…</div> });
type ProfileData = { displayName: string; bio?: string | null; city?: string | null; neighborhood?: string | null; avatarUrl?: string | null; heightCm?: number | null; hairColor?: string | null; interestsText?: string | null; lookingFor?: string | null; favoriteMovie?: string | null; favoriteBook?: string | null; occupation?: string | null; education?: string | null; languages?: string | null; weekendStyle?: string | null; firstDateIdea?: string | null; profileVisibility?: string | null }; type Me = { id: string; handle: string; declaredAdult: boolean; ageVerificationStatus: string; profile: ProfileData }; type Person = { id: string; handle: string; isLocationVisible?: boolean; profile: ProfileData }; type RequestItem = { id: string; status: string; sender?: Person; receiver?: Person }; type Conversation = { id: string; person: Person; lastMessage?: { body: string } };
type ChatAlert = { id: string; sender: { handle: string; displayName: string }; body: string };
async function api(path: string, init?: RequestInit) { const r = await fetch(`/api/v1${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } }); const text = await r.text(); let data: unknown; try { data = text ? JSON.parse(text) : {} } catch { throw new Error(r.status === 502 ? "Връзката към локалния сървър е прекъсната. Рестартирай тунела и опитай отново." : "Сървърът върна невалиден отговор.") } if (!r.ok) throw new Error(typeof data === "object" && data !== null && "message" in data ? String(data.message) : "Грешка"); return data }
export default function Home() {
  const [me, setMe] = useState<Me | null | undefined>();
  const [profileOpen, setProfileOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string>();
  const [notice, setNotice] = useState("");
  const [chatAlerts, setChatAlerts] = useState<ChatAlert[]>([]);
  const [incomingRequestVersion, setIncomingRequestVersion] = useState(0);
  const refresh = () => api("/me").then((data) => setMe(data.user)).catch(() => setMe(null));
  const showMap = () => { setDirectoryOpen(false); setProfileOpen(false); setSelectedFriendId(undefined); };
  const showProfile = () => { setDirectoryOpen(false); setProfileOpen(true); };

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
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
      </div>
    </header>
    {notice && <div className="notice" role="status">{notice}</div>}
    <section className="content one-page">
      <section id="map" className="one-page-section"><MapPanel me={me} notify={setNotice} chatAlerts={chatAlerts} directoryOpen={directoryOpen} setDirectoryOpen={setDirectoryOpen} selectedFriendId={selectedFriendId} setSelectedFriendId={setSelectedFriendId} onProfile={showProfile} incomingRequestVersion={incomingRequestVersion} onReadMessages={(handle) => setChatAlerts((alerts) => alerts.filter((alert) => alert.sender.handle !== handle))} /></section>
    </section>
    {profileOpen && <div className="profile-modal-backdrop" role="presentation" onMouseDown={() => setProfileOpen(false)}>
      <section className="profile-modal" role="dialog" aria-modal="true" aria-label="Твоят профил" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" aria-label="Затвори профила" title="Затвори" onPointerDown={(event) => event.stopPropagation()} onClick={() => setProfileOpen(false)}>×</button>
        <Profile me={me} reload={refresh} notify={setNotice} onLogout={async () => { await api("/auth/logout", { method: "POST" }); setProfileOpen(false); setMe(null); }} />
      </section>
    </div>}
    <BottomNavigation active={profileOpen ? "profile" : directoryOpen ? "people" : "map"} onMap={showMap} onPeople={() => { setProfileOpen(false); setDirectoryOpen(true); }} onProfile={showProfile} />
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
function MapPanel({ me, notify, chatAlerts, onReadMessages, directoryOpen, setDirectoryOpen, selectedFriendId, setSelectedFriendId, onProfile, incomingRequestVersion }: { me: Me; notify: (x: string) => void; chatAlerts: ChatAlert[]; onReadMessages: (handle: string) => void; directoryOpen: boolean; setDirectoryOpen: (open: boolean) => void; selectedFriendId?: string; setSelectedFriendId: (id: string | undefined) => void; onProfile: () => void; incomingRequestVersion: number }) {
  const [state, setState] = useState<{ visible: boolean; session?: { continuous?: boolean } | null }>();
  const [nearby, setNearby] = useState<MapMarker[]>([]);
  const [discoveryRadius, setDiscoveryRadius] = useState<{ meters: number; loyaltyLabel: string }>();
  const [people, setPeople] = useState<Person[]>([]);
  const [friends, setFriends] = useState<Person[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [connectionsError, setConnectionsError] = useState("");
  const [focusTarget, setFocusTarget] = useState<MapMarker>();
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [outgoingRequestIds, setOutgoingRequestIds] = useState<string[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  useEffect(() => {
    let active = true;
    async function refreshOutgoing() {
      try {
        const response = await api("/friend-requests?direction=outgoing") as { requests: RequestItem[] };
        if (active) setOutgoingRequestIds(response.requests.filter((request) => request.status === "PENDING" && request.receiver).map((request) => request.receiver!.id));
      } catch { /* Sending still validates the current relationship on the server. */ }
    }
    void refreshOutgoing();
    const timer = window.setInterval(() => void refreshOutgoing(), 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  async function sendMapInvitation(person: MapMarker) {
    await api("/friend-requests", { method: "POST", body: JSON.stringify({ recipientId: person.id }) });
    setOutgoingRequestIds((ids) => ids.includes(person.id) ? ids : [...ids, person.id]);
    notify(`Поканата е изпратена до ${person.displayName}.`);
  }
  const [selectedPublicProfile, setSelectedPublicProfile] = useState<Person>();
  const [drawerHandleY, setDrawerHandleY] = useState(220);
  const drawerHandleMoved = useRef(false);
  const [ownPosition, setOwnPosition] = useState<{ latitude: number; longitude: number }>();
  const proximityState = useRef(new Map<string, boolean>());
  const lastLocationSent = useRef<{ latitude: number; longitude: number; sentAt: number }>();
  const loadConnections = useCallback(async () => {
    setConnectionsLoading(true);
    setConnectionsError("");
    try {
      const [friendsResult, requestsResult] = await Promise.all([
        api("/friends") as Promise<{ friends: Person[] }>,
        api("/friend-requests?direction=incoming") as Promise<{ requests: RequestItem[] }>,
      ]);
      setFriends(friendsResult.friends);
      setFriendIds(friendsResult.friends.map((person) => person.id));
      setRequests(requestsResult.requests);
    } catch (error) {
      setConnectionsError(error instanceof Error ? error.message : "Списъкът не се зареди. Опитай отново.");
    } finally { setConnectionsLoading(false); }
  }, []);
  useEffect(() => {
    void loadConnections();
    const timer = window.setInterval(() => void loadConnections(), 15000);
    return () => window.clearInterval(timer);
  }, [loadConnections, directoryOpen, incomingRequestVersion]);
  const load = async () => { const next = await api("/visibility/me"); setState(next); if (next.visible) { const result = await api("/discovery/nearby") as { users: MapMarker[]; radiusMeters: number; loyaltyLabel: string }; setNearby(result.users); setDiscoveryRadius({ meters: result.radiusMeters, loyaltyLabel: result.loyaltyLabel }); } else { setNearby([]); setDiscoveryRadius(undefined); } };
  useEffect(() => { Promise.all([load(), api("/discover/users").then((result) => setPeople(result.users))]).catch((error) => notify((error as Error).message)) }, []);
  useEffect(() => { const timer = window.setInterval(() => { Promise.all([load(), api("/discover/users").then((result) => setPeople(result.users))]).catch((error) => notify((error as Error).message)) }, 15000); return () => window.clearInterval(timer) }, []);
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
  async function respondToRequest(requestId: string, action: "accept" | "decline") {
    await api(`/friend-requests/${requestId}/${action}`, { method: "POST" });
    setRequests((items) => items.filter((item) => item.id !== requestId));
    await loadConnections();
    notify(action === "accept" ? "Вече сте приятели." : "Поканата е отказана.");
  }
  async function block(person: Person) { try { await api(`/users/${person.id}/block`, { method: "POST" }); setFriendIds((ids) => ids.filter((id) => id !== person.id)); setPeople((items) => items.filter((item) => item.id !== person.id)); if (selectedFriendId === person.id) setSelectedFriendId(undefined); notify("Потребителят е блокиран.") } catch (error) { notify((error as Error).message) } }
  function moveDrawerHandle(event: React.PointerEvent<HTMLButtonElement>) { if (!window.matchMedia("(max-width: 800px)").matches) return; event.currentTarget.focus(); event.preventDefault(); const startY = event.clientY; const startTop = drawerHandleY; drawerHandleMoved.current = false; const move = (next: PointerEvent) => { const delta = next.clientY - startY; if (Math.abs(delta) > 4) drawerHandleMoved.current = true; setDrawerHandleY(Math.max(92, Math.min(window.innerHeight - 160, startTop + delta))) }; const end = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.setTimeout(() => { drawerHandleMoved.current = false }, 0) }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", end) }
  return <Panel title="Карта и хора" subtitle="Виж хора по градове; картата се отваря само при доброволно споделена локация.">
    <div className="map-directory friends-directory-layout">
      <div className={`map-card ${selectedFriendId ? "showing-chat" : state?.visible ? "map-card-active" : ""}`}><button className="mobile-directory-handle" style={{ top: drawerHandleY }} onPointerDown={moveDrawerHandle} onClick={() => { if (!drawerHandleMoved.current) setDirectoryOpen(true) }} aria-label="Отвори приятели и покани"><NavigationIcon name="chat" /></button>{selectedFriendId ? <Chats meId={me.id} openPersonId={selectedFriendId} embedded onBack={() => setSelectedFriendId(undefined)} onBlock={() => { const person = people.find((item) => item.id === selectedFriendId); if (person && window.confirm(`Сигурен ли си, че искаш да блокираш ${person.profile.displayName}?`)) void block(person) }} /> : state?.visible ? <><MapCanvas focusTarget={focusTarget && nearby.some((person) => person.id === focusTarget.id) ? focusTarget : undefined} people={nearby} ownPosition={ownPosition} radiusMeters={discoveryRadius?.meters} friendIds={friendIds} outgoingRequestIds={outgoingRequestIds} incomingRequestIds={requests.flatMap((request) => request.sender ? [request.sender.id] : [])} onSendInvitation={sendMapInvitation} onPersonClick={(person) => { setSelectedPublicProfile({ id: person.id, handle: person.handle, profile: person.profile ?? { displayName: person.displayName } }); }} /><MapVisibilityPanel continuous={!!state.session?.continuous} radiusMeters={discoveryRadius?.meters} onStop={stop} /></> : <><div className="map-orbit"><span>●</span><b>СКРИТ СЪМ</b></div><p>{me.declaredAdult ? "Картата не се зарежда, докато не включиш доброволно видимост. Сесията изтича автоматично." : "Картата е достъпна само за профили, които са декларирали 18+ и са посочили пълнолетна възраст."}</p><div className="map-visibility-actions"><button className="primary" onClick={() => start()}>Включи за 15 мин.</button><button className="primary" onClick={() => start(true)}>Видим постоянно</button></div></>}</div>

    </div>
    {directoryOpen && <PeopleDirectory friends={friends} requests={requests} nearby={state?.visible ? nearby : []} ownPosition={ownPosition} unreadHandles={unreadHandles} loading={connectionsLoading} loadError={connectionsError} onRetry={() => void loadConnections()} onClose={() => setDirectoryOpen(false)} onChat={(person) => { setSelectedFriendId(person.id); setDirectoryOpen(false); onReadMessages(person.handle); }} onLocate={(person) => { setSelectedFriendId(undefined); setFocusTarget({ ...person }); setDirectoryOpen(false); }} onRespond={respondToRequest} onMap={() => { setSelectedFriendId(undefined); setDirectoryOpen(false); }} onProfile={onProfile} />}
    {selectedPublicProfile && <PublicProfilePreview person={selectedPublicProfile} onClose={() => setSelectedPublicProfile(undefined)} onSend={async () => { try { await api("/friend-requests", { method: "POST", body: JSON.stringify({ recipientId: selectedPublicProfile.id }) }); notify("Поканата е изпратена."); setSelectedPublicProfile(undefined); } catch (error) { notify((error as Error).message); } }} onHideFromMap={async () => { if (!window.confirm(`Сигурен ли си, че искаш ${selectedPublicProfile.profile.displayName} да не вижда местоположението ти на картата?`)) return; try { await api(`/users/${selectedPublicProfile.id}/hide`, { method: "POST" }); setNearby((items) => items.filter((item) => item.id !== selectedPublicProfile.id)); notify("Вече си скрит от този човек на картата."); } catch (error) { notify((error as Error).message); } }} />}
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
}function Profile({ me, reload, notify, onLogout }: { me: Me; reload: () => void; notify: (x: string) => void; onLogout: () => Promise<void> }) {
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
  return <Panel title="Твоят профил" subtitle={`@${me.handle}`}><form className="profile-form profile-details-form" onSubmit={save}>
    <section className="profile-photo-row"><div className="profile-photo-preview">{avatarUrl ? <img src={avatarUrl} alt="Твоя профилна снимка" /> : <span>{me.profile.displayName.slice(0, 1).toUpperCase()}</span>}<label className="profile-photo-change" title="Избери снимка" aria-label="Избери профилна снимка"><input className="profile-photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={choosePhoto} /><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16.5V20h3.5L18 9.5 14.5 6 4 16.5Zm16.7-9.7a1 1 0 0 0 0-1.4l-2.1-2.1a1 1 0 0 0-1.4 0l-1.6 1.6L19.1 8l1.6-1.5Z" /></svg></label></div><div><b>Профилна снимка</b><small>JPG, PNG, WebP или GIF до 10 MB.</small><div className="profile-inline-visibility"><span>Видимост</span><VisibilityToggle name="visibilityPhoto" value={visibility.photo} /></div>{avatarUrl && <button type="button" className="link profile-photo-remove" onClick={() => setAvatarUrl("")}>Премахни снимката</button>}</div></section>
    <section className="profile-section"><div className="profile-category-title"><h3>Местоположение</h3><VisibilityToggle name="visibilityLocation" value={visibility.location} /></div><div className="profile-fields two-columns"><label>Град<input name="city" defaultValue={me.profile.city ?? ""} /></label><label>Квартал<input name="neighborhood" defaultValue={me.profile.neighborhood ?? ""} placeholder="Например Лозенец" /></label></div></section>
    <section className="profile-section"><div className="profile-category-title"><h3>Външен вид</h3><VisibilityToggle name="visibilityAppearance" value={visibility.appearance} /></div><div className="profile-fields two-columns"><label>Ръст (см)<input name="heightCm" type="number" min="120" max="240" defaultValue={me.profile.heightCm ?? ""} /></label><label>Цвят на косата<input name="hairColor" defaultValue={me.profile.hairColor ?? ""} placeholder="Например кестенява" /></label></div></section>
    <section className="profile-section"><div className="profile-category-title"><h3>За мен</h3><VisibilityToggle name="visibilityAbout" value={visibility.about} /></div><label>Име<input name="displayName" defaultValue={me.profile.displayName} required /></label><label>Описание<textarea name="bio" maxLength={500} defaultValue={me.profile.bio ?? ""} placeholder="Няколко думи за теб…" /></label></section>
    <section className="profile-section"><div className="profile-category-title"><h3>Какво търся</h3><VisibilityToggle name="visibilityIntentions" value={visibility.intentions} /></div><label>Намерения<select name="lookingFor" defaultValue={me.profile.lookingFor ?? ""}><option value="">Не е посочено</option><option>Сериозна връзка</option><option>Опознаване</option><option>Приключение</option><option>Приятелство</option><option>Игра и общи хобита</option></select></label></section>
    <section className="profile-section"><div className="profile-category-title"><h3>Интереси</h3><VisibilityToggle name="visibilityInterests" value={visibility.interests} /></div><label>Интереси<textarea className="profile-text-value" rows={1} onInput={autoResize} ref={resizeTextArea} name="interestsText" defaultValue={me.profile.interestsText ?? ""} placeholder="Пътувания, фитнес, настолни игри…" /></label></section>
    <section className="profile-section"><div className="profile-category-title"><h3>Любими филм и книга</h3><VisibilityToggle name="visibilityFavorites" value={visibility.favorites} /></div><div className="profile-fields two-columns"><label>Любим филм<textarea className="profile-text-value" rows={1} onInput={autoResize} ref={resizeTextArea} name="favoriteMovie" defaultValue={me.profile.favoriteMovie ?? ""} /></label><label>Любима книга<textarea className="profile-text-value" rows={1} onInput={autoResize} ref={resizeTextArea} name="favoriteBook" defaultValue={me.profile.favoriteBook ?? ""} /></label></div></section>
    <section className="profile-section"><div className="profile-category-title"><h3>Още за мен</h3><VisibilityToggle name="visibilityProfessional" value={visibility.professional} /></div><div className="profile-fields two-columns"><label>Работа / занимание<textarea className="profile-text-value" rows={1} onInput={autoResize} ref={resizeTextArea} name="occupation" defaultValue={me.profile.occupation ?? ""} /></label><label>Образование<textarea className="profile-text-value" rows={1} onInput={autoResize} ref={resizeTextArea} name="education" defaultValue={me.profile.education ?? ""} /></label><label className="profile-wide">Езици<textarea className="profile-text-value" rows={1} onInput={autoResize} ref={resizeTextArea} name="languages" defaultValue={me.profile.languages ?? ""} placeholder="Български, английски…" /></label></div></section>
    <section className="profile-section"><div className="profile-category-title"><h3>Уикенд и първа среща</h3><VisibilityToggle name="visibilityLifestyle" value={visibility.lifestyle} /></div><div className="profile-fields two-columns"><label>Моят идеален уикенд<textarea className="profile-text-value" rows={1} onInput={autoResize} ref={resizeTextArea} name="weekendStyle" defaultValue={me.profile.weekendStyle ?? ""} placeholder="Планина, кино, разходка…" /></label><label>Идея за първа среща<textarea className="profile-text-value" rows={1} onInput={autoResize} ref={resizeTextArea} name="firstDateIdea" defaultValue={me.profile.firstDateIdea ?? ""} placeholder="Кафе, музей, игра…" /></label></div></section>    <button className="primary" disabled={saving}>{saving ? "Запазване…" : "Запази профила"}</button>
    <button type="button" className="ghost" onClick={() => void onLogout().catch((error: Error) => notify(error.message))}>Изход от профила</button>
  </form></Panel>;
}function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <><div className="section-head"><h1>{title}</h1><p>{subtitle}</p></div>{children}</> }; function Grid({ children }: { children: React.ReactNode }) { return <div className="grid">{children}</div> }; function PersonCard({ p, children }: { p: Person; children: React.ReactNode }) { return <article className="person"><div className="avatar">{p.profile.displayName[0]}</div><div><h3>{p.profile.displayName}</h3><small>@{p.handle}{p.profile.city ? ` · ${p.profile.city}` : ""}</small><p>{p.profile.bio ?? "Нов човек във Follow Me"}</p></div>{children}</article> }
