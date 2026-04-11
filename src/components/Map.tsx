import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, User, Wrench } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

// Fix for default marker icons in Leaflet
import 'leaflet/dist/leaflet.css';

interface MapProps {
  center?: { lat: number; lng: number };
  markers?: Array<{
    id: string;
    lat: number;
    lng: number;
    type: 'customer' | 'mechanic' | 'rescue';
    label?: string;
    permanentLabel?: boolean;
  }>;
  trace?: Array<{ lat: number; lng: number }>;
  onLocationSelect?: (lat: number, lng: number) => void;
  className?: string;
  zoom?: number;
}

// Roxas City Center
const ROXAS_CITY = { lat: 11.5853, lng: 122.7511 };

// Custom Icons using Lucide
const createCustomIcon = (type: 'customer' | 'mechanic' | 'rescue', color: string) => {
  const iconMarkup = renderToStaticMarkup(
    <div className={`p-2 rounded-full shadow-lg border-2 border-white ${color}`}>
      {type === 'customer' ? <User className="w-4 h-4 text-white" /> : 
       type === 'mechanic' ? <Wrench className="w-4 h-4 text-white" /> : 
       <MapPin className="w-4 h-4 text-white" />}
    </div>
  );

  return L.divIcon({
    html: iconMarkup,
    className: 'custom-map-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

const icons = {
  customer: createCustomIcon('customer', 'bg-blue-500'),
  mechanic: createCustomIcon('mechanic', 'bg-green-500'),
  rescue: createCustomIcon('rescue', 'bg-orange-500'),
};

// Helper component to handle map clicks
function MapEvents({ onLocationSelect }: { onLocationSelect?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onLocationSelect) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Helper component to update map center
function ChangeView({ center, zoom, shouldFit }: { center: { lat: number; lng: number }; zoom: number; shouldFit: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!shouldFit) {
      map.setView([center.lat, center.lng], zoom);
    }
  }, [center, zoom, map, shouldFit]);
  return null;
}

// Helper component to fit bounds of all markers
function FitBounds({ markers }: { markers: any[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 1) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [70, 70], maxZoom: 16 });
    }
  }, [markers, map]);
  return null;
}

export default function Map({ 
  center = ROXAS_CITY, 
  markers = [], 
  onLocationSelect, 
  className = "",
  zoom = 14,
  trace = []
}: MapProps) {
  return (
    <div className={`relative rounded-2xl overflow-hidden border-2 border-slate-200 shadow-inner ${className}`}>
      <MapContainer 
        center={[center.lat, center.lng]} 
        zoom={zoom} 
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapEvents onLocationSelect={onLocationSelect} />
        <ChangeView center={center} zoom={zoom} shouldFit={markers.length > 1} />
        <FitBounds markers={markers} />

        {trace.length > 1 && (
          <Polyline 
            positions={trace.map(p => [p.lat, p.lng] as [number, number])} 
            color="#f97316" 
            weight={4} 
            opacity={0.6} 
            dashArray="10, 10"
          />
        )}

        {markers.map((marker) => (
          <Marker 
            key={marker.id} 
            position={[marker.lat, marker.lng]} 
            icon={icons[marker.type]}
          >
            {marker.label && (
              <Tooltip 
                permanent={marker.permanentLabel ?? true} 
                direction="top" 
                offset={[0, -20]}
                className="custom-tooltip"
              >
                <div className="text-[10px] font-bold px-1">{marker.label}</div>
              </Tooltip>
            )}
            {marker.label && (
              <Popup>
                <div className="text-xs font-bold">{marker.label}</div>
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>

      {/* Map Legend */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        <div className="bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-slate-200 text-[10px] font-bold">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-orange-500 border border-white" />
            <span className="text-slate-700">Pending Rescue</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-green-500 border border-white" />
            <span className="text-slate-700">Active Mechanic</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 border border-white" />
            <span className="text-slate-700">Your Location</span>
          </div>
        </div>
      </div>

      {/* User Location Indicator */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-white p-3 rounded-full shadow-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all">
        <Navigation className="w-6 h-6 text-blue-500" />
      </div>
    </div>
  );
}
