import { createFileRoute } from "@tanstack/react-router";
import Builder from "../pages/coach/Builder";

export const Route = createFileRoute("/_authenticated/coach/builder")({
  component: Builder,
});
