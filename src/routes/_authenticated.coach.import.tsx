import { createFileRoute } from "@tanstack/react-router";
import ExcelImport from "../pages/coach/Import.tsx";

export const Route = createFileRoute("/_authenticated/coach/import")({
  component: ExcelImport,
});
