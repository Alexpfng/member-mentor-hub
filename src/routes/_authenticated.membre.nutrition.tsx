import { createFileRoute } from "@tanstack/react-router";
import MembreNutrition from "../pages/membre/Nutrition";

export const Route = createFileRoute("/_authenticated/membre/nutrition")({
  component: MembreNutrition,
});
