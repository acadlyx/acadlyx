"use client";

import Image from "next/image";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { getCachedCurrentUser, getCurrentUser } from "@/lib/auth";
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

    // Workspace context is readable by institutional users and provides
    // fallback branding. The CMS document itself is restricted to users who
    // can manage or review institutional CMS, so ordinary dashboards do not
    // generate unauthorized requests.
    const cachedUser = getCachedCurrentUser();
    const load = async () => {
      const user = cachedUser ?? await getCurrentUser({ background: true });
      const canReadCms = user.permissions.includes("site.manage")
        || user.roles.some((role) => ["CHAIRMAN", "DIRECTOR", "MANAGEMENT"].includes(role));

      const workspace = await workspaceGet<{ data: { institution?: { name?: string; logoUrl?: string | null } } }>("/workspace/context");
      if (!active) return;

      const institution = workspace?.data?.institution;
      if (!canReadCms) {
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

      const cms = await workspaceGet<{ data: { content: InstitutionalCmsContent } }>("/institutional-cms");
      if (!active || !cms?.data?.content) return;

      setContent({
        ...cms.data.content,
        brand: {
          ...cms.data.content.brand,
          institutionName: cms.data.content.brand.institutionName || institution?.name || "",
          institutionLogoUrl: cms.data.content.brand.institutionLogoUrl || institution?.logoUrl || "",
        },
      });
    };

    void load().catch(() => undefined);

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
