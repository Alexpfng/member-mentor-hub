import { createFileRoute } from "@tanstack/react-router";
import Composer from "../pages/membre/Composer";

export const Route = createFileRoute("/_authenticated/membre/composer")({
  component: Composer,
});
