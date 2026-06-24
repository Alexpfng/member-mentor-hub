import { useEffect, useMemo, useRef, useState } from "react";
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
  createIntensityCode,
  deleteIntensityCode,
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

// Persistent custom presets (localStorage) for non-DB-backed categories
function loadPresets(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { return []; }
}
function savePresets(key: string, vals: string[]) {
  localStorage.setItem(key, JSON.stringify(vals));
}

export default function Exercices() {
  const fetchExercises = useServerFn(listExercises);
  const fetchCodes = useServerFn(listIntensityCodes);
  const fetchGlossary = useServerFn(listGlossary);
  const saveExercise = useServerFn(upsertExercise);
  const archiveFn = useServerFn(setExerciseArchived);
  const seedFn = useServerFn(seedExerciseLibraryV2);
  const createCodeFn = useServerFn(createIntensityCode);
  const deleteCodeFn = useServerFn(deleteIntensityCode);

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Custom presets for locally-managed filter categories
  const [customPatterns, setCustomPatterns] = useState<string[]>(() => loadPresets("cst_custom_patterns"));
  const [customMuscles, setCustomMuscles] = useState<string[]>(() => loadPresets("cst_custom_muscles"));
  const [customEquips, setCustomEquips] = useState<string[]>(() => loadPresets("cst_custom_equips"));

  // "Add filter" modal state
  const [addModal, setAddModal] = useState<null | { type: "intensity" | "pattern" | "muscle" | "equip" }>(null);

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
    const s = new Set<string>([...customMuscles]);
    items.forEach((it) => it.muscle_group && s.add(it.muscle_group));
    return Array.from(s).sort();
  }, [items, customMuscles]);
  const equipments = useMemo(() => {
    const s = new Set<string>([...customEquips]);
    items.forEach((it) => it.equipement && s.add(it.equipement));
    return Array.from(s).sort();
  }, [items, customEquips]);
  const allPatterns = useMemo(() => {
    const defaults = PATTERN_OPTIONS.map((p) => p.value);
    const s = new Set<string>([...defaults, ...customPatterns]);
    items.forEach((it) => (it.movement_patterns ?? []).forEach((p) => s.add(p)));
    return Array.from(s).map((v) => ({
      value: v,
      label: PATTERN_OPTIONS.find((o) => o.value === v)?.label ?? v.replace(/_/g, " "),
    }));
  }, [items, customPatterns]);

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

  async function handleAddPreset(type: string, value: string, label: string, colorHex?: string, description?: string) {
    const v = value.trim();
    if (!v) return;
    if (type === "intensity") {
      const code = v.toLowerCase().replace(/[^a-z0-9]/g, "_");
      await createCodeFn({ data: { code, label: label || v, color_hex: colorHex || "#888888", description: description || "" } });
      await reload();
      toast.success(`Intensité « ${label || v} » ajoutée`);
    } else if (type === "pattern") {
      const key = v.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 20);
      const next = [...new Set([...customPatterns, key])];
      setCustomPatterns(next);
      savePresets("cst_custom_patterns", next);
      toast.success(`Schéma « ${v} » ajouté`);
    } else if (type === "muscle") {
      const next = [...new Set([...customMuscles, v])];
      setCustomMuscles(next);
      savePresets("cst_custom_muscles", next);
      toast.success(`Groupe musculaire « ${v} » ajouté`);
    } else if (type === "equip") {
      const next = [...new Set([...customEquips, v])];
      setCustomEquips(next);
      savePresets("cst_custom_equips", next);
      toast.success(`Équipement « ${v} » ajouté`);
    }
    setAddModal(null);
  }

  async function handleDeletePreset(type: string, value: string) {
    if (type === "intensity") {
      try {
        await deleteCodeFn({ data: { code: value } });
        await reload();
        toast.success("Intensité supprimée");
      } catch (e) {
        toast.error((e as Error).message);
      }
    } else if (type === "pattern") {
      const next = customPatterns.filter((p) => p !== value);
      setCustomPatterns(next);
      savePresets("cst_custom_patterns", next);
      setFilterPattern((prev) => { const n = new Set(prev); n.delete(value); return n; });
    } else if (type === "muscle") {
      const next = customMuscles.filter((m) => m !== value);
      setCustomMuscles(next);
      savePresets("cst_custom_muscles", next);
      setFilterMuscle((prev) => { const n = new Set(prev); n.delete(value); return n; });
    } else if (type === "equip") {
      const next = customEquips.filter((e) => e !== value);
      setCustomEquips(next);
      savePresets("cst_custom_equips", next);
      setFilterEquip((prev) => { const n = new Set(prev); n.delete(value); return n; });
    }
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

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleSelectAllVisible() {
    setSelected((prev) => {
      if (filtered.length > 0 && filtered.every((e) => prev.has(e.id))) {
        const n = new Set(prev); filtered.forEach((e) => n.delete(e.id)); return n;
      }
      const n = new Set(prev); filtered.forEach((e) => n.add(e.id)); return n;
    });
  }
  async function bulkArchive(archived: boolean) {
    if (!selected.size) return;
    setBulkBusy(true);
    try {
      await Promise.all(Array.from(selected).map((id) => archiveFn({ data: { id, is_archived: archived } })));
      toast.success(`${selected.size} exercice(s) ${archived ? "archivé(s)" : "désarchivé(s)"}`);
      setSelected(new Set());
      await reload();
    } catch (e) {
      toast.error((e as Error).message || "Erreur");
    } finally {
      setBulkBusy(false);
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
    <div className="cst-screen" style={{ flexDirection: "row" }}>
      <CoachSidebar />
      <div className="cst-scroll" style={{ flex: 1, padding: "32px 28px 96px", minWidth: 0 }}>
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
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--cst-text-soft)", maxWidth: 720, lineHeight: 1.55 }}>
          Gère ici tes exercices de référence&nbsp;: nom, vidéo, couleur, schéma moteur. Les modifications s'appliquent à tous tes futurs programmes.
        </p>

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
            label="Schéma moteur"
            values={allPatterns.map((p) => ({ ...p, deletable: customPatterns.includes(p.value) }))}
            selected={filterPattern}
            onToggle={(v) => toggleInSet(filterPattern, v, setFilterPattern)}
            onAdd={() => setAddModal({ type: "pattern" })}
            onDelete={(v) => handleDeletePreset("pattern", v)}
          />
          <FilterChips
            label="Intensité"
            values={codes.map((c) => ({ value: c.code, label: c.label, color: c.color_hex, deletable: true }))}
            selected={filterIntensity}
            onToggle={(v) => toggleInSet(filterIntensity, v, setFilterIntensity)}
            onAdd={() => setAddModal({ type: "intensity" })}
            onDelete={(v) => handleDeletePreset("intensity", v)}
          />
          <FilterChips
            label="Groupe musculaire"
            values={muscles.map((m) => ({ value: m, label: m, deletable: customMuscles.includes(m) }))}
            selected={filterMuscle}
            onToggle={(v) => toggleInSet(filterMuscle, v, setFilterMuscle)}
            onAdd={() => setAddModal({ type: "muscle" })}
            onDelete={(v) => handleDeletePreset("muscle", v)}
          />
          <FilterChips
            label="Équipement"
            values={equipments.map((e) => ({ value: e, label: e, deletable: customEquips.includes(e) }))}
            selected={filterEquip}
            onToggle={(v) => toggleInSet(filterEquip, v, setFilterEquip)}
            onAdd={() => setAddModal({ type: "equip" })}
            onDelete={(v) => handleDeletePreset("equip", v)}
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

        {/* Barre d'action en masse */}
        {selected.size > 0 && (
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 14px", background: "rgba(45,90,53,0.12)", border: "1px solid var(--cst-mid-green)", borderRadius: 10 }}>
            <span className="cst-mono" style={{ fontSize: 12, color: "var(--cst-text)", letterSpacing: "0.1em" }}>{selected.size} SÉLECTIONNÉ(S)</span>
            <button onClick={() => bulkArchive(true)} disabled={bulkBusy} style={btnPrimary}>{bulkBusy ? "…" : "Archiver la sélection"}</button>
            {showArchived && <button onClick={() => bulkArchive(false)} disabled={bulkBusy} style={btnGhost}>Désarchiver</button>}
            <button onClick={() => setSelected(new Set())} style={btnGhost}>Annuler</button>
          </div>
        )}

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
          {!loading && filtered.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: "1px solid var(--cst-hairline)" }}>
              <input
                type="checkbox"
                checked={filtered.length > 0 && filtered.every((e) => selected.has(e.id))}
                onChange={toggleSelectAllVisible}
                aria-label="Tout sélectionner"
              />
              <span className="cst-mono" style={{ fontSize: 10, color: "var(--cst-text-muted)", letterSpacing: "0.16em" }}>TOUT SÉLECTIONNER (VISIBLE)</span>
            </div>
          )}
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
                      gridTemplateColumns: "24px 16px minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) 80px auto",
                      gap: 12,
                      padding: "12px 16px",
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(ex.id)}
                      onChange={() => toggleSelect(ex.id)}
                      aria-label={`Sélectionner ${ex.name}`}
                    />
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
          <Field label="Schéma moteur">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PATTERN_OPTIONS.map((p) => {
                const current = editing.movement_patterns ?? [];
                const on = current.includes(p.value);
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      const next = on
                        ? current.filter((x) => x !== p.value)
                        : [...current, p.value];
                      setEditing({ ...editing, movement_patterns: next });
                    }}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      border: on ? "1px solid var(--cst-mid-green)" : "1px solid var(--cst-input-border)",
                      background: on ? "rgba(45,90,53,0.15)" : "var(--cst-input-bg)",
                      color: "var(--cst-text)",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
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

      {/* Add filter modal */}
      {addModal && (
        <AddFilterModal
          type={addModal.type}
          onClose={() => setAddModal(null)}
          onConfirm={handleAddPreset}
        />
      )}
    </div>
  );
}

function AddFilterModal({
  type,
  onClose,
  onConfirm,
}: {
  type: "intensity" | "pattern" | "muscle" | "equip";
  onClose: () => void;
  onConfirm: (type: string, value: string, label: string, colorHex?: string, description?: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [colorHex, setColorHex] = useState("#888888");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const titles: Record<string, string> = {
    intensity: "Nouvelle intensité",
    pattern: "Nouveau schéma moteur",
    muscle: "Nouveau groupe musculaire",
    equip: "Nouvel équipement",
  };
  const placeholders: Record<string, string> = {
    intensity: "ex: explosif",
    pattern: "ex: explosive",
    muscle: "ex: rotateurs_externe",
    equip: "ex: kettlebell",
  };

  const showColor = type === "intensity";
  const showLabel = type === "intensity";
  const showDesc = type === "intensity";

  async function submit() {
    if (!value.trim()) return;
    setBusy(true);
    try {
      await onConfirm(type, value, label || value, colorHex, description);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--cst-card-bg)", border: "1px solid var(--cst-card-border)", borderRadius: 12, padding: 24, width: "min(400px, 100%)", display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{titles[type]}</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--cst-text-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--cst-text-muted)", display: "block", marginBottom: 4 }}>
              {showLabel ? "CODE (identifiant unique)" : "VALEUR"}
            </label>
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={placeholders[type]}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--cst-input-border)", background: "var(--cst-input-bg)", color: "var(--cst-text)", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>
          {showLabel && (
            <div>
              <label style={{ fontSize: 11, color: "var(--cst-text-muted)", display: "block", marginBottom: 4 }}>LABEL AFFICHÉ</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="ex: Explosif"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--cst-input-border)", background: "var(--cst-input-bg)", color: "var(--cst-text)", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
          )}
          {showColor && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ fontSize: 11, color: "var(--cst-text-muted)" }}>COULEUR</label>
              <input
                type="color"
                value={colorHex}
                onChange={(e) => setColorHex(e.target.value)}
                style={{ width: 40, height: 32, padding: 2, borderRadius: 6, border: "1px solid var(--cst-input-border)", background: "transparent", cursor: "pointer" }}
              />
              <span style={{ fontSize: 12, opacity: 0.7 }}>{colorHex}</span>
            </div>
          )}
          {showDesc && (
            <div>
              <label style={{ fontSize: 11, color: "var(--cst-text-muted)", display: "block", marginBottom: 4 }}>DESCRIPTION (optionnel)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ex: Mouvements de type puissance/force explosive"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--cst-input-border)", background: "var(--cst-input-bg)", color: "var(--cst-text)", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            onClick={submit}
            disabled={!value.trim() || busy}
            style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "var(--cst-mid-green)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: value.trim() && !busy ? "pointer" : "not-allowed", opacity: value.trim() && !busy ? 1 : 0.5 }}
          >
            {busy ? "Ajout…" : "Ajouter"}
          </button>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "var(--cst-text-muted)", fontSize: 13, cursor: "pointer" }}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterChips({
  label,
  values,
  selected,
  onToggle,
  onAdd,
  onDelete,
}: {
  label: string;
  values: { value: string; label: string; color?: string; deletable?: boolean }[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onAdd?: () => void;
  onDelete?: (v: string) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span className="cst-mono" style={{ fontSize: 9, color: "var(--cst-text-muted)", letterSpacing: "0.2em" }}>
          {label.toUpperCase()}
        </span>
        {onAdd && (
          <button
            onClick={onAdd}
            title={`Ajouter un filtre ${label}`}
            style={{
              width: 18, height: 18, borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(255,255,255,0.06)",
              color: "var(--cst-text-muted)",
              fontSize: 13, lineHeight: 1, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 0,
            }}
          >+</button>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {values.map((v) => {
          const on = selected.has(v.value);
          const canDelete = v.deletable && onDelete;
          return (
            <div
              key={v.value}
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                border: on ? "1px solid var(--cst-mid-green)" : "1px solid var(--cst-input-border)",
                background: on ? "rgba(45,90,53,0.15)" : "var(--cst-input-bg)",
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => onToggle(v.value)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: canDelete ? "5px 6px 5px 10px" : "5px 10px",
                  border: "none",
                  background: "transparent",
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
                      flexShrink: 0,
                    }}
                  />
                )}
                {v.label}
              </button>
              {canDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(v.value); }}
                  title="Supprimer ce filtre"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "rgba(255,255,255,0.35)",
                    fontSize: 11,
                    cursor: "pointer",
                    padding: "5px 8px 5px 2px",
                    lineHeight: 1,
                  }}
                >×</button>
              )}
            </div>
          );
        })}
        {values.length === 0 && (
          <span style={{ fontSize: 11, opacity: 0.45, fontStyle: "italic" }}>Aucun filtre</span>
        )}
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
