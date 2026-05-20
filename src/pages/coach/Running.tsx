import { useEffect, useRef, useState } from 'react';
import CoachSidebar from '../../components/CoachSidebar';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface RoutePoint { lat: number; lng: number; ele: number; }

interface TrailRoute {
  id: string;
  name: string;
  subtitle: string;
  distance: number;   // km
  dplus: number;      // m ascent
  dminus: number;     // m descent
  difficulty: 'facile' | 'intermédiaire' | 'difficile' | 'expert';
  color: string;
  center: [number, number];
  zoom: number;
  points: RoutePoint[];
}

// ─── DEMO ROUTES (Vichy area) ─────────────────────────────────────────────────

const ROUTES: TrailRoute[] = [
  {
    id: 'lac-allier',
    name: 'Boucle Lac d\'Allier',
    subtitle: 'Vichy · Plaine alluviale',
    distance: 12.4,
    dplus: 85,
    dminus: 85,
    difficulty: 'facile',
    color: '#2D5A35',
    center: [46.128, 3.428],
    zoom: 13,
    points: [
      { lat: 46.1279, lng: 3.4245, ele: 263 },
      { lat: 46.1310, lng: 3.4190, ele: 261 },
      { lat: 46.1360, lng: 3.4150, ele: 259 },
      { lat: 46.1420, lng: 3.4180, ele: 258 },
      { lat: 46.1480, lng: 3.4250, ele: 260 },
      { lat: 46.1510, lng: 3.4350, ele: 265 },
      { lat: 46.1490, lng: 3.4480, ele: 270 },
      { lat: 46.1440, lng: 3.4580, ele: 275 },
      { lat: 46.1370, lng: 3.4620, ele: 272 },
      { lat: 46.1290, lng: 3.4580, ele: 268 },
      { lat: 46.1240, lng: 3.4490, ele: 265 },
      { lat: 46.1230, lng: 3.4380, ele: 263 },
      { lat: 46.1250, lng: 3.4290, ele: 263 },
      { lat: 46.1279, lng: 3.4245, ele: 263 },
    ],
  },
  {
    id: 'gorges-sioule',
    name: 'Trail Gorges de la Sioule',
    subtitle: 'Vichy → Ébreuil · Techn.',
    distance: 18.2,
    dplus: 480,
    dminus: 480,
    difficulty: 'intermédiaire',
    color: '#D4A53B',
    center: [46.100, 3.390],
    zoom: 12,
    points: [
      { lat: 46.1279, lng: 3.4245, ele: 263 },
      { lat: 46.1180, lng: 3.4120, ele: 270 },
      { lat: 46.1080, lng: 3.3980, ele: 295 },
      { lat: 46.0950, lng: 3.3850, ele: 340 },
      { lat: 46.0820, lng: 3.3720, ele: 410 },
      { lat: 46.0720, lng: 3.3600, ele: 480 },
      { lat: 46.0650, lng: 3.3520, ele: 520 },
      { lat: 46.0600, lng: 3.3480, ele: 550 },
      { lat: 46.0580, lng: 3.3550, ele: 530 },
      { lat: 46.0620, lng: 3.3680, ele: 490 },
      { lat: 46.0700, lng: 3.3810, ele: 440 },
      { lat: 46.0820, lng: 3.3960, ele: 380 },
      { lat: 46.0960, lng: 3.4080, ele: 320 },
      { lat: 46.1100, lng: 3.4160, ele: 290 },
      { lat: 46.1210, lng: 3.4200, ele: 272 },
      { lat: 46.1279, lng: 3.4245, ele: 263 },
    ],
  },
  {
    id: 'montagne-bourbonnaise',
    name: 'Raid Montagne Bourbonnaise',
    subtitle: 'Vichy → Laprugne · Expert',
    distance: 28.6,
    dplus: 920,
    dminus: 920,
    difficulty: 'expert',
    color: '#8B2318',
    center: [46.080, 3.520],
    zoom: 11,
    points: [
      { lat: 46.1279, lng: 3.4245, ele: 263 },
      { lat: 46.1150, lng: 3.4400, ele: 280 },
      { lat: 46.1050, lng: 3.4600, ele: 320 },
      { lat: 46.0920, lng: 3.4820, ele: 400 },
      { lat: 46.0780, lng: 3.5020, ele: 510 },
      { lat: 46.0650, lng: 3.5200, ele: 640 },
      { lat: 46.0520, lng: 3.5380, ele: 780 },
      { lat: 46.0420, lng: 3.5520, ele: 880 },
      { lat: 46.0350, lng: 3.5620, ele: 950 },
      { lat: 46.0300, lng: 3.5700, ele: 980 },
      { lat: 46.0320, lng: 3.5820, ele: 960 },
      { lat: 46.0400, lng: 3.5950, ele: 900 },
      { lat: 46.0520, lng: 3.6050, ele: 820 },
      { lat: 46.0680, lng: 3.6100, ele: 720 },
      { lat: 46.0850, lng: 3.5980, ele: 600 },
      { lat: 46.1020, lng: 3.5800, ele: 480 },
      { lat: 46.1180, lng: 3.5580, ele: 360 },
      { lat: 46.1279, lng: 3.4245, ele: 263 },
    ],
  },
  {
    id: 'cusset',
    name: 'Circuit Vichy–Cusset',
    subtitle: 'Urbain & nature · 8km',
    distance: 8.1,
    dplus: 120,
    dminus: 120,
    difficulty: 'facile',
    color: '#3A6B42',
    center: [46.128, 3.445],
    zoom: 14,
    points: [
      { lat: 46.1279, lng: 3.4245, ele: 263 },
      { lat: 46.1290, lng: 3.4350, ele: 268 },
      { lat: 46.1310, lng: 3.4450, ele: 275 },
      { lat: 46.1340, lng: 3.4550, ele: 285 },
      { lat: 46.1360, lng: 3.4650, ele: 300 },
      { lat: 46.1350, lng: 3.4750, ele: 315 },
      { lat: 46.1310, lng: 3.4780, ele: 320 },
      { lat: 46.1260, lng: 3.4750, ele: 310 },
      { lat: 46.1220, lng: 3.4680, ele: 295 },
      { lat: 46.1200, lng: 3.4580, ele: 282 },
      { lat: 46.1210, lng: 3.4460, ele: 272 },
      { lat: 46.1240, lng: 3.4350, ele: 265 },
      { lat: 46.1279, lng: 3.4245, ele: 263 },
    ],
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const DIFF_LABEL: Record<string, string> = {
  facile: 'FACILE', intermédiaire: 'INTER.', difficile: 'DIFFICILE', expert: 'EXPERT',
};
const DIFF_COLOR: Record<string, string> = {
  facile: '#2D5A35', intermédiaire: '#D4A53B', difficile: '#C56A60', expert: '#8B2318',
};

function buildElevationProfile(route: TrailRoute) {
  const pts = route.points;
  const result: { km: number; ele: number }[] = [];
  let cumDist = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) {
      const dlat = pts[i].lat - pts[i - 1].lat;
      const dlng = pts[i].lng - pts[i - 1].lng;
      cumDist += Math.sqrt(dlat * dlat + dlng * dlng) * 111;
    }
    result.push({ km: Math.round(cumDist * 10) / 10, ele: pts[i].ele });
  }
  return result;
}

function generateGPX(route: TrailRoute): string {
  const pts = route.points.map(p =>
    `    <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><ele>${p.ele}</ele></trkpt>`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ColosmarTraining" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${route.name}</name>
    <desc>${route.subtitle} · ${route.distance}km · D+${route.dplus}m</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${route.name}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>`;
}

function downloadGPX(route: TrailRoute) {
  const xml = generateGPX(route);
  const blob = new Blob([xml], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${route.id}-colosmart.gpx`;
  a.click();
  URL.revokeObjectURL(url);
}

function shareWhatsApp(route: TrailRoute) {
  const text = `🏃 *${route.name}*\n📍 ${route.subtitle}\n📏 ${route.distance} km · ⬆️ D+ ${route.dplus}m · ⬇️ D- ${route.dminus}m\n\n💪 Plan de course ColosmarTraining · Télécharge le GPX pour ta montre via l'app !`;
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// ─── MAP COMPONENT ────────────────────────────────────────────────────────────

function LeafletMap({ route }: { route: TrailRoute }) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polyRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !divRef.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;

      // Fix Leaflet default icon paths broken by bundlers
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (cancelled || !divRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(divRef.current, { zoomControl: true, scrollWheelZoom: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
          maxZoom: 18,
        }).addTo(mapRef.current);
      }

      // Remove old polyline
      if (polyRef.current) {
        mapRef.current.removeLayer(polyRef.current);
      }

      // Draw route
      const latlngs = route.points.map(p => [p.lat, p.lng] as [number, number]);
      polyRef.current = L.polyline(latlngs, {
        color: route.color,
        weight: 4,
        opacity: 0.9,
      }).addTo(mapRef.current);

      // Start / end markers
      L.circleMarker(latlngs[0], { radius: 8, fillColor: '#2D5A35', color: '#fff', weight: 2, fillOpacity: 1 })
        .bindPopup('<b>DÉPART</b>').addTo(mapRef.current);
      L.circleMarker(latlngs[latlngs.length - 1], { radius: 8, fillColor: '#8B2318', color: '#fff', weight: 2, fillOpacity: 1 })
        .bindPopup('<b>ARRIVÉE</b>').addTo(mapRef.current);

      mapRef.current.setView(route.center, route.zoom);
    })();

    return () => { cancelled = true; };
  }, [route]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <>
      {/* Leaflet CSS injected via link tag */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={divRef} style={{ width: '100%', height: '100%', borderRadius: 10 }} />
    </>
  );
}

// ─── ELEVATION TOOLTIP ────────────────────────────────────────────────────────

function EleTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#16261A', border: '1px solid rgba(45,90,53,0.5)', borderRadius: 6, padding: '6px 10px' }}>
      <div style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: 'var(--cst-mid-green)' }}>
        {payload[0].payload.km} KM
      </div>
      <div style={{ fontFamily: 'var(--cst-mono)', fontSize: 12, fontWeight: 700, color: '#fff' }}>
        {payload[0].value} m
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function RunningWidget() {
  const [selected, setSelected] = useState<TrailRoute>(ROUTES[0]);
  const [copied, setCopied] = useState(false);

  const profile = buildElevationProfile(selected);

  const handleShare = () => {
    shareWhatsApp(selected);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="cst-screen" style={{ flexDirection: 'row' }}>
      <CoachSidebar />

      <div className="cst-scroll" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '24px 28px', gap: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)', letterSpacing: '0.2em' }}>
              — 01 · TRAIL & RUN · PLANIFICATION PARCOURS
            </div>
            <h1 className="cst-display" style={{ fontSize: 40, margin: '8px 0 0', color: '#fff' }}>PLANS DE COURSE.</h1>
            <div className="cst-italic" style={{ fontSize: 22, color: 'rgba(255,255,255,0.55)' }}>Partage. Analyse. Trace.</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => downloadGPX(selected)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'rgba(45,90,53,0.2)', border: '1px solid rgba(45,90,53,0.5)', borderRadius: 8, color: '#6EAB76', fontFamily: 'var(--cst-mono)', fontSize: 10, letterSpacing: '0.12em', cursor: 'pointer', textTransform: 'uppercase' }}>
              ↓ GPX
            </button>
            <button onClick={handleShare}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: copied ? 'rgba(45,90,53,0.4)' : '#25D366', border: 'none', borderRadius: 8, color: '#fff', fontFamily: 'var(--cst-mono)', fontSize: 10, letterSpacing: '0.12em', cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s' }}>
              {copied ? '✓ ENVOYÉ' : '↗ WHATSAPP'}
            </button>
          </div>
        </div>

        {/* Main layout */}
        <div style={{ display: 'flex', gap: 18, flex: 1, minHeight: 0 }}>

          {/* Route list */}
          <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="cst-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4, letterSpacing: '0.16em' }}>PARCOURS DISPONIBLES</div>
            {ROUTES.map(r => {
              const on = r.id === selected.id;
              return (
                <div key={r.id} onClick={() => setSelected(r)}
                  style={{ padding: '14px 14px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${on ? r.color : 'rgba(255,255,255,0.07)'}`, background: on ? `${r.color}22` : '#1F2A22', transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--cst-display)', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#fff', lineHeight: 1.1 }}>{r.name}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--cst-mono)', fontSize: 8, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>{r.subtitle}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: '#fff', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>{r.distance} km</span>
                    <span style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: '#6EAB76', background: 'rgba(45,90,53,0.15)', padding: '2px 6px', borderRadius: 4 }}>↑{r.dplus}m</span>
                    <span style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: '#C56A60', background: 'rgba(139,35,24,0.15)', padding: '2px 6px', borderRadius: 4 }}>↓{r.dminus}m</span>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span style={{ fontFamily: 'var(--cst-mono)', fontSize: 8, color: DIFF_COLOR[r.difficulty], background: `${DIFF_COLOR[r.difficulty]}22`, padding: '2px 7px', borderRadius: 99, border: `1px solid ${DIFF_COLOR[r.difficulty]}44` }}>
                      {DIFF_LABEL[r.difficulty]}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Stats card */}
            <div style={{ marginTop: 8, padding: 14, background: '#16261A', borderRadius: 10, border: '1px solid rgba(45,90,53,0.2)' }}>
              <div className="cst-mono" style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginBottom: 10, letterSpacing: '0.14em' }}>PARCOURS SÉLECTIONNÉ</div>
              {[
                ['DISTANCE', `${selected.distance} km`],
                ['DÉNIVELÉ +', `${selected.dplus} m`],
                ['DÉNIVELÉ −', `${selected.dminus} m`],
                ['DIFFICULTÉ', DIFF_LABEL[selected.difficulty]],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{k}</span>
                  <span style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, fontWeight: 700, color: '#fff' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Map + elevation */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Map */}
            <div style={{ flex: 1, minHeight: 320, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              <LeafletMap route={selected} />
            </div>

            {/* Elevation profile */}
            <div style={{ background: '#1F2A22', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="cst-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.14em' }}>PROFIL ALTIMÉTRIQUE</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: '#6EAB76' }}>↑ D+ {selected.dplus} m</span>
                  <span style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: '#C56A60' }}>↓ D− {selected.dminus} m</span>
                  <span style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>📏 {selected.distance} km</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={profile} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={selected.color} stopOpacity={0.5} />
                      <stop offset="95%" stopColor={selected.color} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="km" tick={{ fontFamily: 'var(--cst-mono)', fontSize: 8, fill: 'rgba(255,255,255,0.35)' }} tickFormatter={v => `${v}km`} />
                  <YAxis tick={{ fontFamily: 'var(--cst-mono)', fontSize: 8, fill: 'rgba(255,255,255,0.35)' }} tickFormatter={v => `${v}m`} />
                  <Tooltip content={<EleTooltip />} />
                  <Area type="monotone" dataKey="ele" stroke={selected.color} strokeWidth={2} fill="url(#eleGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Action bar */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => downloadGPX(selected)}
                style={{ flex: 1, padding: '14px 0', borderRadius: 10, background: 'rgba(45,90,53,0.15)', border: '1px solid rgba(45,90,53,0.4)', color: '#6EAB76', fontFamily: 'var(--cst-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>
                ↓ TÉLÉCHARGER GPX · MONTRE / GARMIN
              </button>
              <button onClick={handleShare}
                style={{ flex: 1, padding: '14px 0', borderRadius: 10, background: '#25D366', border: 'none', color: '#fff', fontFamily: 'var(--cst-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 700, transition: 'opacity 0.2s', opacity: copied ? 0.7 : 1 }}>
                {copied ? '✓ PLAN PARTAGÉ !' : '↗ PARTAGER SUR WHATSAPP'}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
