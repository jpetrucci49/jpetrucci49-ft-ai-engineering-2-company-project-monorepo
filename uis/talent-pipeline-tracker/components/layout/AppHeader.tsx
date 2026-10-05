"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useFilterReset } from "@/components/layout/FilterResetProvider";
import { buildAuthenticatedAppUrl } from "@healthcore/auth";
import {
  appUrls,
  backofficeUtilitiesUrl,
  crossAppNav,
  crossAppNavLabels,
  rewriteAppUrls,
} from "@healthcore/navigation";

export function AppHeader() {
  const { clearAllFilters } = useFilterReset();
  const [urls, setUrls] = useState(appUrls);
  useEffect(() => {
    setUrls(rewriteAppUrls(appUrls, window.location.hostname, window.location.protocol));
  }, []);
  const crossAppLinks = [
    { href: urls.website, label: crossAppNavLabels.publicSite, authenticated: false },
    {
      href: backofficeUtilitiesUrl(urls.backoffice),
      label: crossAppNavLabels.utilities,
      authenticated: true,
    },
  ];

  const handleAllCandidatesClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    clearAllFilters();
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">HealthCore Digital</p>
          <h1 className="text-lg font-semibold text-slate-900">{crossAppNav.appTitles.tracker}</h1>
          <p className="text-sm text-slate-600">Executive Assistant search · Austin headquarters</p>
        </div>
        <nav
          className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
          aria-label="Pipeline tracker navigation"
        >
          <Link
            href="/"
            onClick={handleAllCandidatesClick}
            className="font-medium text-slate-700 hover:text-teal-700 hover:underline"
          >
            All candidates
          </Link>
          <Link
            href="/account/profile"
            className="font-medium text-slate-700 hover:text-teal-700 hover:underline"
          >
            Account
          </Link>
          <span className="hidden h-4 w-px bg-slate-300 sm:inline" aria-hidden="true" />
          {crossAppLinks.map((item) => (
            <a
              key={item.href}
              href={item.authenticated ? buildAuthenticatedAppUrl(item.href) : item.href}
              className="text-slate-600 hover:text-teal-700 hover:underline"
            >
              {item.label}
            </a>
          ))}
          <LogoutButton className="text-slate-600 hover:text-teal-700 hover:underline" />
        </nav>
      </div>
    </header>
  );
}
