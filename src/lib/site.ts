const fallbackSiteUrl = "https://colosmartraining.fr";

function normalizeSiteUrl(value: string | undefined) {
  if (!value) return fallbackSiteUrl;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export const SITE_NAME = "Colosmar Training";
export const SITE_DESCRIPTION =
  "Plateforme de coaching sportif Colosmar Training pour les coachs et leurs athletes.";
export const SITE_URL = normalizeSiteUrl(
  import.meta.env.VITE_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL,
);

// Beta launch flag — when true, hide non-beta features and show the beta banner.
export const BETA_MODE = true;
export const BETA_CONTACT_EMAIL = "leocolognesi@gmail.com";
