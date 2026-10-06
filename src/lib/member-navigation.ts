export const memberNavigationItems = [
  { id: "home", icon: "🏠", label: "Accueil", path: "/membre" },
  { id: "prog", icon: "📋", label: "Programme", path: "/membre/programme" },
  { id: "plan", icon: "📅", label: "Planning", path: "/membre/planning" },
  { id: "carn", icon: "📖", label: "Carnet", path: "/membre/carnet" },
  { id: "progr", icon: "📈", label: "Progrès", path: "/membre/progression" },
  { id: "nutrition", icon: "◎", label: "Nutrition", path: "/membre/nutrition" },
  { id: "trail", icon: "🏃", label: "Trail & Run", path: "/membre/running" },
  { id: "msgs", icon: "💬", label: "Messages", path: "/membre/messages" },
  { id: "profile", icon: "⚙️", label: "Réglages", path: "/membre/profil" },
] as const;

export function memberNavigationActiveId(pathname: string) {
  return (
    memberNavigationItems.find((item) =>
      item.path !== "/membre" ? pathname.startsWith(item.path) : pathname === "/membre",
    )?.id ?? "home"
  );
}
