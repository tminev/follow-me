"use client";

import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

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
  people: MapMarker[];
  ownPosition?: { latitude: number; longitude: number };
  radiusMeters?: number;
  onPersonClick?: (person: MapMarker) => void;
};

const SOFIA: [number, number] = [42.6977, 23.3219];

export default function MapCanvas({ people, ownPosition, radiusMeters, onPersonClick }: Props) {
  const center: [number, number] = ownPosition
    ? [ownPosition.latitude, ownPosition.longitude]
    : people[0]
      ? [people[0].latitude, people[0].longitude]
      : SOFIA;

  return (
    <div className="map-canvas" aria-label="Карта с приблизителни местоположения">
      <MapContainer center={center} zoom={radiusMeters ? 14 : 12} scrollWheelZoom className="leaflet-map">
        <TileLayer
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
          <CircleMarker key={person.id} center={[person.latitude, person.longitude]} radius={12} pathOptions={{ color: "#ffffff", fillColor: "#e62ead", fillOpacity: 1, weight: 3 }} eventHandlers={{ click: () => onPersonClick?.(person) }}>
            <Popup>
              <strong>{person.displayName}</strong><br />
              @{person.handle}<br />
              Споделена позиция
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
