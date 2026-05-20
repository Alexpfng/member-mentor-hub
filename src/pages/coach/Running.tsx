import { useEffect, useRef, useState, useCallback } from 'react';
import CoachSidebar from '../../components/CoachSidebar';
import { supabase } from '@/integrations/supabase/client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface Pt { lat: number; lng: number; }
interface PtEle extends Pt { ele: number; }
interface EleProfile { km: number; ele: number; }

interface RunRoute {
  id: string;
  name: string;
  subtitle: string;
  distance: number;
  dplus: number;
  dminus: number;
  difficulty: 'facile' | 'intermédiaire' | 'difficile' | 'expert';
  color: string;
  center: [number, number];
  zoom: number;
  points: PtEle[];
  gpxUrl?: string;
}

// ─── DEMO ROUTES ──────────────────────────────────────────────────────────────

const DEMO_ROUTES: RunRoute[] = [
  {
    id: 'lac-allier', name: 'Boucle Lac d\'Allier', subtitle: 'Vichy · Plaine alluviale',
    distance: 12.4, dplus: 85, dminus: 85, difficulty: 'facile', color: '#2D5A35',
    center: [46.128, 3.428], zoom: 13,
    points: [
      {lat:46.1279,lng:3.4245,ele:263},{lat:46.1310,lng:3.4190,ele:261},{lat:46.1360,lng:3.4150,ele:259},
      {lat:46.1420,lng:3.4180,ele:258},{lat:46.1480,lng:3.4250,ele:260},{lat:46.1510,lng:3.4350,ele:265},
      {lat:46.1490,lng:3.4480,ele:270},{lat:46.1440,lng:3.4580,ele:275},{lat:46.1370,lng:3.4620,ele:272},
      {lat:46.1290,lng:3.4580,ele:268},{lat:46.1240,lng:3.4490,ele:265},{lat:46.1230,lng:3.4380,ele:263},
      {lat:46.1250,lng:3.4290,ele:263},{lat:46.1279,lng:3.4245,ele:263},
    ],
  },
  {
    id: 'gorges-sioule', name: 'Trail Gorges de la Sioule', subtitle: 'Vichy → Ébreuil · Technique',
    distance: 18.2, dplus: 480, dminus: 480, difficulty: 'intermédiaire', color: '#D4A53B',
    center: [46.100, 3.390], zoom: 12,
    points: [
      {lat:46.1279,lng:3.4245,ele:263},{lat:46.1180,lng:3.4120,ele:270},{lat:46.1080,lng:3.3980,ele:295},
      {lat:46.0950,lng:3.3850,ele:340},{lat:46.0820,lng:3.3720,ele:410},{lat:46.0720,lng:3.3600,ele:480},
      {lat:46.0650,lng:3.3520,ele:520},{lat:46.0600,lng:3.3480,ele:550},{lat:46.0580,lng:3.3550,ele:530},
      {lat:46.0620,lng:3.3680,ele:490},{lat:46.0700,lng:3.3810,ele:440},{lat:46.0820,lng:3.3960,ele:380},
      {lat:46.0960,lng:3.4080,ele:320},{lat:46.1100,lng:3.4160,ele:290},{lat:46.1210,lng:3.4200,ele:272},
      {lat:46.1279,lng:3.4245,ele:263},
    ],
  },
  {
    id: 'montagne-bourbonnaise', name: 'Raid Montagne Bourbonnaise', subtitle: 'Vichy → Laprugne · Expert',
    distance: 28.6, dplus: 920, dminus: 920, difficulty: 'expert', color: '#8B2318',
    center: [46.080, 3.520], zoom: 11,
    points: [
      {lat:46.1279,lng:3.4245,ele:263},{lat:46.1150,lng:3.4400,ele:280},{lat:46.1050,lng:3.4600,ele:320},
      {lat:46.0920,lng:3.4820,ele:400},{lat:46.0780,lng:3.5020,ele:510},{lat:46.0650,lng:3.5200,ele:640},
      {lat:46.0520,lng:3.5380,ele:780},{lat:46.0420,lng:3.5520,ele:880},{lat:46.0350,lng:3.5620,ele:950},
      {lat:46.0300,lng:3.5700,ele:980},{lat:46.0320,lng:3.5820,ele:960},{lat:46.0400,lng:3.5950,ele:900},
      {lat:46.0520,lng:3.6050,ele:820},{lat:46.0680,lng:3.6100,ele:720},{lat:46.0850,lng:3.5980,ele:600},
      {lat:46.1020,lng:3.5800,ele:480},{lat:46.1180,lng:3.5580,ele:360},{lat:46.1279,lng:3.4245,ele:263},
    ],
  },
];

const DIFF_COLOR: Record<string, string> = {
  facile: '#2D5A35', intermédiaire: '#D4A53B', difficile: '#C56A60', expert: '#8B2318',
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function haversineKm(a: Pt, b: Pt) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function calcStats(points: PtEle[]) {
  let dist = 0, dplus = 0, dminus = 0;
  for (let i = 1; i < points.length; i++) {
    dist += haversineKm(points[i - 1], points[i]);
    const dEle = points[i].ele - points[i - 1].ele;
    if (dEle > 0) dplus += dEle; else dminus += Math.abs(dEle);
  }
  return { distance: Math.round(dist * 10) / 10, dplus: Math.round(dplus), dminus: Math.round(dminus) };
}

function buildProfile(points: PtEle[]): EleProfile[] {
  let cum = 0;
  return points.map((p, i) => {
    if (i > 0) cum += haversineKm(points[i - 1], p);
    return { km: Math.round(cum * 10) / 10, ele: Math.round(p.ele) };
  });
}

function generateGPX(name: string, points: PtEle[]) {
  const trk = points.map(p => `    <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><ele>${p.ele}</ele></trkpt>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="ColosmarTraining" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk><name>${name}</name><trkseg>\n${trk}\n  </trkseg></trk>\n</gpx>`;
}

function downloadGPXBlob(name: string, points: PtEle[]) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([generateGPX(name, points)], { type: 'application/gpx+xml' }));
  a.download = `${name.replace(/\s+/g, '-').toLowerCase()}.gpx`;
  a.click();
}

// Fetch routed path between two points using OSRM (foot, simplified geometry)
async function fetchOSRMSegment(a: Pt, b: Pt): Promise<{ points: Pt[]; distanceKm: number }> {
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${a.lng},${a.lat};${b.lng},${b.lat}?geometries=geojson&overview=simplified`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== 'Ok') return { points: [a, b], distanceKm: haversineKm(a, b) };
    const points = (data.routes[0].geometry.coordinates as [number, number][]).map(([lng, lat]) => ({ lat, lng }));
    const distanceKm = Math.round((data.routes[0].distance / 1000) * 10) / 10;
    return { points, distanceKm };
  } catch { return { points: [a, b], distanceKm: haversineKm(a, b) }; }
}

// Fetch elevation from OpenTopoData (max 100 pts per request)
async function fetchElevation(pts: Pt[]): Promise<number[]> {
  if (!pts.length) return [];
  // Keep max 100 evenly sampled points
  const step = Math.max(1, Math.ceil(pts.length / 98));
  const indices: number[] = [];
  for (let i = 0; i < pts.length; i += step) indices.push(i);
  if (indices[indices.length - 1] !== pts.length - 1) indices.push(pts.length - 1);
  const sampled = indices.map(i => pts[i]);
  try {
    const locs = sampled.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');
    const res = await fetch(`https://api.opentopodata.org/v1/srtm30m?locations=${locs}`);
    const data = await res.json();
    if (!data.results) throw new Error('no results');
    const sampledEles: number[] = data.results.map((r: any) => r.elevation ?? 300);
    // Interpolate back to full length
    const result: number[] = new Array(pts.length);
    for (let i = 0; i < pts.length; i++) {
      const pos = i / step;
      const lo = Math.floor(pos);
      const hi = Math.min(lo + 1, sampledEles.length - 1);
      const t = pos - lo;
      result[i] = Math.round(sampledEles[lo] * (1 - t) + sampledEles[hi] * t);
    }
    return result;
  } catch { return pts.map(() => 300); }
}

// Upload GPX to Supabase Storage and return public URL
async function uploadGPX(name: string, points: PtEle[]): Promise<string | null> {
  try {
    const gpx = generateGPX(name, points);
    const fileName = `${Date.now()}-${name.replace(/\s+/g, '-').toLowerCase()}.gpx`;
    const { error } = await supabase.storage.from('running-routes').upload(fileName, new Blob([gpx], { type: 'application/gpx+xml' }), { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from('running-routes').getPublicUrl(fileName);
    return data.publicUrl;
  } catch { return null; }
}

// ─── PDF PRINT ────────────────────────────────────────────────────────────────

function printPDF(route: RunRoute | null, customName: string, points: PtEle[], stats: ReturnType<typeof calcStats>) {
  const name = route ? route.name : customName;
  const profile = buildProfile(points);
  const minEle = Math.min(...profile.map(p => p.ele));
  const maxEle = Math.max(...profile.map(p => p.ele));
  const totalKm = profile[profile.length - 1]?.km ?? 0;

  const svgPts = profile.map((p, i) => {
    const x = (p.km / totalKm) * 560;
    const y = 80 - ((p.ele - minEle) / (maxEle - minEle + 1)) * 75;
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${name} — ColosmarTraining</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#1B2E1F; color:#fff; font-family:'Barlow Condensed',sans-serif; padding:48px; }
  .logo { font-size:13px; letter-spacing:.18em; opacity:.6; margin-bottom:32px; }
  h1 { font-size:52px; font-weight:900; text-transform:uppercase; line-height:.95; }
  .sub { font-size:18px; opacity:.55; margin-top:6px; font-style:italic; }
  .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin:32px 0; }
  .stat { background:rgba(255,255,255,.07); border-radius:10px; padding:18px; }
  .stat-label { font-family:'JetBrains Mono',monospace; font-size:9px; letter-spacing:.16em; opacity:.45; text-transform:uppercase; }
  .stat-val { font-size:36px; font-weight:800; margin-top:6px; }
  .profile-wrap { background:rgba(255,255,255,.05); border-radius:12px; padding:20px; }
  .profile-title { font-family:'JetBrains Mono',monospace; font-size:9px; letter-spacing:.16em; opacity:.4; margin-bottom:12px; text-transform:uppercase; }
  svg { width:100%; height:auto; }
  .footer { margin-top:32px; font-family:'JetBrains Mono',monospace; font-size:9px; opacity:.3; letter-spacing:.1em; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>
<div class="logo">★ COLOSMARTRAINING · PLAN DE COURSE</div>
<h1>${name}</h1>
<div class="sub">${route?.subtitle ?? 'Trace personnalisée'}</div>
<div class="stats">
  <div class="stat"><div class="stat-label">Distance</div><div class="stat-val">${stats.distance} <span style="font-size:18px">km</span></div></div>
  <div class="stat"><div class="stat-label">Dénivelé +</div><div class="stat-val" style="color:#6EAB76">↑${stats.dplus} <span style="font-size:18px">m</span></div></div>
  <div class="stat"><div class="stat-label">Dénivelé −</div><div class="stat-val" style="color:#C56A60">↓${stats.dminus} <span style="font-size:18px">m</span></div></div>
  <div class="stat"><div class="stat-label">Difficulté</div><div class="stat-val" style="font-size:24px">${route?.difficulty?.toUpperCase() ?? 'CUSTOM'}</div></div>
</div>
<div class="profile-wrap">
  <div class="profile-title">Profil altimétrique</div>
  <svg viewBox="0 0 560 90" preserveAspectRatio="none">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2D5A35" stop-opacity=".7"/><stop offset="100%" stop-color="#2D5A35" stop-opacity=".05"/></linearGradient></defs>
    <path d="${svgPts} L560,80 L0,80 Z" fill="url(#g)"/>
    <path d="${svgPts}" fill="none" stroke="#2D5A35" stroke-width="2"/>
  </svg>
</div>
<div class="footer">ColosmarTraining · Léo Colognesi · Vichy, France · Imprimé le ${new Date().toLocaleDateString('fr-FR')}</div>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

// ─── MAP COMPONENT ────────────────────────────────────────────────────────────

interface MapProps {
  browseRoute: RunRoute | null;
  createMode: boolean;
  waypoints: Pt[];
  routedSegments: Pt[][];
  onMapClick: (lat: number, lng: number) => void;
  onWaypointRemove: (i: number) => void;
}

function LeafletMap({ browseRoute, createMode, waypoints, routedSegments, onMapClick, onWaypointRemove }: MapProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);
  const clickRef = useRef(onMapClick);
  const removeRef = useRef(onWaypointRemove);
  clickRef.current = onMapClick;
  removeRef.current = onWaypointRemove;

  // Init map once
  useEffect(() => {
    if (typeof window === 'undefined' || !divRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !divRef.current || mapRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(divRef.current!, { zoomControl: true, scrollWheelZoom: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>', maxZoom: 18,
      }).addTo(map);
      map.setView([46.128, 3.424], 13);
      mapRef.current = map;

      map.on('click', (e: any) => { clickRef.current(e.latlng.lat, e.latlng.lng); });
    })();
    return () => { cancelled = true; };
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  // Redraw when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled) return;

      // Clear previous layers
      layersRef.current.forEach(l => l.remove());
      layersRef.current = [];

      if (!createMode && browseRoute) {
        // Browse mode: show saved route
        const lls = browseRoute.points.map(p => [p.lat, p.lng] as [number, number]);
        const poly = L.polyline(lls, { color: browseRoute.color, weight: 4, opacity: 0.9 }).addTo(map);
        const mStart = L.circleMarker(lls[0], { radius: 8, fillColor: '#2D5A35', color: '#fff', weight: 2, fillOpacity: 1 }).bindPopup('<b>DÉPART</b>').addTo(map);
        const mEnd = L.circleMarker(lls[lls.length - 1], { radius: 8, fillColor: '#8B2318', color: '#fff', weight: 2, fillOpacity: 1 }).bindPopup('<b>ARRIVÉE</b>').addTo(map);
        layersRef.current = [poly, mStart, mEnd];
        map.fitBounds(poly.getBounds(), { padding: [30, 30] });
        return;
      }

      if (createMode) {
        // Draw routed segments
        routedSegments.forEach(seg => {
          if (seg.length < 2) return;
          const poly = L.polyline(seg.map(p => [p.lat, p.lng] as [number, number]), { color: '#2D5A35', weight: 4, opacity: 0.9 }).addTo(map);
          layersRef.current.push(poly);
        });

        // Draw straight lines for pending segment (last waypoint to cursor)
        if (waypoints.length >= 2 && routedSegments.length < waypoints.length - 1) {
          const n = waypoints.length - 1;
          const pending = L.polyline([[waypoints[n-1].lat, waypoints[n-1].lng], [waypoints[n].lat, waypoints[n].lng]] as [number,number][], { color: '#D4A53B', weight: 2, dashArray: '6 4', opacity: 0.7 }).addTo(map);
          layersRef.current.push(pending);
        }

        // Waypoint markers
        waypoints.forEach((wp, i) => {
          const icon = L.divIcon({
            html: `<div style="width:28px;height:28px;border-radius:50%;background:${i === 0 ? '#2D5A35' : i === waypoints.length - 1 ? '#8B2318' : '#1B2E1F'};border:2px solid white;display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:11px;font-weight:700;color:white;cursor:pointer">${i + 1}</div>`,
            iconSize: [28, 28], iconAnchor: [14, 14], className: '',
          });
          const m = L.marker([wp.lat, wp.lng], { icon })
            .bindPopup(`<div style="font-family:monospace;font-size:11px">Point ${i + 1}<br><button onclick="window.__removeWP(${i})" style="margin-top:4px;padding:2px 8px;background:#8B2318;color:white;border:none;border-radius:4px;cursor:pointer">Supprimer</button></div>`)
            .addTo(map);
          layersRef.current.push(m);
        });

        (window as any).__removeWP = (i: number) => { removeRef.current(i); };
      }
    })();
    return () => { cancelled = true; };
  }, [browseRoute, createMode, waypoints, routedSegments]);

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={divRef} style={{ width: '100%', height: '100%' }} />
    </>
  );
}

// ─── ELEVATION TOOLTIP ────────────────────────────────────────────────────────

function EleTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#16261A', border: '1px solid rgba(45,90,53,0.5)', borderRadius: 6, padding: '6px 10px' }}>
      <div style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: 'var(--cst-mid-green)' }}>{payload[0].payload.km} KM</div>
      <div style={{ fontFamily: 'var(--cst-mono)', fontSize: 12, fontWeight: 700, color: '#fff' }}>{payload[0].value} m</div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function RunningWidget() {
  const [mode, setMode] = useState<'browse' | 'create'>('browse');
  const [selectedRoute, setSelectedRoute] = useState<RunRoute>(DEMO_ROUTES[0]);

  // Create mode state
  const [waypoints, setWaypoints] = useState<Pt[]>([]);
  const [routedSegments, setRoutedSegments] = useState<Pt[][]>([]);
  const [customPoints, setCustomPoints] = useState<PtEle[]>([]);
  const [routeName, setRouteName] = useState('');
  const [difficulty, setDifficulty] = useState<'facile'|'intermédiaire'|'difficile'|'expert'>('intermédiaire');
  const [routing, setRouting] = useState(false);
  const [fetchingEle, setFetchingEle] = useState(false);
  const [segmentDistances, setSegmentDistances] = useState<number[]>([]);
  const [gpxUrl, setGpxUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const eleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active points & stats
  const activePoints = mode === 'browse' ? selectedRoute.points : customPoints;
  const osrmDistance = Math.round(segmentDistances.reduce((a, b) => a + b, 0) * 10) / 10;
  const rawStats = calcStats(customPoints);
  const activeStats = mode === 'browse'
    ? { distance: selectedRoute.distance, dplus: selectedRoute.dplus, dminus: selectedRoute.dminus }
    : { distance: osrmDistance || rawStats.distance, dplus: rawStats.dplus, dminus: rawStats.dminus };
  const profile = buildProfile(activePoints);

  // ── Add waypoint (create mode) ───────────────────────────────────────────

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (mode !== 'create') return;
    const newWp: Pt = { lat, lng };
    setWaypoints(prev => {
      const next = [...prev, newWp];
      if (next.length >= 2) {
        // Route from previous to new
        setRouting(true);
        const from = prev[prev.length - 1];
        fetchOSRMSegment(from, newWp).then(({ points: seg, distanceKm }) => {
          setRoutedSegments(prev => {
            const next = [...prev, seg];
            setCustomPoints(next.flat().map(p => ({ ...p, ele: 300 })));
            return next;
          });
          setSegmentDistances(prev => [...prev, distanceKm]);
          setRouting(false);
        });
      }
      return next;
    });
  }, [mode]);

  const handleWaypointRemove = useCallback((i: number) => {
    setWaypoints(prev => {
      const next = prev.filter((_, idx) => idx !== i);
      // Rebuild segments for remaining waypoints
      setRoutedSegments([]);
      setCustomPoints([]);
      // Re-route all segments asynchronously
      if (next.length >= 2) {
        setRouting(true);
        Promise.all(
          next.slice(0, -1).map((wp, si) => fetchOSRMSegment(wp, next[si + 1]))
        ).then(results => {
          const segs = results.map(r => r.points);
          setRoutedSegments(segs);
          setSegmentDistances(results.map(r => r.distanceKm));
          setCustomPoints(segs.flat().map(p => ({ ...p, ele: 300 })));
          setRouting(false);
        });
      }
      return next;
    });
  }, []);

  // ── Auto-fetch elevation 2s after route stops changing ──────────────────

  useEffect(() => {
    if (routedSegments.length === 0) return;
    if (eleTimerRef.current) clearTimeout(eleTimerRef.current);
    eleTimerRef.current = setTimeout(async () => {
      setFetchingEle(true);
      const flat = routedSegments.flat();
      const eles = await fetchElevation(flat);
      setCustomPoints(flat.map((p, i) => ({ ...p, ele: eles[i] ?? 300 })));
      setFetchingEle(false);
    }, 2000);
    return () => { if (eleTimerRef.current) clearTimeout(eleTimerRef.current); };
  }, [routedSegments]);

  async function handleFetchElevation() {
    if (routedSegments.length === 0) return;
    if (eleTimerRef.current) clearTimeout(eleTimerRef.current);
    setFetchingEle(true);
    const flat = routedSegments.flat();
    const eles = await fetchElevation(flat);
    setCustomPoints(flat.map((p, i) => ({ ...p, ele: eles[i] ?? 300 })));
    setFetchingEle(false);
  }

  // ── Reset create ────────────────────────────────────────────────────────

  function resetCreate() {
    setWaypoints([]);
    setRoutedSegments([]);
    setCustomPoints([]);
    setRouteName('');
    setGpxUrl(null);
  }

  // ── Share & upload ──────────────────────────────────────────────────────

  async function handleShare() {
    setSharing(true);
    const name = mode === 'browse' ? selectedRoute.name : (routeName || 'Ma trace');
    const pts = activePoints;
    const stats = activeStats;

    // Try to upload GPX
    let url = mode === 'browse' ? (selectedRoute.gpxUrl ?? null) : gpxUrl;
    if (!url) {
      url = await uploadGPX(name, pts);
      if (mode === 'create' && url) setGpxUrl(url);
    }

    const gpxLine = url
      ? `\n📥 *Télécharger le GPX* (Garmin · Suunto · Strava) :\n${url}`
      : `\n📥 GPX disponible — demande le lien à Léo sur l'app.`;

    const msg = `🏃 *${name}*\n📍 ${mode === 'browse' ? selectedRoute.subtitle : 'Trace personnalisée · Vichy'}\n\n📏 Distance : *${stats.distance} km*\n⬆️ D+ : *${stats.dplus} m*\n⬇️ D− : *${stats.dminus} m*\n🎯 Difficulté : *${(mode === 'browse' ? selectedRoute.difficulty : difficulty).toUpperCase()}*${gpxLine}\n\n_Profil ColosmarTraining · Léo Colognesi_`;

    setSharing(false);
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="cst-screen" style={{ flexDirection: 'row' }}>
      <CoachSidebar />

      <div className="cst-scroll" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '20px 24px', gap: 16 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)', letterSpacing: '0.2em' }}>— TRAIL & RUN · PLANIFICATION</div>
            <h1 className="cst-display" style={{ fontSize: 36, margin: '6px 0 0', color: '#fff' }}>PLANS DE COURSE.</h1>
          </div>
          {/* Mode toggle */}
          <div style={{ display: 'flex', background: '#1F2A22', borderRadius: 10, padding: 4, border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['browse', 'create'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); if (m === 'create') resetCreate(); }}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'var(--cst-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', transition: 'all 0.15s', background: mode === m ? 'var(--cst-mid-green)' : 'transparent', color: mode === m ? '#fff' : 'rgba(255,255,255,0.45)' }}>
                {m === 'browse' ? '◎ PARCOURS' : '✎ CRÉER'}
              </button>
            ))}
          </div>
        </div>

        {/* Main layout */}
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

          {/* Left panel */}
          <div style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>

            {mode === 'browse' ? (
              <>
                <div className="cst-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.14em' }}>PARCOURS ENREGISTRÉS</div>
                {DEMO_ROUTES.map(r => {
                  const on = r.id === selectedRoute.id;
                  return (
                    <div key={r.id} onClick={() => setSelectedRoute(r)}
                      style={{ padding: 12, borderRadius: 10, cursor: 'pointer', border: `1px solid ${on ? r.color : 'rgba(255,255,255,0.07)'}`, background: on ? `${r.color}22` : '#1F2A22', transition: 'all .15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                        <span style={{ fontFamily: 'var(--cst-display)', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#fff', lineHeight: 1.1 }}>{r.name}</span>
                      </div>
                      <div style={{ fontFamily: 'var(--cst-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>{r.subtitle}</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: '#fff', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>{r.distance} km</span>
                        <span style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: '#6EAB76', background: 'rgba(45,90,53,0.15)', padding: '2px 6px', borderRadius: 4 }}>↑{r.dplus}m</span>
                        <span style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: '#C56A60', background: 'rgba(139,35,24,0.15)', padding: '2px 6px', borderRadius: 4 }}>↓{r.dminus}m</span>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <span style={{ fontFamily: 'var(--cst-mono)', fontSize: 8, color: DIFF_COLOR[r.difficulty], background: `${DIFF_COLOR[r.difficulty]}22`, padding: '2px 7px', borderRadius: 99, border: `1px solid ${DIFF_COLOR[r.difficulty]}44` }}>
                          {r.difficulty.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                {/* Create mode panel */}
                <div className="cst-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.14em' }}>CRÉER UNE TRACE</div>

                <div style={{ padding: 12, borderRadius: 10, background: 'rgba(45,90,53,0.12)', border: '1px solid rgba(45,90,53,0.3)' }}>
                  <div className="cst-mono" style={{ fontSize: 8, color: 'var(--cst-mid-green)', marginBottom: 4 }}>↖ CLIQUE SUR LA CARTE</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                    Ajoute des points de passage. Le tracé suit les chemins réels grâce au routage automatique.
                  </div>
                  {routing && <div className="cst-mono" style={{ fontSize: 8, color: '#D4A53B', marginTop: 6 }}>⟳ ROUTAGE EN COURS…</div>}
                </div>

                <input value={routeName} onChange={e => setRouteName(e.target.value)}
                  placeholder="Nom de la trace…"
                  style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontFamily: 'var(--cst-mono)', fontSize: 11, outline: 'none' }} />

                <select value={difficulty} onChange={e => setDifficulty(e.target.value as any)}
                  style={{ padding: '10px 12px', borderRadius: 8, background: '#1F2A22', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontFamily: 'var(--cst-mono)', fontSize: 11, cursor: 'pointer' }}>
                  {(['facile','intermédiaire','difficile','expert'] as const).map(d => (
                    <option key={d} value={d}>{d.toUpperCase()}</option>
                  ))}
                </select>

                {/* Waypoint list */}
                {waypoints.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {waypoints.map((wp, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#1F2A22', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: i === 0 ? '#2D5A35' : i === waypoints.length - 1 ? '#8B2318' : '#333', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--cst-mono)', fontSize: 9, color: '#fff', flexShrink: 0 }}>{i + 1}</div>
                        <span style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: 'rgba(255,255,255,0.55)', flex: 1 }}>{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</span>
                        <button onClick={() => handleWaypointRemove(i)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14, padding: '2px 4px' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Elevation button */}
                {routedSegments.length > 0 && (
                  <button onClick={handleFetchElevation} disabled={fetchingEle}
                    style={{ padding: '10px 0', borderRadius: 8, background: 'rgba(212,165,59,0.15)', border: '1px solid rgba(212,165,59,0.4)', color: '#D4A53B', fontFamily: 'var(--cst-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', opacity: fetchingEle ? 0.6 : 1 }}>
                    {fetchingEle ? '⟳ CHARGEMENT…' : '↑↓ PROFIL ALTIMÉTRIQUE'}
                  </button>
                )}

                {waypoints.length > 0 && (
                  <button onClick={resetCreate}
                    style={{ padding: '8px 0', borderRadius: 8, background: 'transparent', border: '1px solid rgba(139,35,24,0.4)', color: 'rgba(197,106,96,0.8)', fontFamily: 'var(--cst-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    ✕ EFFACER LA TRACE
                  </button>
                )}
              </>
            )}
          </div>

          {/* Map + elevation + actions */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Map */}
            <div style={{ flex: 1, minHeight: 300, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
              <LeafletMap
                browseRoute={mode === 'browse' ? selectedRoute : null}
                createMode={mode === 'create'}
                waypoints={waypoints}
                routedSegments={routedSegments}
                onMapClick={handleMapClick}
                onWaypointRemove={handleWaypointRemove}
              />
            </div>

            {/* Stats bar */}
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { label: 'DISTANCE', val: `${activeStats.distance} km`, color: '#fff' },
                { label: 'D+', val: `${activeStats.dplus} m`, color: '#6EAB76' },
                { label: 'D−', val: `${activeStats.dminus} m`, color: '#C56A60' },
                { label: 'POINTS', val: `${activePoints.length}`, color: 'rgba(255,255,255,0.5)' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: '#1F2A22', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ fontFamily: 'var(--cst-mono)', fontSize: 8, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontFamily: 'var(--cst-mono)', fontSize: 16, fontWeight: 700, color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Elevation profile */}
            {profile.length > 2 && (
              <div style={{ background: '#1F2A22', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', padding: '14px 16px' }}>
                <div className="cst-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.14em', marginBottom: 10 }}>PROFIL ALTIMÉTRIQUE</div>
                <ResponsiveContainer width="100%" height={90}>
                  <AreaChart data={profile} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="eleG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2D5A35" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#2D5A35" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="km" tick={{ fontFamily: 'var(--cst-mono)', fontSize: 8, fill: 'rgba(255,255,255,0.3)' }} tickFormatter={v => `${v}km`} />
                    <YAxis tick={{ fontFamily: 'var(--cst-mono)', fontSize: 8, fill: 'rgba(255,255,255,0.3)' }} tickFormatter={v => `${v}m`} />
                    <Tooltip content={<EleTooltip />} />
                    <Area type="monotone" dataKey="ele" stroke="#2D5A35" strokeWidth={2} fill="url(#eleG)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => downloadGPXBlob(mode === 'browse' ? selectedRoute.name : (routeName || 'ma-trace'), activePoints)}
                disabled={activePoints.length < 2}
                style={{ flex: 1, padding: '13px 0', borderRadius: 10, background: 'rgba(45,90,53,0.15)', border: '1px solid rgba(45,90,53,0.4)', color: '#6EAB76', fontFamily: 'var(--cst-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', opacity: activePoints.length < 2 ? 0.4 : 1 }}>
                ↓ TÉLÉCHARGER GPX
              </button>
              <button
                onClick={() => printPDF(mode === 'browse' ? selectedRoute : null, routeName || 'Ma trace', activePoints, activeStats)}
                disabled={activePoints.length < 2}
                style={{ flex: 1, padding: '13px 0', borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--cst-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', opacity: activePoints.length < 2 ? 0.4 : 1 }}>
                ⎙ FICHE PDF
              </button>
              <button
                onClick={handleShare}
                disabled={sharing || activePoints.length < 2}
                style={{ flex: 2, padding: '13px 0', borderRadius: 10, background: '#25D366', border: 'none', color: '#fff', fontFamily: 'var(--cst-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 700, opacity: (sharing || activePoints.length < 2) ? 0.5 : 1 }}>
                {sharing ? '⟳ ENVOI…' : '↗ PARTAGER SUR WHATSAPP'}
              </button>
            </div>

            {/* GPX URL display */}
            {gpxUrl && (
              <div style={{ padding: '10px 14px', background: 'rgba(45,90,53,0.12)', border: '1px solid rgba(45,90,53,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="cst-mono" style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>✓ LIEN GPX :</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gpxUrl}</span>
                <button onClick={() => navigator.clipboard.writeText(gpxUrl)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--cst-mid-green)', cursor: 'pointer', fontFamily: 'var(--cst-mono)', fontSize: 9 }}>
                  COPIER
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
