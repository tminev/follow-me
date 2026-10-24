"use client";

import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { useEffect, useRef, useState } from "react";
import "./MapCanvas.css";

export type MapMarker = {
  id: string;
  displayName: string;
  handle: string;
  profile?: {
    displayName: string;
    bio?: string | null;
    city?: string | null;
    neighborhood?: string | null;
    avatarUrl?: string | null;
    heightCm?: number | null;
    hairColor?: string | null;
    interestsText?: string | null;
    lookingFor?: string | null;
    favoriteMovie?: string | null;
    favoriteBook?: string | null;
    occupation?: string | null;
    education?: string | null;
    languages?: string | null;
    weekendStyle?: string | null;
    firstDateIdea?: string | null;
  } | null;
  latitude: number;
  longitude: number;
  precision: "exact";
};

type Props = {
  focusTarget?: MapMarker;
  people: MapMarker[];
  ownPosition?: { latitude: number; longitude: number };
  radiusMeters?: number;
  onPersonClick?: (person: MapMarker) => void;
  onSendInvitation: (person: MapMarker) => Promise<void>;
  friendIds: string[];
  outgoingRequestIds: string[];
  incomingRequestIds: string[];
};

const SOFIA: [number, number] = [42.6977, 23.3219];

export default function MapCanvas({ people, ownPosition, radiusMeters, onPersonClick, onSendInvitation, friendIds, outgoingRequestIds, incomingRequestIds, focusTarget }: Props) {
  const [selectedId, setSelectedId] = useState<string>();
  const selectedPerson = people.find((person) => person.id === selectedId);
  const center: [number, number] = ownPosition
    ? [ownPosition.latitude, ownPosition.longitude]
    : people[0]
      ? [people[0].latitude, people[0].longitude]
      : SOFIA;

  return (
    <div className="map-canvas map-with-person-card" aria-label="Карта с приблизителни местоположения">
      <MapContainer center={center} zoom={radiusMeters ? 14 : 12} scrollWheelZoom className="leaflet-map leaflet-map-dark">
        <FocusPerson target={focusTarget} />
        <TileLayer
          className="map-tiles-dark"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {ownPosition && radiusMeters && (
          <Circle
            center={[ownPosition.latitude, ownPosition.longitude]}
            radius={radiusMeters}
            pathOptions={{ color: "#7bb6ff", fillColor: "#397cff", fillOpacity: 0.13, weight: 2, dashArray: "7 7" }}
          />
        )}
        {ownPosition && (
          <CircleMarker center={[ownPosition.latitude, ownPosition.longitude]} radius={14} pathOptions={{ color: "#ffffff", fillColor: "#4d8dff", fillOpacity: 1, weight: 3 }}>
            <Popup>Ти</Popup>
          </CircleMarker>
        )}
        {people.map((person) => (
          <CircleMarker key={person.id} center={[person.latitude, person.longitude]} radius={person.id === selectedId ? 16 : 12} pathOptions={{ color: person.id === selectedId ? "#b8caff" : "#ffffff", fillColor: "#e62ead", fillOpacity: 1, weight: 3 }} eventHandlers={{
            click: () => setSelectedId(person.id),
            add: (event) => {
              const element = event.target.getElement() as SVGElement | null;
              if (!element) return;
              element.setAttribute("tabindex", "0");
              element.setAttribute("role", "button");
              element.setAttribute("aria-label", `Покажи ${person.displayName} на картата`);
              element.onkeydown = (keyEvent) => {
                if (keyEvent.key === "Enter" || keyEvent.key === " ") { keyEvent.preventDefault(); setSelectedId(person.id); }
              };
            },
          }} />
        ))}
      </MapContainer>
      {selectedPerson && <MapPersonCard key={selectedPerson.id} person={selectedPerson}
        isFriend={friendIds.includes(selectedPerson.id)}
        isOutgoing={outgoingRequestIds.includes(selectedPerson.id)}
        isIncoming={incomingRequestIds.includes(selectedPerson.id)}
        onClose={() => setSelectedId(undefined)}
        onProfile={onPersonClick ? () => onPersonClick(selectedPerson) : undefined}
        onSend={() => onSendInvitation(selectedPerson)} />}
    </div>
  );
}

function FocusPerson({ target }: { target?: MapMarker }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView([target.latitude, target.longitude], Math.max(map.getZoom(), 15));
  }, [map, target]);
  return null;
}

function MapPersonCard({ person, isFriend, isOutgoing, isIncoming, onClose, onProfile, onSend }: {
  person: MapMarker; isFriend: boolean; isOutgoing: boolean; isIncoming: boolean;
  onClose: () => void; onProfile?: () => void; onSend: () => Promise<void>;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const pending = sent || isOutgoing;
  async function send() {
    if (inFlight.current || pending || isFriend || isIncoming) return;
    inFlight.current = true;
    setSending(true);
    setError("");
    try { await onSend(); setSent(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Поканата не е изпратена. Опитай отново."); }
    finally { inFlight.current = false; setSending(false); }
  }
  return <section className="map-person-card" role="region" aria-label={`Избран човек: ${person.displayName}`} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
    <div className="map-person-card-handle" aria-hidden="true" />
    <div className="map-person-card-heading">
      <div className="map-person-card-avatar">{person.profile?.avatarUrl ? <img src={person.profile.avatarUrl} alt="" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.42 0-8 2.01-8 4.5V20h16v-1.5c0-2.49-3.58-4.5-8-4.5Z" /></svg>}</div>
      <div className="map-person-card-info"><h3>{person.displayName}</h3><p>{[person.profile?.city, person.profile?.neighborhood].filter(Boolean).join(" · ") || `@${person.handle}`}</p></div>
      <button type="button" className="map-person-card-close" aria-label="Затвори избрания човек" onClick={onClose}>×</button>
    </div>
    <div className="map-person-card-actions">
      <button type="button" className="map-person-card-invite" disabled={sending || pending || isFriend || isIncoming} onClick={() => void send()}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 18-8-8 18-2-8-8-2Zm8 2L21 3" /></svg>
        {isFriend ? "Вече сте приятели" : isIncoming ? "Имаш покана" : pending ? "Поканата е изпратена" : sending ? "Изпращане…" : "Изпрати покана"}
      </button>
      <button type="button" className="map-person-card-profile" disabled={!onProfile} onClick={onProfile}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.42 0-8 2.01-8 4.5V20h16v-1.5c0-2.49-3.58-4.5-8-4.5Z" /></svg>Покажи профил</button>
    </div>
    <div className="map-person-card-status" aria-live="polite">{error ? <p role="alert">{error}</p> : pending ? <p>Поканата е изпратена до {person.displayName}.</p> : isIncoming ? <p>Можеш да приемеш поканата от панела „Покани“.</p> : null}</div>
  </section>;
}
