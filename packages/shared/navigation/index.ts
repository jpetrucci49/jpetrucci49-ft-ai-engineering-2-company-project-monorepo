/**
 * Single source of truth for cross-app navigation labels, paths, and URL helpers.
 * Import from `@healthcore/navigation` in all uis/* apps — do not duplicate labels locally.
 */

export const crossAppNav = {
  labels: {
    en: {
      publicSite: "Public site",
      utilities: "Utilities",
      talentPipeline: "Talent pipeline",
    },
    es: {
      publicSite: "Sitio público",
      utilities: "Utilidades",
      talentPipeline: "Pipeline de talento",
    },
  },
  paths: {
    backofficeUtilities: "/utilities",
  },
  appTitles: {
    backoffice: "Operations Backoffice",
    tracker: "People & Talent — Pipeline Tracker",
  },
} as const;

export type CrossAppNavLang = keyof typeof crossAppNav.labels;

export interface AppUrlEnv {
  website?: string;
  backoffice?: string;
  tracker?: string;
}

const defaultAppUrls = {
  website: "http://localhost:3000",
  backoffice: "http://localhost:3001",
  tracker: "http://localhost:3002",
} as const;

export const appPorts = {
  website: 3000,
  backoffice: 3001,
  tracker: 3002,
} as const;

/** `name-3000.app.github.dev` → keep `name`, replace the port. */
const CODESPACE_HOST = /^(.*)-\d+(\.app\.github\.dev)$/i;

export function resolveAppUrls(env: AppUrlEnv = {}) {
  return {
    website: env.website?.replace(/\/$/, "") || defaultAppUrls.website,
    backoffice: env.backoffice?.replace(/\/$/, "") || defaultAppUrls.backoffice,
    tracker: env.tracker?.replace(/\/$/, "") || defaultAppUrls.tracker,
  };
}

export function backofficeUtilitiesUrl(backofficeBase: string): string {
  return `${backofficeBase.replace(/\/$/, "")}${crossAppNav.paths.backofficeUtilities}`;
}

function isLoopbackUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Forwarded Codespace origin for one dev port, or null when this host is local. */
export function codespaceOrigin(hostname: string, protocol: string, port: number): string | null {
  const match = hostname.match(CODESPACE_HOST);
  if (!match) return null;
  const scheme = protocol === "http:" ? "http:" : "https:";
  return `${scheme}//${match[1]}-${port}${match[2]}`;
}

export function rewriteAppUrls(
  urls: ReturnType<typeof resolveAppUrls>,
  hostname: string,
  protocol: string,
) {
  const rewrite = (url: string, port: number) => {
    if (!isLoopbackUrl(url)) return url;
    const origin = codespaceOrigin(hostname, protocol, port);
    if (!origin) return url;
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${origin}${path}${parsed.search}${parsed.hash}`;
  };
  return {
    website: rewrite(urls.website, appPorts.website),
    backoffice: rewrite(urls.backoffice, appPorts.backoffice),
    tracker: rewrite(urls.tracker, appPorts.tracker),
  };
}

/** English labels for internal tools (backoffice, tracker headers). */
export const crossAppNavLabelsEn = crossAppNav.labels.en;

/** Resolved cross-app URLs from standard Next.js public env vars. */
export const appUrls = resolveAppUrls({
  website: process.env.NEXT_PUBLIC_WEBSITE_URL,
  backoffice: process.env.NEXT_PUBLIC_BACKOFFICE_URL,
  tracker: process.env.NEXT_PUBLIC_TRACKER_URL,
});

/** Alias used by internal tool headers. */
export const crossAppNavLabels = crossAppNavLabelsEn;
