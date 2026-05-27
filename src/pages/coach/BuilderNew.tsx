import { useState, useCallback, useRef, useEffect } from 'react';
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useServerFn } from '@tanstack/react-start';
import { saveProgram } from '@/lib/coach.functions';
import CoachSidebar from '../../components/CoachSidebar';
import { toast } from 'sonner';

// ─── TYPES ────────────────────────────────────────────────────────────────────

type ExColor = '🔴' | '🟢' | '🟡' | '🔵';
type Category = 'PUSH' | 'PULL' | 'LEGS' | 'CORE' | 'CARDIO' | 'TOUT';

interface LibraryExercise {
  id: string;
  name: string;
  category: Category;
  color: ExColor;
  youtube_url?: string;
}

interface ProgramExercise {
  uid: string;
  name: string;
  category: Category;
  color: ExColor;
  sets: number;
  reps: string;
  weight: string;
  rest: string;
  rpe: number;
  youtube_url: string;
  notes: string;
  superset_with?: string;
}

interface Day {
  id: string;
  name: string;
  type: 'Entraînement' | 'Repos' | 'Optionnel';
  exercises: ProgramExercise[];
}

interface Week {
  id: string;
  days: Day[];
}

// ─── STATIC LIBRARY ───────────────────────────────────────────────────────────

const BASE_LIBRARY: LibraryExercise[] = [
  { id: 'sq', name: 'Squat Barre', category: 'LEGS', color: '🔴' },
  { id: 'bp', name: 'Bench Press', category: 'PUSH', color: '🔴' },
  { id: 'dl', name: 'Soulevé de Terre', category: 'PULL', color: '🔴' },
  { id: 'ohp', name: 'Overhead Press', category: 'PUSH', color: '🔴' },
  { id: 'pu', name: 'Tractions', category: 'PULL', color: '🔴' },
  { id: 'row', name: 'Row Barre', category: 'PULL', color: '🔴' },
  { id: 'dip', name: 'Dips', category: 'PUSH', color: '🟢' },
  { id: 'curl', name: 'Curl Biceps', category: 'PULL', color: '🟢' },
  { id: 'lunge', name: 'Walking Lunges', category: 'LEGS', color: '🟢' },
  { id: 'rdl', name: 'Romanian Deadlift', category: 'LEGS', color: '🟡' },
  { id: 'fp', name: 'Face Pull', category: 'PULL', color: '🟢' },
  { id: 'cr', name: 'Calf Raises', category: 'LEGS', color: '🟡' },
  { id: 'plank', name: 'Plank', category: 'CORE', color: '🔵' },
  { id: 'db', name: 'Dead Bug', category: 'CORE', color: '🔵' },
  { id: 'run', name: 'Run Zone 2', category: 'CARDIO', color: '🟡' },
  { id: 'box', name: 'Box Jump', category: 'CARDIO', color: '🟡' },
];

const REST_OPTIONS = ['0s','30s','45s','1 min','1min30','2 min','2min30','3 min','4 min','5 min'];
const COLORS: ExColor[] = ['🔴','🟢','🟡','🔵'];

// ─── YOUTUBE UTILS ─────────────────────────────────────────────────────────────

function extractYTId(url: string): string | null {
  const m = url.match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
function ytThumb(id: string) { return `https://img.youtube.com/vi/${id}/hqdefault.jpg`; }

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

function makeDay(name = 'JOUR', type: Day['type'] = 'Entraînement'): Day {
  return { id: uid(), name, type, exercises: [] };
}

function makeWeek(): Week {
  return {
    id: uid(),
    days: [
      makeDay('PUSH A'),
      makeDay('PULL B'),
      makeDay('REPOS', 'Repos'),
      makeDay('LEGS C'),
      makeDay('CARDIO', 'Optionnel'),
    ],
  };
}

function makeExercise(lib: LibraryExercise): ProgramExercise {
  return {
    uid: uid(), name: lib.name, category: lib.category, color: lib.color,
    sets: 3, reps: '8-12', weight: '', rest: '2 min', rpe: 7,
    youtube_url: lib.youtube_url ?? '', notes: '',
  };
}

function relativeTime(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'à l\'instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return new Date(d).toLocaleDateString('fr-FR');
}

// ─── QUICK-CONFIG POPOVER ─────────────────────────────────────────────────────

interface PopoverProps {
  ex: ProgramExercise;
  onChange: (ex: ProgramExercise) => void;
  onClose: () => void;
  dayExercises: ProgramExercise[];
}

function QuickConfig({ ex, onChange, onClose, dayExercises }: PopoverProps) {
  const [local, setLocal] = useState(ex);
  const [ytThumbUrl, setYtThumbUrl] = useState(() => {
    const id = extractYTId(ex.youtube_url);
    return id ? ytThumb(id) : '';
  });
  const [ytError, setYtError] = useState('');

  const set = (k: keyof ProgramExercise, v: any) => setLocal(p => ({ ...p, [k]: v }));

  const handleYT = (url: string) => {
    set('youtube_url', url);
    if (!url) { setYtThumbUrl(''); setYtError(''); return; }
    const id = extractYTId(url);
    if (id) { setYtThumbUrl(ytThumb(id)); setYtError(''); }
    else { setYtThumbUrl(''); setYtError(url.length > 5 ? 'Lien YouTube invalide' : ''); }
  };

  const others = dayExercises.filter(e => e.uid !== ex.uid);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1A2620', border: '1px solid rgba(45,90,53,0.5)',
        borderRadius: 12, padding: 24, width: 480, maxHeight: '90vh',
        overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>{local.color}</span>
            <span style={{ fontFamily: 'var(--cst-display)', fontSize: 18, fontWeight: 800, textTransform: 'uppercase', color: '#fff' }}>{local.name}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Séries / Reps / Charge */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[['Séries', 'sets', 'number'], ['Reps', 'reps', 'text'], ['Charge', 'weight', 'text']].map(([label, key, type]) => (
            <div key={key}>
              <label style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--cst-text-muted)', marginBottom: 4, display: 'block' }}>{label}</label>
              <input className="cst-input" type={type} value={(local as any)[key]}
                onChange={e => set(key as any, type === 'number' ? Number(e.target.value) : e.target.value)}
                style={{ padding: '8px 12px', fontSize: 14 }} />
            </div>
          ))}
        </div>

        {/* Tempo / Récup */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--cst-text-muted)', marginBottom: 4, display: 'block' }}>Récup</label>
            <select className="cst-input" value={local.rest} onChange={e => set('rest', e.target.value)} style={{ padding: '8px 12px' }}>
              {REST_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--cst-text-muted)', marginBottom: 4, display: 'block' }}>RPE cible</label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button key={n} onClick={() => set('rpe', n)} style={{
                  width: 30, height: 30, borderRadius: 4, border: '1px solid',
                  borderColor: local.rpe === n ? 'var(--cst-mid-green)' : 'rgba(255,255,255,0.15)',
                  background: local.rpe === n ? 'var(--cst-mid-green)' : 'transparent',
                  color: '#fff', fontSize: 11, cursor: 'pointer',
                }}>{n}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Couleur */}
        <div>
          <label style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--cst-text-muted)', marginBottom: 4, display: 'block' }}>Couleur</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => set('color', c)} style={{
                width: 36, height: 36, borderRadius: 8, fontSize: 20, cursor: 'pointer',
                border: local.color === c ? '2px solid var(--cst-mid-green)' : '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
              }}>{c}</button>
            ))}
          </div>
        </div>

        {/* YouTube */}
        <div>
          <label style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--cst-text-muted)', marginBottom: 4, display: 'block' }}>YouTube</label>
          <input className="cst-input" placeholder="Coller un lien YouTube..." value={local.youtube_url}
            onChange={e => handleYT(e.target.value)}
            style={{ borderColor: ytError ? '#C56A60' : undefined, padding: '8px 12px' }} />
          {ytError && <div style={{ color: '#C56A60', fontSize: 11, marginTop: 4 }}>{ytError}</div>}
          {ytThumbUrl && (
            <div style={{ marginTop: 8, position: 'relative', borderRadius: 8, overflow: 'hidden', maxWidth: 200 }}>
              <img src={ytThumbUrl} alt="thumbnail" style={{ width: '100%', display: 'block', borderRadius: 8 }} />
              <button onClick={() => window.open(local.youtube_url, '_blank')} style={{
                position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.7)',
                border: 'none', color: '#fff', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer',
              }}>▶ Prévisualiser</button>
            </div>
          )}
        </div>

        {/* Superset */}
        {others.length > 0 && (
          <div>
            <label style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--cst-text-muted)', marginBottom: 4, display: 'block' }}>Superset avec</label>
            <select className="cst-input" value={local.superset_with ?? ''} onChange={e => set('superset_with', e.target.value || undefined)} style={{ padding: '8px 12px' }}>
              <option value="">Aucun</option>
              {others.map(o => <option key={o.uid} value={o.uid}>{o.name}</option>)}
            </select>
          </div>
        )}

        {/* Notes */}
        <div>
          <label style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--cst-text-muted)', marginBottom: 4, display: 'block' }}>Notes coach</label>
          <textarea className="cst-input" rows={3} placeholder="Omoplate serrées, descente contrôlée 3s…" value={local.notes}
            onChange={e => set('notes', e.target.value)} style={{ resize: 'none', fontFamily: 'var(--cst-ui)', padding: '8px 12px' }} />
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={onClose}>ANNULER</button>
          <button className="cst-btn cst-btn-primary" style={{ flex: 1 }} onClick={() => { onChange(local); onClose(); }}>AJOUTER ✓</button>
        </div>
      </div>
    </div>
  );
}

// ─── SORTABLE EXERCISE CARD ───────────────────────────────────────────────────

function SortableExCard({ ex, onEdit, onDelete }: { ex: ProgramExercise; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ex.uid });
  const ytId = extractYTId(ex.youtube_url);

  return (
    <div ref={setNodeRef} style={{
      transform: CSS.Transform.toString(transform), transition,
      opacity: isDragging ? 0.4 : 1,
      background: '#1F2A22', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, padding: '10px 12px',
      display: 'flex', alignItems: 'flex-start', gap: 8,
    }}>
      <span {...attributes} {...listeners} style={{
        cursor: 'grab', color: 'rgba(255,255,255,0.3)', fontSize: 14,
        paddingTop: 2, flexShrink: 0, userSelect: 'none',
      }}>⠿</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 12 }}>{ex.color}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</span>
        </div>
        <div style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: 'var(--cst-text-muted)' }}>
          {ex.sets}×{ex.reps}{ex.weight ? ` · ${ex.weight}` : ''} · {ex.rest} · RPE {ex.rpe}
        </div>
        {ytId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <span style={{ fontSize: 9, color: 'var(--cst-mid-green)' }}>🎬 vidéo</span>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={onEdit} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13, padding: 2 }}>✎</button>
        <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'rgba(197,106,96,0.7)', cursor: 'pointer', fontSize: 13, padding: 2 }}>🗑</button>
      </div>
    </div>
  );
}

// ─── DROPPABLE DAY COLUMN ────────────────────────────────────────────────────

function DayColumn({
  day, weekIdx, dayIdx,
  isOver, onAddExercise, onUpdateExercise, onDeleteExercise, onRenameDay,
}: {
  day: Day; weekIdx: number; dayIdx: number;
  isOver: boolean;
  onAddExercise: (dayId: string) => void;
  onUpdateExercise: (dayId: string, ex: ProgramExercise) => void;
  onDeleteExercise: (dayId: string, uid: string) => void;
  onRenameDay: (dayId: string, name: string, type: Day['type']) => void;
}) {
  const [editingEx, setEditingEx] = useState<ProgramExercise | null>(null);
  const [renamingDay, setRenamingDay] = useState(false);
  const [dayName, setDayName] = useState(day.name);
  const [dayType, setDayType] = useState(day.type);

  return (
    <div style={{
      minWidth: 180, flex: 1,
      background: isOver ? 'rgba(45,90,53,0.08)' : 'rgba(255,255,255,0.02)',
      border: isOver ? '2px dashed #2D5A35' : '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10, padding: 12,
      display: 'flex', flexDirection: 'column', gap: 8, minHeight: 320,
      transition: 'background 0.2s, border-color 0.2s',
    }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8, marginBottom: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: 'var(--cst-display)', fontSize: 16, fontWeight: 800, color: day.type === 'Repos' ? 'rgba(255,255,255,0.4)' : '#fff', textTransform: 'uppercase' }}>
            {day.name}
          </span>
          <button onClick={() => setRenamingDay(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}>✎</button>
        </div>
        <span style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: 'var(--cst-text-muted)' }}>{day.type.toUpperCase()}</span>
      </div>

      {/* Rename modal */}
      {renamingDay && (
        <div style={{ background: '#243029', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input className="cst-input" value={dayName} onChange={e => setDayName(e.target.value)} style={{ padding: '6px 10px', fontSize: 13 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {(['Entraînement', 'Repos', 'Optionnel'] as Day['type'][]).map(t => (
              <button key={t} onClick={() => setDayType(t)} style={{
                flex: 1, padding: '4px 0', borderRadius: 4, border: '1px solid',
                borderColor: dayType === t ? 'var(--cst-mid-green)' : 'rgba(255,255,255,0.15)',
                background: dayType === t ? 'rgba(45,90,53,0.3)' : 'transparent',
                color: '#fff', fontSize: 10, cursor: 'pointer',
              }}>{t}</button>
            ))}
          </div>
          <button className="cst-btn cst-btn-primary cst-btn-sm" onClick={() => { onRenameDay(day.id, dayName, dayType); setRenamingDay(false); }}>OK</button>
        </div>
      )}

      {/* Exercises */}
      <SortableContext items={day.exercises.map(e => e.uid)} strategy={verticalListSortingStrategy}>
        {day.exercises.map(ex => (
          <SortableExCard key={ex.uid} ex={ex}
            onEdit={() => setEditingEx(ex)}
            onDelete={() => { onDeleteExercise(day.id, ex.uid); toast('Exercice supprimé', { action: { label: 'Annuler', onClick: () => {} } }); }} />
        ))}
      </SortableContext>

      {day.type !== 'Repos' && (
        <button onClick={() => onAddExercise(day.id)} style={{
          border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 6,
          padding: '8px', textAlign: 'center', background: 'transparent',
          color: 'rgba(255,255,255,0.4)', fontSize: 11, cursor: 'pointer',
          fontFamily: 'var(--cst-mono)', letterSpacing: '0.12em', marginTop: 'auto',
        }}>+ EXERCICE</button>
      )}

      {/* Quick config popover */}
      {editingEx && (
        <QuickConfig ex={editingEx} dayExercises={day.exercises}
          onChange={ex => onUpdateExercise(day.id, ex)}
          onClose={() => setEditingEx(null)} />
      )}
    </div>
  );
}

// ─── ASSIGN MODAL ─────────────────────────────────────────────────────────────

function AssignModal({ programId, onClose }: { programId: string; onClose: () => void }) {
  const [members, setMembers] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    import('@/lib/coach.functions').then(({ listMembers }) => {
      listMembers({}).then(r => setMembers(r.members));
    });
  }, []);

  const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const assign = async () => {
    if (!selected.size) return;
    setLoading(true);
    const { assignProgram } = await import('@/lib/coach.functions');
    await Promise.all(Array.from(selected).map(mid => assignProgram({ data: { member_id: mid, program_id: programId, start_date: startDate } })));
    toast.success(`Programme assigné à ${selected.size} membre(s) !`);
    setLoading(false);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#1A2620', border: '1px solid rgba(45,90,53,0.5)', borderRadius: 12, padding: 24, width: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--cst-display)', fontSize: 20, color: '#fff' }}>ASSIGNER LE PROGRAMME</h3>
        <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {members.length === 0 && <p style={{ color: 'var(--cst-text-muted)', fontSize: 13 }}>Aucun membre trouvé.</p>}
          {members.map(m => (
            <div key={m.id} onClick={() => toggle(m.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
              background: selected.has(m.id) ? 'rgba(45,90,53,0.2)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${selected.has(m.id) ? 'var(--cst-mid-green)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 8, cursor: 'pointer',
            }}>
              <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${selected.has(m.id) ? 'var(--cst-mid-green)' : 'rgba(255,255,255,0.3)'}`, background: selected.has(m.id) ? 'var(--cst-mid-green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>
                {selected.has(m.id) && '✓'}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{m.first_name} {m.last_name}</div>
                <div style={{ fontSize: 11, color: 'var(--cst-text-muted)' }}>{m.program_name ? `Programme actif : ${m.program_name}` : 'Pas de programme actif'}</div>
              </div>
            </div>
          ))}
        </div>
        <div>
          <label style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--cst-text-muted)', marginBottom: 4, display: 'block' }}>Date de début</label>
          <input className="cst-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '8px 12px' }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={onClose}>ANNULER</button>
          <button className="cst-btn cst-btn-primary" style={{ flex: 1, opacity: loading ? 0.7 : 1 }} disabled={loading || !selected.size} onClick={assign}>
            ASSIGNER AUX SÉLECTIONNÉS ●
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN BUILDER ─────────────────────────────────────────────────────────────

export default function BuilderNew() {
  const saveFn = useServerFn(saveProgram);

  // Program meta
  const [name, setName] = useState('Force Fondamentale – Cycle 1');
  const [duration, setDuration] = useState(8);
  const [objective, setObjective] = useState('Force');
  const [level, setLevel] = useState('Intermédiaire');
  const [programNotes, setProgramNotes] = useState('');
  const [programId, setProgramId] = useState<string | undefined>();

  // Structure
  const [weeks, setWeeks] = useState<Week[]>([makeWeek()]);
  const [activeWeekIdx, setActiveWeekIdx] = useState(0);

  // DnD state
  const [activeLibEx, setActiveLibEx] = useState<LibraryExercise | null>(null);
  const [activeProgramEx, setActiveProgramEx] = useState<ProgramExercise | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Pending popover (for new exercise just dropped)
  const [pendingPopover, setPendingPopover] = useState<{ dayId: string; ex: ProgramExercise } | null>(null);

  // Library
  const [libExercises, setLibExercises] = useState<LibraryExercise[]>(BASE_LIBRARY);
  const [libSearch, setLibSearch] = useState('');
  const [libCat, setLibCat] = useState<Category>('TOUT');
  const [creatingEx, setCreatingEx] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExCat, setNewExCat] = useState<Category>('PUSH');
  const [newExColor, setNewExColor] = useState<ExColor>('🔴');
  const [newExYT, setNewExYT] = useState('');

  // UI
  const [saving, setSaving] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  // ─ Library filter
  const filteredLib = libExercises.filter(e => {
    const matchCat = libCat === 'TOUT' || e.category === libCat;
    const matchSearch = e.name.toLowerCase().includes(libSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  const showCreate = libSearch.length > 2 && !libExercises.some(e => e.name.toLowerCase() === libSearch.toLowerCase());

  // ─ Mutations
  const currentWeek = weeks[activeWeekIdx];

  const updateWeeks = (fn: (w: Week[]) => Week[]) => setWeeks(fn);

  const addExerciseToDayFromLib = useCallback((dayId: string, lib: LibraryExercise) => {
    const ex = makeExercise(lib);
    updateWeeks(ws => ws.map((w, wi) => wi !== activeWeekIdx ? w : {
      ...w,
      days: w.days.map(d => d.id !== dayId ? d : { ...d, exercises: [...d.exercises, ex] }),
    }));
    setPendingPopover({ dayId, ex });
  }, [activeWeekIdx]);

  const updateExercise = useCallback((dayId: string, ex: ProgramExercise) => {
    updateWeeks(ws => ws.map((w, wi) => wi !== activeWeekIdx ? w : {
      ...w,
      days: w.days.map(d => d.id !== dayId ? d : {
        ...d, exercises: d.exercises.map(e => e.uid === ex.uid ? ex : e),
      }),
    }));
  }, [activeWeekIdx]);

  const deleteExercise = useCallback((dayId: string, uid: string) => {
    updateWeeks(ws => ws.map((w, wi) => wi !== activeWeekIdx ? w : {
      ...w,
      days: w.days.map(d => d.id !== dayId ? d : { ...d, exercises: d.exercises.filter(e => e.uid !== uid) }),
    }));
  }, [activeWeekIdx]);

  const renameDay = useCallback((dayId: string, name: string, type: Day['type']) => {
    updateWeeks(ws => ws.map((w, wi) => wi !== activeWeekIdx ? w : {
      ...w,
      days: w.days.map(d => d.id !== dayId ? d : { ...d, name, type }),
    }));
  }, [activeWeekIdx]);

  const addWeek = () => {
    const prev = weeks[weeks.length - 1];
    const newWeek: Week = {
      id: uid(),
      days: prev.days.map(d => ({ ...d, id: uid(), exercises: d.exercises.map(e => ({ ...e, uid: uid() })) })),
    };
    setWeeks(w => [...w, newWeek]);
    setActiveWeekIdx(weeks.length);
  };

  // ─ DnD handlers
  const onDragStart = (e: DragStartEvent) => {
    if (e.active.data.current?.type === 'library') {
      setActiveLibEx(e.active.data.current.exercise);
    } else if (e.active.data.current?.type === 'program') {
      setActiveProgramEx(e.active.data.current.exercise);
    }
  };

  const onDragOver = (e: DragOverEvent) => {
    setOverId(e.over ? String(e.over.id) : null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveLibEx(null);
    setActiveProgramEx(null);
    setOverId(null);

    if (!over) return;

    // Library → Day
    if (active.data.current?.type === 'library') {
      const dayId = currentWeek.days.find(d => d.id === String(over.id))?.id
        ?? currentWeek.days.find(d => d.exercises.some(ex => ex.uid === String(over.id)))?.id;
      if (dayId) addExerciseToDayFromLib(dayId, active.data.current.exercise);
      return;
    }

    // Program exercise reorder / move
    if (active.data.current?.type === 'program') {
      const srcDayId = active.data.current.dayId as string;
      const activeUid = String(active.id);
      const overUid = String(over.id);

      // Find destination
      const destDay = currentWeek.days.find(d =>
        d.id === overUid || d.exercises.some(ex => ex.uid === overUid)
      );
      if (!destDay) return;

      const srcDay = currentWeek.days.find(d => d.id === srcDayId);
      if (!srcDay) return;

      const ex = srcDay.exercises.find(e => e.uid === activeUid);
      if (!ex) return;

      if (srcDay.id === destDay.id) {
        // Reorder within same day
        const oldIdx = srcDay.exercises.findIndex(e => e.uid === activeUid);
        const newIdx = destDay.exercises.findIndex(e => e.uid === overUid);
        if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
        updateWeeks(ws => ws.map((w, wi) => wi !== activeWeekIdx ? w : {
          ...w,
          days: w.days.map(d => d.id !== srcDay.id ? d : { ...d, exercises: arrayMove(d.exercises, oldIdx, newIdx) }),
        }));
      } else {
        // Move to different day
        updateWeeks(ws => ws.map((w, wi) => wi !== activeWeekIdx ? w : {
          ...w,
          days: w.days.map(d => {
            if (d.id === srcDay.id) return { ...d, exercises: d.exercises.filter(e => e.uid !== activeUid) };
            if (d.id === destDay.id) return { ...d, exercises: [...d.exercises, ex] };
            return d;
          }),
        }));
      }
    }
  };

  // ─ Save
  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await saveFn({ data: { id: programId, name, duration_weeks: duration, objective, level, description: programNotes, structure: { weeks } } });
      setProgramId(r.program.id);
      toast.success('Programme sauvegardé !');
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur lors de la sauvegarde');
    } finally { setSaving(false); }
  };

  // ─ Create exercise
  const handleCreateExercise = () => {
    const ex: LibraryExercise = { id: uid(), name: newExName || libSearch, category: newExCat, color: newExColor, youtube_url: newExYT || undefined };
    setLibExercises(l => [...l, ex]);
    setCreatingEx(false); setNewExName(''); setNewExYT('');
    toast.success(`Exercice "${ex.name}" créé !`);
  };

  // ─ Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(); }
      if (e.key === 'Escape') { setPendingPopover(null); setCreatingEx(false); setShowAssign(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [name, duration, objective, level, programNotes, weeks, programId]);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="cst-screen" style={{ flexDirection: 'row' }}>
      <CoachSidebar />

      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>

        {/* ── LEFT PANEL — Library ── */}
        <aside style={{
          width: 280, flexShrink: 0, background: '#16261A',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: 'var(--cst-text-muted)', letterSpacing: '0.2em', marginBottom: 10 }}>BIBLIOTHÈQUE · {libExercises.length} EX.</div>
            <input className="cst-input" placeholder="🔍 Rechercher..." value={libSearch}
              onChange={e => setLibSearch(e.target.value)} style={{ padding: '8px 12px', fontSize: 13, marginBottom: 10 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(['TOUT','PUSH','PULL','LEGS','CORE','CARDIO'] as Category[]).map(c => (
                <button key={c} onClick={() => setLibCat(c)} style={{
                  padding: '3px 8px', borderRadius: 4, border: '1px solid',
                  borderColor: libCat === c ? 'var(--cst-mid-green)' : 'rgba(255,255,255,0.12)',
                  background: libCat === c ? 'rgba(45,90,53,0.25)' : 'transparent',
                  color: libCat === c ? '#fff' : 'rgba(255,255,255,0.6)',
                  fontFamily: 'var(--cst-mono)', fontSize: 9, cursor: 'pointer',
                }}>{c}</button>
              ))}
            </div>
          </div>

          <div className="cst-scroll" style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filteredLib.map(ex => (
              <LibraryItem key={ex.id} exercise={ex} />
            ))}

            {/* Create suggestion */}
            {showCreate && !creatingEx && (
              <button onClick={() => { setCreatingEx(true); setNewExName(libSearch); }} style={{
                width: '100%', padding: '10px 12px', background: 'rgba(45,90,53,0.1)',
                border: '1px dashed rgba(45,90,53,0.4)', borderRadius: 8,
                color: 'var(--cst-mid-green)', fontFamily: 'var(--cst-mono)', fontSize: 10,
                cursor: 'pointer', textAlign: 'left', letterSpacing: '0.1em',
              }}>+ Créer "{libSearch}"</button>
            )}

            {/* Create form */}
            {creatingEx && (
              <div style={{ background: '#243029', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input className="cst-input" placeholder="Nom" value={newExName} onChange={e => setNewExName(e.target.value)} style={{ padding: '6px 10px', fontSize: 13 }} />
                <select className="cst-input" value={newExCat} onChange={e => setNewExCat(e.target.value as Category)} style={{ padding: '6px 10px' }}>
                  {['PUSH','PULL','LEGS','CORE','CARDIO'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 4 }}>
                  {COLORS.map(c => <button key={c} onClick={() => setNewExColor(c)} style={{ flex: 1, fontSize: 18, background: newExColor === c ? 'rgba(45,90,53,0.3)' : 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, cursor: 'pointer' }}>{c}</button>)}
                </div>
                <input className="cst-input" placeholder="YouTube URL (optionnel)" value={newExYT} onChange={e => setNewExYT(e.target.value)} style={{ padding: '6px 10px', fontSize: 12 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={() => setCreatingEx(false)}>Annuler</button>
                  <button className="cst-btn cst-btn-primary cst-btn-sm" style={{ flex: 1 }} onClick={handleCreateExercise}>CRÉER ET AJOUTER →</button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── RIGHT PANEL — Program ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {/* Settings bar */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <input className="cst-input" value={name} onChange={e => setName(e.target.value)}
              style={{ flex: '1 1 220px', padding: '8px 12px', fontSize: 14, fontWeight: 600, minWidth: 180 }} />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[4,6,8,12].map(w => (
                <button key={w} onClick={() => setDuration(w)} style={{
                  padding: '6px 10px', borderRadius: 6, border: '1px solid',
                  borderColor: duration === w ? 'var(--cst-mid-green)' : 'rgba(255,255,255,0.15)',
                  background: duration === w ? 'rgba(45,90,53,0.25)' : 'transparent',
                  color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--cst-mono)',
                }}>{w} sem</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['Force','Hypertrophie','Endurance','Mobilité'].map(o => (
                <button key={o} onClick={() => setObjective(o)} style={{
                  padding: '6px 10px', borderRadius: 6, border: '1px solid',
                  borderColor: objective === o ? 'var(--cst-mid-green)' : 'rgba(255,255,255,0.15)',
                  background: objective === o ? 'rgba(45,90,53,0.25)' : 'transparent',
                  color: '#fff', fontSize: 11, cursor: 'pointer',
                }}>{o}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button className="cst-btn cst-btn-ghost-dark cst-btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? '...' : 'SAUVEGARDER ●'}
              </button>
              <button className="cst-btn cst-btn-primary cst-btn-sm" onClick={() => { if (!programId) { toast.error('Sauvegarde d\'abord le programme.'); return; } setShowAssign(true); }}>
                ASSIGNER →
              </button>
            </div>
          </div>

          {/* Week tabs */}
          <div style={{ padding: '10px 20px 0', display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
            {weeks.map((w, i) => (
              <button key={w.id} onClick={() => setActiveWeekIdx(i)} style={{
                padding: '8px 14px', borderRadius: '6px 6px 0 0', border: '1px solid',
                borderBottom: 'none',
                borderColor: activeWeekIdx === i ? 'rgba(45,90,53,0.5)' : 'rgba(255,255,255,0.08)',
                background: activeWeekIdx === i ? 'rgba(45,90,53,0.15)' : 'transparent',
                color: activeWeekIdx === i ? '#fff' : 'rgba(255,255,255,0.5)',
                fontFamily: 'var(--cst-mono)', fontSize: 10, cursor: 'pointer',
              }}>SEM {i + 1}</button>
            ))}
            <button onClick={addWeek} style={{
              padding: '8px 12px', borderRadius: '6px 6px 0 0', border: '1px dashed rgba(255,255,255,0.2)',
              borderBottom: 'none', background: 'transparent', color: 'rgba(255,255,255,0.4)',
              fontFamily: 'var(--cst-mono)', fontSize: 10, cursor: 'pointer',
            }}>+ Semaine</button>
          </div>

          {/* Day columns */}
          <div className="cst-scroll" style={{ flex: 1, padding: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            {currentWeek.days.map((day) => (
              <DroppableDayWrapper key={day.id} dayId={day.id} overId={overId}>
                <DayColumn
                  day={day} weekIdx={activeWeekIdx} dayIdx={0}
                  isOver={overId === day.id || day.exercises.some(e => overId === e.uid && false)}
                  onAddExercise={(dayId) => {
                    const dummy: LibraryExercise = { id: uid(), name: 'Nouvel exercice', category: 'PUSH', color: '🟢' };
                    addExerciseToDayFromLib(dayId, dummy);
                  }}
                  onUpdateExercise={updateExercise}
                  onDeleteExercise={deleteExercise}
                  onRenameDay={renameDay}
                />
              </DroppableDayWrapper>
            ))}
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeLibEx && (
            <div style={{ background: '#243029', border: '1px solid var(--cst-mid-green)', borderRadius: 8, padding: '8px 12px', opacity: 0.9, transform: 'scale(1.05)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{activeLibEx.color}</span>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{activeLibEx.name}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Pending popover after drop from library */}
      {pendingPopover && (
        <QuickConfig
          ex={pendingPopover.ex}
          dayExercises={currentWeek.days.find(d => d.id === pendingPopover.dayId)?.exercises ?? []}
          onChange={ex => updateExercise(pendingPopover.dayId, ex)}
          onClose={() => setPendingPopover(null)}
        />
      )}

      {/* Assign modal */}
      {showAssign && programId && <AssignModal programId={programId} onClose={() => setShowAssign(false)} />}
    </div>
  );
}

// ─── LIBRARY ITEM (draggable) ─────────────────────────────────────────────────

function LibraryItem({ exercise }: { exercise: LibraryExercise }) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: `lib-${exercise.id}`,
    data: { type: 'library', exercise },
  });

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', borderRadius: 6,
      background: isDragging ? 'rgba(45,90,53,0.2)' : 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      cursor: 'grab', opacity: isDragging ? 0.5 : 1,
      transition: 'background 0.15s',
    }}>
      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>⠿⠿</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exercise.name}</div>
        <div style={{ fontFamily: 'var(--cst-mono)', fontSize: 9, color: 'var(--cst-text-muted)' }}>{exercise.category}</div>
      </div>
      <span style={{ fontSize: 14 }}>{exercise.color}</span>
    </div>
  );
}

// ─── DROPPABLE WRAPPER ────────────────────────────────────────────────────────

function DroppableDayWrapper({ dayId, overId, children }: { dayId: string; overId: string | null; children: React.ReactNode }) {
  const { setNodeRef } = useSortable({ id: dayId, data: { type: 'day' } });
  const isOver = overId === dayId;
  return (
    <div ref={setNodeRef} style={{ flex: 1, minWidth: 160, maxWidth: 240 }}>
      {children}
    </div>
  );
}
