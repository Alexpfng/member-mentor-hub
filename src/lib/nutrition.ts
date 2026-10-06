export const MEAL_ORDER = ["breakfast", "lunch", "snack", "dinner"] as const;

export type MealSlot = (typeof MEAL_ORDER)[number];

export type NutritionEntry = {
  id: string;
  date: string;
  meal: MealSlot;
  foodName: string;
  grams: number;
  kcalPer100g: number;
  proteinPer100g?: number | null;
  carbsPer100g?: number | null;
  fatPer100g?: number | null;
  createdAt?: string | null;
};

export type NutritionFood = {
  id: string;
  name: string;
  category: string;
  kcal_per_100g: number;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
};

export type NutritionMealSummary = {
  meal: MealSlot;
  label: string;
  entries: NutritionEntry[];
  totalKcal: number;
};

export type NutritionDaySummary = {
  date: string;
  goalKcal: number | null;
  totalKcal: number;
  remainingKcal: number | null;
  meals: Record<MealSlot, NutritionMealSummary>;
  status: NutritionGoalStatus;
};

export type NutritionGoalStatus = {
  progress: number | null;
  deltaKcal: number | null;
  label: string;
  tone: "neutral" | "under" | "target" | "over";
};

export const MEAL_LABELS: Record<MealSlot, string> = {
  breakfast: "Matin",
  lunch: "Midi",
  snack: "Collation",
  dinner: "Soir",
};

function defaultFood(
  id: string,
  name: string,
  category: NutritionFood["category"],
  kcal: number,
  protein: number | null,
  carbs: number | null,
  fat: number | null,
): NutritionFood {
  return {
    id: `default-${id}`,
    name,
    category,
    kcal_per_100g: kcal,
    protein_per_100g: protein,
    carbs_per_100g: carbs,
    fat_per_100g: fat,
  };
}

export const DEFAULT_NUTRITION_FOODS: NutritionFood[] = [
  defaultFood("pomme", "Pomme", "Fruits", 52, 0.3, 14, 0.2),
  defaultFood("banane", "Banane", "Fruits", 89, 1.1, 23, 0.3),
  defaultFood("orange", "Orange", "Fruits", 47, 0.9, 12, 0.1),
  defaultFood("clementine", "Clementine", "Fruits", 47, 0.8, 12, 0.2),
  defaultFood("poire", "Poire", "Fruits", 57, 0.4, 15, 0.1),
  defaultFood("kiwi", "Kiwi", "Fruits", 61, 1.1, 15, 0.5),
  defaultFood("fraise", "Fraise", "Fruits", 32, 0.7, 8, 0.3),
  defaultFood("framboise", "Framboise", "Fruits", 52, 1.2, 12, 0.7),
  defaultFood("myrtille", "Myrtille", "Fruits", 57, 0.7, 14, 0.3),
  defaultFood("raisin", "Raisin", "Fruits", 69, 0.7, 18, 0.2),
  defaultFood("mangue", "Mangue", "Fruits", 60, 0.8, 15, 0.4),
  defaultFood("ananas", "Ananas", "Fruits", 50, 0.5, 13, 0.1),
  defaultFood("pasteque", "Pasteque", "Fruits", 30, 0.6, 8, 0.2),
  defaultFood("melon", "Melon", "Fruits", 34, 0.8, 8, 0.2),
  defaultFood("peche", "Peche", "Fruits", 39, 0.9, 10, 0.3),

  defaultFood("carotte", "Carotte", "Legumes", 41, 0.9, 10, 0.2),
  defaultFood("courgette", "Courgette", "Legumes", 17, 1.2, 3.1, 0.3),
  defaultFood("brocoli", "Brocoli", "Legumes", 34, 2.8, 7, 0.4),
  defaultFood("haricots-verts", "Haricots verts", "Legumes", 31, 1.8, 7, 0.2),
  defaultFood("epinards", "Epinards", "Legumes", 23, 2.9, 3.6, 0.4),
  defaultFood("salade", "Salade verte", "Legumes", 15, 1.4, 2.9, 0.2),
  defaultFood("tomate", "Tomate", "Legumes", 18, 0.9, 3.9, 0.2),
  defaultFood("concombre", "Concombre", "Legumes", 15, 0.7, 3.6, 0.1),
  defaultFood("poivron", "Poivron", "Legumes", 31, 1, 6, 0.3),
  defaultFood("champignons", "Champignons", "Legumes", 22, 3.1, 3.3, 0.3),
  defaultFood("oignon", "Oignon", "Legumes", 40, 1.1, 9, 0.1),
  defaultFood("aubergine", "Aubergine", "Legumes", 25, 1, 6, 0.2),
  defaultFood("chou-fleur", "Chou-fleur", "Legumes", 25, 1.9, 5, 0.3),
  defaultFood("betterave", "Betterave", "Legumes", 43, 1.6, 10, 0.2),
  defaultFood("petits-pois", "Petits pois", "Legumes", 81, 5.4, 14, 0.4),

  defaultFood("riz-cuit", "Riz cuit", "Feculents", 130, 2.7, 28, 0.3),
  defaultFood("riz-cru", "Riz cru", "Feculents", 360, 7, 78, 0.7),
  defaultFood("pates-cuites", "Pates cuites", "Feculents", 150, 5, 30, 1),
  defaultFood("pates-crues", "Pates crues", "Feculents", 350, 12, 72, 1.5),
  defaultFood("pommes-de-terre", "Pommes de terre", "Feculents", 77, 2, 17, 0.1),
  defaultFood("patate-douce", "Patate douce", "Feculents", 86, 1.6, 20, 0.1),
  defaultFood("semoule-cuite", "Semoule cuite", "Feculents", 112, 3.8, 23, 0.2),
  defaultFood("quinoa-cuit", "Quinoa cuit", "Feculents", 120, 4.4, 21, 1.9),
  defaultFood("boulgour-cuit", "Boulgour cuit", "Feculents", 83, 3.1, 19, 0.2),
  defaultFood("pain-complet", "Pain complet", "Feculents", 247, 9, 41, 4.2),
  defaultFood("pain-blanc", "Pain blanc", "Feculents", 265, 9, 49, 3.2),
  defaultFood("wrap-ble", "Wrap de ble", "Feculents", 310, 8, 52, 7),
  defaultFood("lentilles-cuites", "Lentilles cuites", "Feculents", 116, 9, 20, 0.4),
  defaultFood("pois-chiches-cuits", "Pois chiches cuits", "Feculents", 164, 8.9, 27, 2.6),
  defaultFood("haricots-rouges-cuits", "Haricots rouges cuits", "Feculents", 127, 8.7, 23, 0.5),

  defaultFood("poulet", "Poulet", "Proteines", 165, 31, 0, 3.6),
  defaultFood("dinde", "Dinde", "Proteines", 135, 29, 0, 1.5),
  defaultFood("steak-5", "Steak hache 5%", "Proteines", 137, 21, 0, 5),
  defaultFood("steak-15", "Steak hache 15%", "Proteines", 215, 19, 0, 15),
  defaultFood("boeuf", "Boeuf maigre", "Proteines", 170, 26, 0, 7),
  defaultFood("jambon-blanc", "Jambon blanc", "Proteines", 115, 20, 1, 3),
  defaultFood("oeufs", "Oeufs", "Proteines", 155, 13, 1.1, 11),
  defaultFood("blanc-oeuf", "Blanc d'oeuf", "Proteines", 52, 11, 0.7, 0.2),
  defaultFood("saumon", "Saumon", "Proteines", 208, 20, 0, 13),
  defaultFood("thon-naturel", "Thon naturel", "Proteines", 116, 26, 0, 1),
  defaultFood("cabillaud", "Cabillaud", "Proteines", 82, 18, 0, 0.7),
  defaultFood("crevettes", "Crevettes", "Proteines", 99, 24, 0.2, 0.3),
  defaultFood("tofu", "Tofu", "Proteines", 144, 15, 3, 8),
  defaultFood("tempeh", "Tempeh", "Proteines", 193, 19, 9, 11),
  defaultFood("seitan", "Seitan", "Proteines", 140, 25, 5, 2),

  defaultFood("skyr", "Skyr", "Produits laitiers", 60, 10, 4, 0.2),
  defaultFood("fromage-blanc-0", "Fromage blanc 0%", "Produits laitiers", 45, 8, 4, 0.2),
  defaultFood("fromage-blanc-3", "Fromage blanc 3%", "Produits laitiers", 75, 7.5, 4, 3),
  defaultFood("yaourt-nature", "Yaourt nature", "Produits laitiers", 63, 3.5, 5, 3),
  defaultFood("yaourt-grec", "Yaourt grec", "Produits laitiers", 120, 6, 4, 8),
  defaultFood("lait-demi-ecreme", "Lait demi-ecreme", "Produits laitiers", 46, 3.2, 4.8, 1.5),
  defaultFood("mozzarella", "Mozzarella", "Produits laitiers", 280, 18, 2, 22),
  defaultFood("emmental", "Emmental", "Produits laitiers", 380, 28, 0, 30),
  defaultFood("chevre", "Fromage de chevre", "Produits laitiers", 300, 20, 2, 24),
  defaultFood("whey", "Whey", "Produits laitiers", 390, 78, 8, 6),

  defaultFood("huile-olive", "Huile d'olive", "Matieres grasses", 884, 0, 0, 100),
  defaultFood("huile-colza", "Huile de colza", "Matieres grasses", 884, 0, 0, 100),
  defaultFood("beurre", "Beurre", "Matieres grasses", 717, 0.9, 0.1, 81),
  defaultFood("creme-fraiche", "Creme fraiche", "Matieres grasses", 292, 2.4, 3, 30),
  defaultFood("avocat", "Avocat", "Matieres grasses", 160, 2, 9, 15),
  defaultFood("mayonnaise", "Mayonnaise", "Matieres grasses", 680, 1, 1, 75),
  defaultFood("pesto", "Pesto", "Matieres grasses", 430, 5, 5, 42),
  defaultFood("vinaigrette", "Vinaigrette", "Matieres grasses", 450, 0.5, 3, 45),

  defaultFood("amandes", "Amandes", "Oleagineux", 579, 21, 22, 50),
  defaultFood("noix", "Noix", "Oleagineux", 654, 15, 14, 65),
  defaultFood("noix-cajou", "Noix de cajou", "Oleagineux", 553, 18, 30, 44),
  defaultFood("noisettes", "Noisettes", "Oleagineux", 628, 15, 17, 61),
  defaultFood("cacahuetes", "Cacahuetes", "Oleagineux", 567, 26, 16, 49),
  defaultFood("beurre-cacahuete", "Beurre de cacahuete", "Oleagineux", 588, 25, 20, 50),
  defaultFood("graines-chia", "Graines de chia", "Oleagineux", 486, 17, 42, 31),
  defaultFood("graines-courge", "Graines de courge", "Oleagineux", 559, 30, 11, 49),

  defaultFood("eau", "Eau", "Boissons", 1, 0, 0, 0),
  defaultFood("cafe-non-sucre", "Cafe non sucre", "Boissons", 1, 0, 0, 0),
  defaultFood("the-non-sucre", "The non sucre", "Boissons", 1, 0, 0, 0),
  defaultFood("jus-orange", "Jus d'orange", "Boissons", 45, 0.7, 10, 0.2),
  defaultFood("jus-pomme", "Jus de pomme", "Boissons", 46, 0.1, 11, 0.1),
  defaultFood("soda", "Soda", "Boissons", 42, 0, 10.6, 0),
  defaultFood("biere", "Biere", "Boissons", 43, 0.5, 3.6, 0),
  defaultFood("vin-rouge", "Vin rouge", "Boissons", 85, 0.1, 2.6, 0),

  defaultFood("flocons-avoine", "Flocons d'avoine", "Petit-dejeuner", 370, 13, 60, 7),
  defaultFood("muesli", "Muesli", "Petit-dejeuner", 360, 10, 62, 8),
  defaultFood("granola", "Granola", "Petit-dejeuner", 450, 9, 60, 18),
  defaultFood("cereales-chocolat", "Cereales chocolat", "Petit-dejeuner", 390, 7, 75, 6),
  defaultFood("pain-mie-complet", "Pain de mie complet", "Petit-dejeuner", 250, 9, 44, 4),
  defaultFood("biscottes", "Biscottes", "Petit-dejeuner", 410, 11, 75, 6),
  defaultFood("confiture", "Confiture", "Petit-dejeuner", 250, 0.4, 60, 0.1),
  defaultFood("miel", "Miel", "Petit-dejeuner", 304, 0.3, 82, 0),

  defaultFood("chocolat-noir", "Chocolat noir", "Snacks", 545, 7, 46, 36),
  defaultFood("barre-cereales", "Barre de cereales", "Snacks", 390, 6, 68, 10),
  defaultFood("compote", "Compote", "Snacks", 68, 0.2, 16, 0.1),
  defaultFood("galettes-riz", "Galettes de riz", "Snacks", 380, 8, 82, 3),
  defaultFood("chips", "Chips", "Snacks", 536, 7, 53, 34),
  defaultFood("biscuits", "Biscuits", "Snacks", 480, 6, 67, 20),
  defaultFood("protein-bar", "Barre proteinee", "Snacks", 360, 30, 35, 12),
  defaultFood("fruits-secs", "Fruits secs", "Snacks", 300, 3, 70, 1),

  defaultFood("salade-poulet", "Salade poulet composee", "Plats simples", 140, 12, 8, 6),
  defaultFood("poke-bowl-saumon", "Poke bowl saumon", "Plats simples", 170, 10, 20, 6),
  defaultFood("sushi", "Sushi", "Plats simples", 150, 6, 27, 2),
  defaultFood("pizza", "Pizza", "Plats simples", 266, 11, 33, 10),
  defaultFood("burger", "Burger", "Plats simples", 295, 16, 30, 13),
  defaultFood("omelette", "Omelette", "Plats simples", 155, 11, 1, 11),
  defaultFood("soupe-legumes", "Soupe de legumes", "Plats simples", 45, 1.5, 8, 1),
  defaultFood("couscous", "Couscous", "Plats simples", 150, 7, 21, 4),
  defaultFood("chili", "Chili con carne", "Plats simples", 140, 10, 14, 5),
  defaultFood("lasagnes", "Lasagnes", "Plats simples", 165, 9, 16, 7),
  defaultFood("quiche", "Quiche", "Plats simples", 290, 9, 20, 19),
];

export function kcalForPortion(input: { grams: number; kcalPer100g: number }): number {
  const grams = Math.max(0, Number(input.grams) || 0);
  const kcalPer100g = Math.max(0, Number(input.kcalPer100g) || 0);
  return Math.round((grams * kcalPer100g) / 100);
}

function sortEntries(a: NutritionEntry, b: NutritionEntry) {
  const aCreated = a.createdAt ?? "";
  const bCreated = b.createdAt ?? "";
  if (aCreated && bCreated && aCreated !== bCreated) return aCreated.localeCompare(bCreated);
  if (aCreated !== bCreated) return aCreated ? -1 : 1;
  return a.foodName.localeCompare(b.foodName, "fr");
}

export function nutritionGoalStatus(totalKcal: number, goalKcal: number | null): NutritionGoalStatus {
  if (!goalKcal || goalKcal <= 0) {
    return {
      progress: null,
      deltaKcal: null,
      label: "Objectif non fixe",
      tone: "neutral",
    };
  }

  const deltaKcal = Math.round(totalKcal - goalKcal);
  const progress = Math.min(1, Math.max(0, Number((totalKcal / goalKcal).toFixed(2))));
  const tolerance = Math.max(50, Math.round(goalKcal * 0.03));

  if (Math.abs(deltaKcal) <= tolerance) {
    return {
      progress,
      deltaKcal,
      label: deltaKcal === 0 ? "Objectif pile" : `${deltaKcal > 0 ? "+" : ""}${deltaKcal} kcal`,
      tone: "target",
    };
  }

  if (deltaKcal < 0) {
    return {
      progress,
      deltaKcal,
      label: `Encore ${Math.abs(deltaKcal)} kcal`,
      tone: "under",
    };
  }

  return {
    progress,
    deltaKcal,
    label: `+${deltaKcal} kcal`,
    tone: "over",
  };
}

export function buildNutritionSummary(input: {
  date: string;
  goalKcal: number | null;
  entries: NutritionEntry[];
}): NutritionDaySummary {
  const meals = MEAL_ORDER.reduce(
    (acc, meal) => {
      const entries = input.entries.filter((entry) => entry.meal === meal).sort(sortEntries);
      acc[meal] = {
        meal,
        label: MEAL_LABELS[meal],
        entries,
        totalKcal: entries.reduce((sum, entry) => sum + kcalForPortion(entry), 0),
      };
      return acc;
    },
    {} as Record<MealSlot, NutritionMealSummary>,
  );

  const totalKcal = MEAL_ORDER.reduce((sum, meal) => sum + meals[meal].totalKcal, 0);

  return {
    date: input.date,
    goalKcal: input.goalKcal,
    totalKcal,
    remainingKcal: input.goalKcal != null ? Math.max(0, input.goalKcal - totalKcal) : null,
    meals,
    status: nutritionGoalStatus(totalKcal, input.goalKcal),
  };
}
