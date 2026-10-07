"use client";

import Image from "next/image";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { workspaceGet } from "@/lib/workspaceCache";

export interface InstitutionalCmsContent {
  brand: {
    acadlyxLogoUrl: string;
    institutionLogoUrl: string;
    institutionName: string;
  };
  dashboard: {
    welcome: string;
    overviewTitle: string;
    overviewSubtitle: string;
    emptyState: string;
    loadingLabel: string;
    saveLabel: string;
    navigationLabel: string;
  };
  workspaces: Record<string, Record<string, unknown>>;
  messages: Record<string, string>;
}

const fallback: InstitutionalCmsContent = {
  brand: {
    acadlyxLogoUrl: "/branding/acadlyx-logo.png",
    institutionLogoUrl: "",
    institutionName: "",
  },
  dashboard: {
    welcome: "Welcome back",
    overviewTitle: "Institution overview",
    overviewSubtitle: "Your authorized institutional workspace.",
    emptyState: "No data is available for this view yet.",
    loadingLabel: "Loading workspace",
    saveLabel: "Save changes",
    navigationLabel: "Workspace navigation",
  },
  workspaces: {},
  messages: {},
};

const Context = createContext<InstitutionalCmsContent>(fallback);

export function useInstitutionalCms() {
  return useContext(Context);
}

export function InstitutionalCmsProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<InstitutionalCmsContent>(fallback);

  useEffect(() => {
    let active = true;

    // Workspace context is readable by institutional users and is enough
    // to provide safe fallback branding. The full CMS document is intentionally
    // fetched only by users who are authorized to manage/review it; ordinary
    // dashboards must never generate a predictable 403 against the CMS endpoint.
    Promise.all([
      workspaceGet<{ data: { institution?: { name?: string; logoUrl?: string | null } } }>("/workspace/context"),
      workspaceGet<{ data: { content: InstitutionalCmsContent } }>("/institutional-cms").catch(() => null),
    ])
      .then(([workspace, cms]) => {
        if (!active) return;
        const institution = workspace?.data?.institution;
        const next = cms?.data?.content;
        if (!next) {
          if (institution) {
            setContent((current) => ({
              ...current,
              brand: {
                ...current.brand,
                institutionName: institution.name || current.brand.institutionName,
                institutionLogoUrl: institution.logoUrl || current.brand.institutionLogoUrl,
              },
            }));
          }
          return;
        }
        setContent({
          ...next,
          brand: {
            ...next.brand,
            institutionName: next.brand.institutionName || institution?.name || "",
            institutionLogoUrl: next.brand.institutionLogoUrl || institution?.logoUrl || "",
          },
        });
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => content, [content]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function DashboardBranding() {
  const content = useInstitutionalCms();
  return (
    <div className="flex items-center gap-2.5" aria-label="ACADLYX and institution">
      <Image
        src={content.brand.acadlyxLogoUrl || "/branding/acadlyx-logo.png"}
        alt="ACADLYX"
        width={36}
        height={36}
        className="h-9 w-9 rounded-lg object-contain"
        priority
      />
      {content.brand.institutionLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={content.brand.institutionLogoUrl}
          alt={content.brand.institutionName || "Institution"}
          className="h-9 w-9 rounded-lg object-contain"
        />
      ) : null}
    </div>
  );
}
