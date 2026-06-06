import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import CoachSidebar from "@/components/CoachSidebar";
import {
  listExercises,
  listIntensityCodes,
  listGlossary,
  upsertExercise,
  setExerciseArchived,
  seedExerciseLibraryV2,
} from "@/lib/exercises.functions";

type Exercise = {
  id: string;
  name: string;
  intensity_code: string | null;
  category: string | null;
  muscle_group: string | null;
  equipement: string | null;
  default_tempo: string | null;
  youtube_url: string | null;
  youtube_id: string | null;
  coach_notes: string | null;
  is_archived: boolean | null;
  movement_patterns: string[] | null;
};

type IntensityCode = { code: string; label: string; description: string; color_hex: string };
type GlossaryEntry = { cle: string; titre: string; contenu: string };

const PATTERN_OPTIONS: { value: string; label: string }[] = [
  { value: "push", label: "Push" },
  { value: "pull", label: "Pull" },
  { value: "legs", label: "Legs" },
  { value: "hinge", label: "Hinge" },
  { value: "core", label: "Core" },
  { value: "cardio", label: "Cardio" },
  { value: "mobility", label: "Mobilité" },
  { value: "carry", label: "Carry" },
];

const EMPTY: Partial<Exercise> = {
  name: "",
  intensity_code: "non_classe",
  muscle_group: "",
  equipement: "",
  default_tempo: "",
  youtube_url: "",
  coach_notes: "",
  is_archived: false,
  movement_patterns: [],
};

export default function Exercices() {
  const fetchExercises = useServerFn(listExercises);
  const fetchCodes = useServerFn(listIntensityCodes);
  const fetchGlossary = useServerFn(listGlossary);
  const saveExercise = useServerFn(upsertExercise);
  const archiveFn = useServerFn(setExerciseArchived);
  const seedFn = useServerFn(seedExerciseLibraryV2);

  const [items, setItems] = useState<Exercise[]>([]);
  const [codes, setCodes] = useState<IntensityCode[]>([]);
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const [search, setSearch] = useState("");
  const [filterMuscle, setFilterMuscle] = useState<Set<string>>(new Set());
  const [filterEquip, setFilterEquip] = useState<Set<string>>(new Set());
  const [filterIntensity, setFilterIntensity] = useState<Set<string>>(new Set());
  const [filterPattern, setFilterPattern] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [editing, setEditing] = useState<Partial<Exercise> | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const [ex, cd, gl] = await Promise.all([fetchExercises(), fetchCodes(), fetchGlossary()]);
      setItems((ex.exercises as Exercise[]) || []);
      setCodes(cd.codes || []);
      setGlossary(gl.entries || []);
    } catch (e) {
      toast.error((e as Error).message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const codeMap = useMemo(() => {
    const m = new Map<string, IntensityCode>();
    codes.forEach((c) => m.set(c.code, c));
    return m;
  }, [codes]);

  const muscles = useMemo(() => {
    const s = new Set<string>();
    items.forEach((it) => it.muscle_group && s.add(it.muscle_group));
    return Array.from(s).sort();
  }, [items]);
  const equipments = useMemo(() => {
    const s = new Set<string>();
    items.forEach((it) => it.equipement && s.add(it.equipement));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (!showArchived && it.is_archived) return false;
      if (filterMuscle.size && (!it.muscle_group || !filterMuscle.has(it.muscle_group))) return false;
      if (filterEquip.size && (!it.equipement || !filterEquip.has(it.equipement))) return false;
      if (filterIntensity.size) {
        const code = it.intensity_code || it.category || "non_classe";
        if (!filterIntensity.has(code)) return false;
      }
      if (filterPattern.size) {
        const pats = it.movement_patterns ?? [];
        if (!pats.some((p) => filterPattern.has(p))) return false;
      }
      if (q && !it.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, filterMuscle, filterEquip, filterIntensity, filterPattern, showArchived]);

  function toggleInSet(set: Set<string>, value: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await seedFn();
      toast.success(`Import : ${res.inserted} ajoutés · ${res.skipped} déjà présents`);
      await reload();
    } catch (e) {
      toast.error((e as Error).message || "Échec de l'import");
    } finally {
      setSeeding(false);
    }
  }

  async function handleSave() {
    if (!editing) return;
    const name = (editing.name || "").trim();
    if (!name) {
      toast.error("Le nom est requis");
      return;
    }
    try {
      await saveExercise({
        data: {
          id: editing.id,
          name,
          intensity_code: editing.intensity_code || "non_classe",
          muscle_group: editing.muscle_group || null,
          equipement: editing.equipement || null,
          default_tempo: editing.default_tempo || null,
          youtube_url: editing.youtube_url || null,
          coach_notes: editing.coach_notes || null,
          is_archived: !!editing.is_archived,
          movement_patterns: editing.movement_patterns ?? [],
        },
      });
      toast.success("Renommé ✓");
      setEditing(null);
      await reload();
    } catch (e) {
      toast.error((e as Error).message || "Erreur");
    }
  }

  async function handleArchiveToggle(ex: Exercise) {
    try {
      await archiveFn({ data: { id: ex.id, is_archived: !ex.is_archived } });
      await reload();
    } catch (e) {
      toast.error((e as Error).message || "Erreur");
    }
  }

  function toggleExpand(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  }

  function getYoutubeEmbedId(ex: Exercise): string | null {
    if (ex.youtube_id) return ex.youtube_id;
    if (!ex.youtube_url) return null;
    const m = ex.youtube_url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/
    );
    return m ? m[1] : null;
  }

  const showSeedButton = !loading && items.filter((i) => !i.is_archived).length < 100;

  return (
    <div className="cst-row" style={{ minHeight: "100vh", background: "var(--cst-bg)" }}>
      <CoachSidebar />
      <div style={{ flex: 1, padding: "32px 28px 96px", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <h1 className="cst-display" style={{ fontSize: 32, margin: 0, color: "var(--cst-text)" }}>
            Bibliothèque
          </h1>
          <span
            className="cst-mono"
            style={{ fontSize: 11, color: "var(--cst-text-muted)", letterSpacing: "0.2em" }}
          >
            {filtered.length} / {items.length} EXERCICES
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => setHelpOpen(true)}
              style={btnGhost}
            >
              ? Aide / Légende
            </button>
            {showSeedButton && (
              <button
                onClick={handleSeed}
                disabled={seeding}
                style={btnPrimary}
              >
                {seeding ? "Import…" : "Importer la bibliothèque (512)"}
              </button>
            )}
            <button onClick={() => setEditing({ ...EMPTY })} style={btnPrimary}>
              + Ajouter
            </button>
          </div>
        </div>

        {/* Filters */}
        <div
          style={{
            marginTop: 20,
            padding: 16,
            background: "var(--cst-card-bg)",
            border: "1px solid var(--cst-card-border)",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <input
            placeholder="Rechercher un exercice…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--cst-input-border)",
              background: "var(--cst-input-bg)",
              color: "var(--cst-text)",
              fontSize: 14,
            }}
          />
          <FilterChips
            label="Intensité"
            values={codes.map((c) => ({ value: c.code, label: c.label, color: c.color_hex }))}
            selected={filterIntensity}
            onToggle={(v) => toggleInSet(filterIntensity, v, setFilterIntensity)}
          />
          <FilterChips
            label="Groupe musculaire"
            values={muscles.map((m) => ({ value: m, label: m }))}
            selected={filterMuscle}
            onToggle={(v) => toggleInSet(filterMuscle, v, setFilterMuscle)}
          />
          <FilterChips
            label="Équipement"
            values={equipments.map((e) => ({ value: e, label: e }))}
            selected={filterEquip}
            onToggle={(v) => toggleInSet(filterEquip, v, setFilterEquip)}
          />
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--cst-text-soft)" }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Afficher les archivés
          </label>
        </div>

        {/* List */}
        <div
          style={{
            marginTop: 20,
            background: "var(--cst-card-bg)",
            border: "1px solid var(--cst-card-border)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--cst-text-muted)" }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--cst-text-muted)" }}>
              Aucun exercice. {showSeedButton && "Clique sur \u00ab Importer la biblioth\u00e8que \u00bb pour charger les 512 exos."}
            </div>
          ) : (
            filtered.map((ex) => {
              const code = ex.intensity_code || ex.category || "non_classe";
              const meta = codeMap.get(code);
              const isOpen = expanded.has(ex.id);
              const ytId = getYoutubeEmbedId(ex);
              return (
                <div
                  key={ex.id}
                  style={{
                    borderTop: "1px solid var(--cst-hairline)",
                    opacity: ex.is_archived ? 0.55 : 1,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "16px minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) 80px auto",
                      gap: 12,
                      padding: "12px 16px",
                      alignItems: "center",
                    }}
                  >
                    <span
                      title={meta?.label || code}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: meta?.color_hex || "#999",
                        border: "1px solid rgba(0,0,0,0.15)",
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--cst-text)" }}>{ex.name}</div>
                      {ex.is_archived && (
                        <div className="cst-mono" style={{ fontSize: 9, color: "var(--cst-text-muted)" }}>
                          ARCHIVÉ
                        </div>
                      )}
                    </div>
                    <span className="cst-mono" style={{ fontSize: 11, color: "var(--cst-text-soft)" }}>
                      {ex.muscle_group || "—"}
                    </span>
                    <span className="cst-mono" style={{ fontSize: 11, color: "var(--cst-text-soft)" }}>
                      {ex.equipement || "—"}
                    </span>
                    <span className="cst-mono" style={{ fontSize: 11, color: "var(--cst-text-soft)" }}>
                      {ex.default_tempo || "—"}
                    </span>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      {ytId && (
                        <button onClick={() => setVideoUrl(ytId)} style={btnMini}>
                          ▶
                        </button>
                      )}
                      <button onClick={() => toggleExpand(ex.id)} style={btnMini}>
                        {isOpen ? "−" : "i"}
                      </button>
                      <button onClick={() => setEditing(ex)} style={btnMini}>
                        ✎
                      </button>
                      <button
                        onClick={() => handleArchiveToggle(ex)}
                        style={btnMini}
                        title={ex.is_archived ? "Désarchiver" : "Archiver"}
                      >
                        {ex.is_archived ? "↺" : "✕"}
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div
                      style={{
                        padding: "0 16px 14px 44px",
                        fontSize: 13,
                        color: "var(--cst-text-soft)",
                        fontStyle: "italic",
                      }}
                    >
                      {ex.coach_notes || "Aucune consigne renseignée."}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Edit drawer */}
      {editing && (
        <Drawer onClose={() => setEditing(null)} title={editing.id ? "Modifier l'exercice" : "Nouvel exercice"}>
          <Field label="Nom *">
            <input
              value={editing.name || ""}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="Intensité">
            <select
              value={editing.intensity_code || "non_classe"}
              onChange={(e) => setEditing({ ...editing, intensity_code: e.target.value })}
              style={inputStyle}
            >
              {codes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Groupe musculaire">
            <input
              value={editing.muscle_group || ""}
              onChange={(e) => setEditing({ ...editing, muscle_group: e.target.value })}
              list="muscle-list"
              style={inputStyle}
            />
            <datalist id="muscle-list">
              {muscles.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
          <Field label="Équipement">
            <input
              value={editing.equipement || ""}
              onChange={(e) => setEditing({ ...editing, equipement: e.target.value })}
              list="equip-list"
              style={inputStyle}
            />
            <datalist id="equip-list">
              {equipments.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
          <Field label="Tempo par défaut">
            <input
              value={editing.default_tempo || ""}
              onChange={(e) => setEditing({ ...editing, default_tempo: e.target.value })}
              placeholder="ex: 3010"
              style={inputStyle}
            />
          </Field>
          <Field label="URL YouTube">
            <input
              value={editing.youtube_url || ""}
              onChange={(e) => setEditing({ ...editing, youtube_url: e.target.value })}
              placeholder="https://youtu.be/…"
              style={inputStyle}
            />
          </Field>
          <Field label="Consignes">
            <textarea
              value={editing.coach_notes || ""}
              onChange={(e) => setEditing({ ...editing, coach_notes: e.target.value })}
              rows={5}
              style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }}
            />
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={handleSave} style={btnPrimary}>
              Enregistrer
            </button>
            <button onClick={() => setEditing(null)} style={btnGhost}>
              Annuler
            </button>
          </div>
        </Drawer>
      )}

      {/* Help drawer */}
      {helpOpen && (
        <Drawer onClose={() => setHelpOpen(false)} title="Aide / Légende">
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--cst-text)", marginBottom: 12 }}>
              Code couleur d'intensité
            </h3>
            {codes.map((c) => (
              <div key={c.code} style={{ display: "flex", gap: 10, padding: "8px 0", alignItems: "flex-start" }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: c.color_hex,
                    flexShrink: 0,
                    marginTop: 3,
                    border: "1px solid rgba(0,0,0,0.15)",
                  }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--cst-text)" }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: "var(--cst-text-soft)" }}>{c.description}</div>
                </div>
              </div>
            ))}
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--cst-text)", marginBottom: 12 }}>Glossaire</h3>
            {glossary.map((g) => (
              <div key={g.cle} style={{ padding: "10px 0", borderTop: "1px solid var(--cst-hairline)" }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "var(--cst-text)" }}>{g.titre}</div>
                <div style={{ fontSize: 12, color: "var(--cst-text-soft)", marginTop: 4, lineHeight: 1.55 }}>
                  {g.contenu}
                </div>
              </div>
            ))}
          </div>
        </Drawer>
      )}

      {/* Video modal */}
      {videoUrl && (
        <div
          onClick={() => setVideoUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(880px, 100%)",
              aspectRatio: "16/9",
              background: "#000",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <iframe
              src={`https://www.youtube.com/embed/${videoUrl}?autoplay=1`}
              title="Démo"
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{ width: "100%", height: "100%", border: 0 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChips({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string;
  values: { value: string; label: string; color?: string }[];
  selected: Set<string>;
  onToggle: (v: string) => void;
}) {
  if (values.length === 0) return null;
  return (
    <div>
      <div className="cst-mono" style={{ fontSize: 9, color: "var(--cst-text-muted)", letterSpacing: "0.2em", marginBottom: 6 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {values.map((v) => {
          const on = selected.has(v.value);
          return (
            <button
              key={v.value}
              onClick={() => onToggle(v.value)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                borderRadius: 999,
                border: on ? "1px solid var(--cst-mid-green)" : "1px solid var(--cst-input-border)",
                background: on ? "rgba(45,90,53,0.15)" : "var(--cst-input-bg)",
                color: "var(--cst-text)",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {v.color && (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: v.color,
                    border: "1px solid rgba(0,0,0,0.15)",
                  }}
                />
              )}
              {v.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Drawer({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 150 }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(440px, 100vw)",
          background: "var(--cst-bg-elev)",
          borderLeft: "1px solid var(--cst-card-border)",
          padding: 24,
          overflowY: "auto",
          zIndex: 160,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--cst-text)" }}>{title}</h2>
          <button onClick={onClose} style={{ ...btnMini, fontSize: 16 }}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div className="cst-mono" style={{ fontSize: 9, color: "var(--cst-text-muted)", letterSpacing: "0.2em", marginBottom: 4 }}>
        {label.toUpperCase()}
      </div>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--cst-input-border)",
  background: "var(--cst-input-bg)",
  color: "var(--cst-text)",
  fontSize: 13,
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  background: "var(--cst-mid-green)",
  color: "#fff",
  border: "none",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  background: "transparent",
  color: "var(--cst-text)",
  border: "1px solid var(--cst-btn-ghost-border)",
  fontSize: 12,
  cursor: "pointer",
};
const btnMini: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 6,
  background: "transparent",
  color: "var(--cst-text-soft)",
  border: "1px solid var(--cst-btn-ghost-border)",
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "var(--cst-mono)",
};
