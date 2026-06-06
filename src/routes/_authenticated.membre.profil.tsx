import { createFileRoute } from "@tanstack/react-router";
import MemberProfil from "../pages/membre/Profil";

export const Route = createFileRoute("/_authenticated/membre/profil")({
  component: MemberProfil,
});
