import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import MemberNav from "../../components/MemberNav";
import {
  addNutritionEntry,
  createNutritionFood,
  deleteNutritionEntry,
  getMyNutrition,
} from "@/lib/nutrition.functions";
import { MEAL_LABELS, MEAL_ORDER, kcalForPortion, type MealSlot } from "@/lib/nutrition";
import { localDateISO } from "@/lib/local-date";

type Food = {
  id: string;
  name: string;
  category: string;
  kcal_per_100g: number;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
};

function pct(value: number | null) {
  if (value == null) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function formatKcal(value: number | null | undefined) {
  return value == null ? "—" : `${value.toLocaleString("fr-FR")} kcal`;
}

function maybeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export default function MembreNutrition() {
  const today = localDateISO();
  const loadNutrition = useServerFn(getMyNutrition);
  const addEntry = useServerFn(addNutritionEntry);
  const createFood = useServerFn(createNutritionFood);
  const deleteEntry = useServerFn(deleteNutritionEntry);
  const [date, setDate] = useState(today);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFoodId, setSelectedFoodId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Toutes");
  const [foodSearch, setFoodSearch] = useState("");
  const [customFoodName, setCustomFoodName] = useState("");
  const [customFoodKcal, setCustomFoodKcal] = useState("");
  const [creatingFood, setCreatingFood] = useState(false);
  const [meal, setMeal] = useState<MealSlot>("lunch");
  const [grams, setGrams] = useState("100");

  const foods: Food[] = data?.foods ?? [];
  const foodCategories = useMemo(
    () => ["Toutes", ...Array.from(new Set(foods.map((food) => food.category))).sort((a, b) => a.localeCompare(b, "fr"))],
    [foods],
  );
  const filteredFoods = useMemo(
    () => {
      const search = foodSearch.trim().toLocaleLowerCase("fr");
      return foods.filter((food) => {
        const matchesCategory = selectedCategory === "Toutes" || food.category === selectedCategory;
        const matchesSearch = !search || food.name.toLocaleLowerCase("fr").includes(search);
        return matchesCategory && matchesSearch;
      });
    },
    [foods, foodSearch, selectedCategory],
  );
  const selectedFood = foods.find((food) => food.id === selectedFoodId) ?? filteredFoods[0] ?? foods[0] ?? null;
  const summary = data?.summary;

  const previewKcal = useMemo(() => {
    const g = Number(grams.replace(",", "."));
    if (!selectedFood || !Number.isFinite(g)) return 0;
    return kcalForPortion({ grams: g, kcalPer100g: selectedFood.kcal_per_100g });
  }, [grams, selectedFood]);

  useEffect(() => {
    const search = foodSearch.trim().toLocaleLowerCase("fr");
    if (!search) return;
    const exact = foods.find((food) => food.name.toLocaleLowerCase("fr") === search);
    if (exact && exact.id !== selectedFoodId) {
      setSelectedCategory(exact.category);
      setSelectedFoodId(exact.id);
    }
  }, [foodSearch, foods, selectedFoodId]);

  async function reload(nextDate = date) {
    setLoading(true);
    try {
      const result = await loadNutrition({ data: { date: nextDate } });
      setData(result);
      if (!selectedFoodId && result.foods?.[0]?.id) setSelectedFoodId(result.foods[0].id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nutrition indisponible");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function handleAdd() {
    if (!selectedFood) {
      toast.error("Choisis un aliment");
      return;
    }
    const parsedGrams = Math.round(Number(grams.replace(",", ".")));
    if (!Number.isFinite(parsedGrams) || parsedGrams <= 0) {
      toast.error("Quantité invalide");
      return;
    }
    setSaving(true);
    try {
      await addEntry({
        data: {
          date,
          meal,
          foodId: maybeUuid(selectedFood.id),
          foodName: selectedFood.name,
          grams: parsedGrams,
          kcalPer100g: selectedFood.kcal_per_100g,
          proteinPer100g: selectedFood.protein_per_100g,
          carbsPer100g: selectedFood.carbs_per_100g,
          fatPer100g: selectedFood.fat_per_100g,
        },
      });
      toast.success("Aliment ajouté");
      await reload(date);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ajout impossible");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateFood() {
    const name = customFoodName.trim();
    const kcalPer100g = Math.round(Number(customFoodKcal.replace(",", ".")));
    if (name.length < 2) {
      toast.error("Nom d'aliment trop court");
      return;
    }
    if (!Number.isFinite(kcalPer100g) || kcalPer100g < 0 || kcalPer100g > 1000) {
      toast.error("Calories / 100g invalides");
      return;
    }
    setCreatingFood(true);
    try {
      const created = await createFood({
        data: {
          name,
          category: selectedCategory === "Toutes" ? "Plats simples" : selectedCategory,
          kcalPer100g,
        },
      });
      setData((current: any) => {
        const currentFoods = current?.foods ?? [];
        const exists = currentFoods.some((food: Food) => food.id === created.id);
        return {
          ...current,
          foods: exists
            ? currentFoods
            : [...currentFoods, created].sort((a: Food, b: Food) => a.name.localeCompare(b.name, "fr")),
        };
      });
      setSelectedCategory(created.category);
      setSelectedFoodId(created.id);
      setFoodSearch(created.name);
      setCustomFoodName("");
      setCustomFoodKcal("");
      toast.success("Aliment ajouté à la base commune");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création impossible");
    } finally {
      setCreatingFood(false);
    }
  }

  async function handleDelete(entryId: string) {
    try {
      await deleteEntry({ data: { entryId } });
      await reload(date);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible");
    }
  }

  return (
    <div className="min-h-screen cst-bg cst-text">
      <main
        style={{
          minHeight: "100vh",
          padding: "22px 18px 96px",
          maxWidth: 980,
          margin: "0 auto",
        }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="cst-mono" style={{ fontSize: 10, opacity: 0.55, letterSpacing: "0.18em" }}>
              NUTRITION
            </div>
            <h1 className="cst-display" style={{ fontSize: 34, margin: "8px 0 0" }}>
              Ta journée.
            </h1>
          </div>
          <input
            className="cst-input"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            style={{ width: 170, alignSelf: "flex-start" }}
          />
        </header>

        <section
          className="cst-card-dark"
          style={{
            marginTop: 18,
            padding: 18,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 14,
          }}
        >
          <div>
            <div className="cst-mono" style={{ fontSize: 9, opacity: 0.55 }}>
              CONSOMMÉ
            </div>
            <strong style={{ fontSize: 30 }}>{formatKcal(summary?.totalKcal)}</strong>
          </div>
          <div>
            <div className="cst-mono" style={{ fontSize: 9, opacity: 0.55 }}>
              OBJECTIF COACH
            </div>
            <strong style={{ fontSize: 30 }}>{formatKcal(summary?.goalKcal)}</strong>
          </div>
          <div>
            <div className="cst-mono" style={{ fontSize: 9, opacity: 0.55 }}>
              RESTANT
            </div>
            <strong style={{ fontSize: 30 }}>{formatKcal(summary?.remainingKcal)}</strong>
          </div>
          <div style={{ alignSelf: "center" }}>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct(summary?.status?.progress ?? null)}%`,
                  height: "100%",
                  background: "var(--cst-mid-green)",
                }}
              />
            </div>
            <div className="cst-mono" style={{ marginTop: 8, fontSize: 10, color: "var(--cst-text-soft)" }}>
              {summary?.status?.label ?? "Chargement..."}
            </div>
          </div>
        </section>

        <section
          className="cst-card-dark"
          style={{ marginTop: 14, padding: 18, display: "grid", gap: 12 }}
        >
          <div className="cst-mono" style={{ fontSize: 10, opacity: 0.6 }}>
            AJOUTER UN ALIMENT
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10 }}>
            <select
              className="cst-input"
              value={selectedCategory}
              onChange={(event) => {
                const nextCategory = event.target.value;
                const nextFoods =
                  nextCategory === "Toutes"
                    ? foods
                    : foods.filter((food) => food.category === nextCategory);
                setSelectedCategory(nextCategory);
                if (nextFoods[0]?.id) setSelectedFoodId(nextFoods[0].id);
              }}
            >
              {foodCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <input
              className="cst-input"
              value={foodSearch}
              onChange={(event) => setFoodSearch(event.target.value)}
              placeholder="Rechercher ou taper un plat..."
              list="nutrition-food-suggestions"
            />
            <datalist id="nutrition-food-suggestions">
              {filteredFoods.slice(0, 40).map((food) => (
                <option key={food.id} value={food.name}>
                  {food.kcal_per_100g} kcal/100g · {food.category}
                </option>
              ))}
            </datalist>
            <select
              className="cst-input"
              value={selectedFood?.id ?? ""}
              onChange={(event) => setSelectedFoodId(event.target.value)}
            >
              {filteredFoods.map((food) => (
                <option key={food.id} value={food.id}>
                  {food.name} · {food.kcal_per_100g} kcal/100g
                </option>
              ))}
              {filteredFoods.length === 0 ? <option value="">Aucun aliment disponible</option> : null}
            </select>
            <select
              className="cst-input"
              value={meal}
              onChange={(event) => setMeal(event.target.value as MealSlot)}
            >
              {MEAL_ORDER.map((slot) => (
                <option key={slot} value={slot}>
                  {MEAL_LABELS[slot]}
                </option>
              ))}
            </select>
            <input
              className="cst-input"
              type="number"
              min="1"
              inputMode="numeric"
              value={grams}
              onChange={(event) => setGrams(event.target.value)}
              placeholder="100g"
            />
            <button className="cst-btn cst-btn-primary" disabled={saving || loading} onClick={handleAdd}>
              + {previewKcal} kcal
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(180px, 1fr) minmax(120px, 0.45fr) auto",
              gap: 10,
              alignItems: "center",
            }}
          >
            <input
              className="cst-input"
              value={customFoodName}
              onChange={(event) => setCustomFoodName(event.target.value)}
              placeholder="Aliment introuvable ? Ex. Bowl poulet maison"
            />
            <input
              className="cst-input"
              type="number"
              min="0"
              max="1000"
              inputMode="numeric"
              value={customFoodKcal}
              onChange={(event) => setCustomFoodKcal(event.target.value)}
              placeholder="kcal/100g"
            />
            <button className="cst-btn cst-btn-ghost-dark" disabled={creatingFood} onClick={handleCreateFood}>
              {creatingFood ? "AJOUT..." : "+ BASE"}
            </button>
          </div>
        </section>

        <section
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          {MEAL_ORDER.map((slot) => {
            const mealSummary = summary?.meals?.[slot];
            return (
              <div key={slot} className="cst-card-dark" style={{ padding: 16, minHeight: 170 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <h2 className="cst-display" style={{ fontSize: 20, margin: 0 }}>
                    {MEAL_LABELS[slot]}
                  </h2>
                  <span className="cst-mono" style={{ fontSize: 11, color: "var(--cst-mid-green)" }}>
                    {formatKcal(mealSummary?.totalKcal)}
                  </span>
                </div>
                <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  {(mealSummary?.entries ?? []).length === 0 && (
                    <div style={{ fontSize: 13, opacity: 0.5 }}>Aucun aliment</div>
                  )}
                  {(mealSummary?.entries ?? []).map((entry: any) => (
                    <div
                      key={entry.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto",
                        alignItems: "center",
                        gap: 8,
                        padding: "9px 0",
                        borderTop: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 14 }}>{entry.foodName}</strong>
                        <div className="cst-mono" style={{ fontSize: 9, opacity: 0.5 }}>
                          {entry.grams}g · {entry.kcalPer100g} kcal/100g
                        </div>
                      </div>
                      <span className="cst-mono" style={{ fontSize: 11 }}>
                        {kcalForPortion(entry)} kcal
                      </span>
                      <button
                        className="cst-btn cst-btn-ghost-dark"
                        style={{ minWidth: 34, padding: "6px 8px" }}
                        onClick={() => handleDelete(entry.id)}
                        aria-label={`Supprimer ${entry.foodName}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      </main>
      <MemberNav />
    </div>
  );
}
