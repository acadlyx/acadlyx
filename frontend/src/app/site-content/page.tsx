"use client";

import {
  ChangeEvent,
  useEffect,
  useState,
} from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  authedFetch,
  getAccessToken,
} from "@/lib/auth";
import { apiUrl } from "@/lib/api";

interface Feature {
  eyebrow: string;
  title: string;
  text: string;
}

interface Statistic {
  label: string;
  value: string;
}

interface NavigationItem {
  label: string;
  href: string;
}

interface SiteContent {
  brand: {
    siteName: string;
    tagline: string;
    logoUrl: string;
    faviconUrl: string;
  };

  navigation: NavigationItem[];

  hero: {
    eyebrow: string;
    title: string;
    description: string;
    primaryCtaLabel: string;
    primaryCtaHref: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
    dashboardImageUrl: string;
    dashboardCaption: string;
  };

  sections: {
    statsEyebrow: string;
    statsTitle: string;
    statsDescription: string;
    stats: Statistic[];

    capabilitiesEyebrow: string;
    capabilitiesTitle: string;
    capabilitiesDescription: string;
    features: Feature[];

    rolesEyebrow: string;
    rolesTitle: string;
    rolesDescription: string;
    roles: string[];

    ctaEyebrow: string;
    ctaTitle: string;
    ctaDescription: string;
    ctaLabel: string;
    ctaHref: string;
  };

  contact: {
    email: string;
    phone: string;
    address: string;
    website: string;
  };

  footer: {
    text: string;
  };
}

interface ApiResponse<T> {
  data: T;
}

interface SiteContentResponse {
  content: SiteContent;
  version?: number;
  publishedAt?: string | null;
}

const DEFAULT_CONTENT: SiteContent = {
  brand: {
    siteName: "ACADLYX",
    tagline: "Education ERP",
    logoUrl: "/branding/acadlyx-logo.png",
    faviconUrl: "",
  },

  navigation: [
    {
      label: "Platform",
      href: "#platform",
    },
    {
      label: "Capabilities",
      href: "#capabilities",
    },
    {
      label: "Workspaces",
      href: "#workspaces",
    },
  ],

  hero: {
    eyebrow:
      "EDUCATION ERP & INSTITUTIONAL OPERATIONS",
    title:
      "One platform for the entire institution.",
    description:
      "ACADLYX connects academic administration, student experience, faculty workflows, institutional operations and intelligence in one secure education ERP.",
    primaryCtaLabel: "Access ACADLYX",
    primaryCtaHref: "/login",
    secondaryCtaLabel: "Explore platform",
    secondaryCtaHref: "#platform",
    dashboardImageUrl: "",
    dashboardCaption:
      "A connected view of institutional operations.",
  },

  sections: {
    statsEyebrow: "THE PLATFORM",
    statsTitle:
      "Everything important, connected.",
    statsDescription:
      "A unified operational layer for the people, academic structures and workflows that keep an institution moving.",
    stats: [
      {
        label: "Core workspaces",
        value: "07",
      },
      {
        label: "Role-aware access",
        value: "RBAC",
      },
      {
        label: "Institution scope",
        value: "100%",
      },
      {
        label: "Connected modules",
        value: "20+",
      },
    ],

    capabilitiesEyebrow:
      "CAPABILITIES",
    capabilitiesTitle:
      "ERP functionality without the ERP clutter.",
    capabilitiesDescription:
      "Each capability is designed around a real institutional workflow, with permissions and data boundaries built into the experience.",
    features: [
      {
        eyebrow: "PEOPLE",
        title:
          "Student & faculty management",
        text:
          "Keep institutional people, profiles, enrollment and academic relationships organized in one system.",
      },
      {
        eyebrow: "ACADEMICS",
        title:
          "Academic operations",
        text:
          "Connect programs, departments, courses, sections, timetable, assessments and academic records.",
      },
      {
        eyebrow: "ATTENDANCE",
        title:
          "Attendance intelligence",
        text:
          "Capture attendance and make the information useful to students, faculty and institutional leadership.",
      },
      {
        eyebrow: "EXAMINATIONS",
        title:
          "Examinations & results",
        text:
          "Manage examination workflows, marks, results and academic outcomes through controlled workspaces.",
      },
      {
        eyebrow: "FINANCE",
        title:
          "Fees & payments",
        text:
          "Bring invoices, fee structures, payments and student financial records into the same operational platform.",
      },
      {
        eyebrow: "INTELLIGENCE",
        title:
          "Institutional insights",
        text:
          "Give leadership meaningful operational visibility without exposing information outside the user's scope.",
      },
    ],

    rolesEyebrow:
      "WORKSPACES",
    rolesTitle:
      "A different experience for every responsibility.",
    rolesDescription:
      "ACADLYX adapts the application around the role, permissions and institutional scope of each user.",
    roles: [
      "Super Admin",
      "Institution Admin",
      "Management",
      "HOD",
      "Faculty",
      "Student",
      "Parent",
    ],

    ctaEyebrow: "ACADLYX",
    ctaTitle:
      "Bring the institution into one connected workspace.",
    ctaDescription:
      "Sign in to continue to the ACADLYX workspace available to your account.",
    ctaLabel: "Sign in to ACADLYX",
    ctaHref: "/login",
  },

  contact: {
    email: "",
    phone: "",
    address: "",
    website: "",
  },

  footer: {
    text:
      "Education ERP & institutional operations platform.",
  },
};

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong.";
}

function updateAtPath(
  current: SiteContent,
  path: string,
  value: unknown,
): SiteContent {
  const next =
    structuredClone(current) as SiteContent;

  const parts = path.split(".");

  let target =
    next as unknown as Record<
      string,
      unknown
    >;

  for (
    let index = 0;
    index < parts.length - 1;
    index += 1
  ) {
    const key = parts[index];

    if (
      !target[key] ||
      typeof target[key] !== "object"
    ) {
      target[key] = {};
    }

    target =
      target[key] as Record<
        string,
        unknown
      >;
  }

  target[
    parts[parts.length - 1]
  ] = value;

  return next;
}

export default function SiteContentPage() {
  const [data, setData] =
    useState<SiteContent | null>(null);

  const [version, setVersion] =
    useState<number>(0);

  const [busy, setBusy] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [msg, setMsg] =
    useState("");

  useEffect(() => {
    let mounted = true;

    async function loadContent() {
      try {
        const response =
          await authedFetch<
            ApiResponse<SiteContentResponse>
          >("/site-content");

        if (!mounted) {
          return;
        }

        setData(
          response.data?.content ||
            DEFAULT_CONTENT,
        );

        setVersion(
          response.data?.version || 0,
        );
      } catch (error) {
        if (!mounted) {
          return;
        }

        setMsg(
          getErrorMessage(error),
        );

        setData(DEFAULT_CONTENT);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadContent();

    return () => {
      mounted = false;
    };
  }, []);

  function setValue(
    path: string,
    value: string,
  ) {
    setData((current) =>
      current
        ? updateAtPath(
            current,
            path,
            value,
          )
        : current,
    );
  }

  function updateFeature(
    index: number,
    key: keyof Feature,
    value: string,
  ) {
    setData((current) => {
      if (!current) {
        return current;
      }

      const next =
        structuredClone(current);

      next.sections.features[index] = {
        ...next.sections.features[index],
        [key]: value,
      };

      return next;
    });
  }

  function updateStat(
    index: number,
    key: keyof Statistic,
    value: string,
  ) {
    setData((current) => {
      if (!current) {
        return current;
      }

      const next =
        structuredClone(current);

      next.sections.stats[index] = {
        ...next.sections.stats[index],
        [key]: value,
      };

      return next;
    });
  }

  function updateNavigation(
    index: number,
    key: keyof NavigationItem,
    value: string,
  ) {
    setData((current) => {
      if (!current) {
        return current;
      }

      const next =
        structuredClone(current);

      next.navigation[index] = {
        ...next.navigation[index],
        [key]: value,
      };

      return next;
    });
  }

  function updateRole(
    index: number,
    value: string,
  ) {
    setData((current) => {
      if (!current) {
        return current;
      }

      const next =
        structuredClone(current);

      next.sections.roles[index] =
        value;

      return next;
    });
  }

  function addFeature() {
    setData((current) => {
      if (!current) {
        return current;
      }

      const next =
        structuredClone(current);

      next.sections.features.push({
        eyebrow: "CAPABILITY",
        title: "New capability",
        text:
          "Describe this capability.",
      });

      return next;
    });
  }

  function removeFeature(
    index: number,
  ) {
    setData((current) => {
      if (!current) {
        return current;
      }

      const next =
        structuredClone(current);

      next.sections.features.splice(
        index,
        1,
      );

      return next;
    });
  }

  function addStat() {
    setData((current) => {
      if (!current) {
        return current;
      }

      const next =
        structuredClone(current);

      next.sections.stats.push({
        label: "New metric",
        value: "00",
      });

      return next;
    });
  }

  function removeStat(
    index: number,
  ) {
    setData((current) => {
      if (!current) {
        return current;
      }

      const next =
        structuredClone(current);

      next.sections.stats.splice(
        index,
        1,
      );

      return next;
    });
  }

  function addNavigation() {
    setData((current) => {
      if (!current) {
        return current;
      }

      const next =
        structuredClone(current);

      next.navigation.push({
        label: "New link",
        href: "#",
      });

      return next;
    });
  }

  function removeNavigation(
    index: number,
  ) {
    setData((current) => {
      if (!current) {
        return current;
      }

      const next =
        structuredClone(current);

      next.navigation.splice(
        index,
        1,
      );

      return next;
    });
  }

  function addRole() {
    setData((current) => {
      if (!current) {
        return current;
      }

      const next =
        structuredClone(current);

      next.sections.roles.push(
        "New workspace",
      );

      return next;
    });
  }

  function removeRole(
    index: number,
  ) {
    setData((current) => {
      if (!current) {
        return current;
      }

      const next =
        structuredClone(current);

      next.sections.roles.splice(
        index,
        1,
      );

      return next;
    });
  }

  async function save() {
    if (!data) {
      return;
    }

    setBusy(true);
    setMsg("");

    try {
      const response =
        await authedFetch<
          ApiResponse<SiteContentResponse>
        >(
          "/site-content",
          {
            method: "PUT",
            body: JSON.stringify(
              data,
            ),
          },
        );

      setVersion(
        response.data?.version ||
          version + 1,
      );

      setMsg(
        "Website content saved and published successfully.",
      );
    } catch (error) {
      setMsg(
        getErrorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  }

  async function upload(
    event: ChangeEvent<HTMLInputElement>,
    path: string,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setBusy(true);
    setMsg("");

    try {
      const token =
        getAccessToken();

      if (!token) {
        throw new Error(
          "Your session has expired. Please sign in again.",
        );
      }

      const formData =
        new FormData();

      formData.append(
        "file",
        file,
      );

      const response =
        await fetch(
          apiUrl(
            "/site-content/media",
          ),
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            body: formData,
          },
        );

      const body =
        (await response.json()) as {
          data?: {
            url?: string;
          };
          error?: {
            message?: string;
          };
        };

      if (!response.ok) {
        throw new Error(
          body.error?.message ||
            "Upload failed.",
        );
      }

      const uploadedUrl =
        body.data?.url;

      if (!uploadedUrl) {
        throw new Error(
          "Upload completed but no media URL was returned.",
        );
      }

      setValue(
        path,
        uploadedUrl,
      );

      setMsg(
        "Image uploaded. Save & publish to make it live.",
      );
    } catch (error) {
      setMsg(
        getErrorMessage(error),
      );
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  if (loading || !data) {
    return (
      <DashboardShell
        title="Website"
        subtitle="Public website content"
        allowedRoles={[
          "SUPER_ADMIN",
          "CMS",
        ]}
      >
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 h-8 w-72 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Website"
      subtitle="Public website content"
      allowedRoles={[
        "SUPER_ADMIN",
        "CMS",
      ]}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-xl shadow-slate-200/60 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">
                Public website control
              </p>

              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Website CMS
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Every major landing-page content block is controlled here.
                Changes are stored in the database and published to the public
                website.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                Version {version}
              </span>

              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-blue-50 disabled:opacity-50"
              >
                {busy
                  ? "Saving…"
                  : "Save & publish"}
              </button>
            </div>
          </div>
        </section>

        {msg && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
            {msg}
          </div>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <SectionTitle
            eyebrow="01"
            title="Branding"
            description="Control the public identity shown on the landing page."
          />

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Field
              label="Site name"
              value={
                data.brand.siteName
              }
              onChange={(value) =>
                setValue(
                  "brand.siteName",
                  value,
                )
              }
            />

            <Field
              label="Tagline"
              value={
                data.brand.tagline
              }
              onChange={(value) =>
                setValue(
                  "brand.tagline",
                  value,
                )
              }
            />

            <ImageField
              label="Logo"
              value={
                data.brand.logoUrl
              }
              onChange={(value) =>
                setValue(
                  "brand.logoUrl",
                  value,
                )
              }
              upload={(event) =>
                upload(
                  event,
                  "brand.logoUrl",
                )
              }
            />

            <Field
              label="Favicon URL"
              value={
                data.brand.faviconUrl
              }
              onChange={(value) =>
                setValue(
                  "brand.faviconUrl",
                  value,
                )
              }
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <SectionTitle
            eyebrow="02"
            title="Navigation"
            description="Control the public navigation labels and destinations."
          />

          <div className="mt-6 space-y-3">
            {data.navigation.map(
              (item, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto]"
                >
                  <Field
                    label="Label"
                    value={item.label}
                    onChange={(value) =>
                      updateNavigation(
                        index,
                        "label",
                        value,
                      )
                    }
                  />

                  <Field
                    label="Destination"
                    value={item.href}
                    onChange={(value) =>
                      updateNavigation(
                        index,
                        "href",
                        value,
                      )
                    }
                  />

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() =>
                        removeNavigation(
                          index,
                        )
                      }
                      className="w-full rounded-lg border border-red-200 bg-white px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 md:w-auto"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ),
            )}

            <button
              type="button"
              onClick={addNavigation}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              + Add navigation item
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <SectionTitle
            eyebrow="03"
            title="Hero"
            description="This controls the main product presentation at the top of the public website."
          />

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Field
              label="Eyebrow"
              value={
                data.hero.eyebrow
              }
              onChange={(value) =>
                setValue(
                  "hero.eyebrow",
                  value,
                )
              }
            />

            <Field
              label="Title"
              value={
                data.hero.title
              }
              onChange={(value) =>
                setValue(
                  "hero.title",
                  value,
                )
              }
            />

            <div className="lg:col-span-2">
              <TextArea
                label="Description"
                value={
                  data.hero.description
                }
                onChange={(value) =>
                  setValue(
                    "hero.description",
                    value,
                  )
                }
              />
            </div>

            <Field
              label="Primary CTA label"
              value={
                data.hero
                  .primaryCtaLabel
              }
              onChange={(value) =>
                setValue(
                  "hero.primaryCtaLabel",
                  value,
                )
              }
            />

            <Field
              label="Primary CTA destination"
              value={
                data.hero
                  .primaryCtaHref
              }
              onChange={(value) =>
                setValue(
                  "hero.primaryCtaHref",
                  value,
                )
              }
            />

            <Field
              label="Secondary CTA label"
              value={
                data.hero
                  .secondaryCtaLabel
              }
              onChange={(value) =>
                setValue(
                  "hero.secondaryCtaLabel",
                  value,
                )
              }
            />

            <Field
              label="Secondary CTA destination"
              value={
                data.hero
                  .secondaryCtaHref
              }
              onChange={(value) =>
                setValue(
                  "hero.secondaryCtaHref",
                  value,
                )
              }
            />

            <ImageField
              label="Hero dashboard / product image"
              value={
                data.hero
                  .dashboardImageUrl
              }
              onChange={(value) =>
                setValue(
                  "hero.dashboardImageUrl",
                  value,
                )
              }
              upload={(event) =>
                upload(
                  event,
                  "hero.dashboardImageUrl",
                )
              }
            />

            <Field
              label="Dashboard image caption"
              value={
                data.hero
                  .dashboardCaption
              }
              onChange={(value) =>
                setValue(
                  "hero.dashboardCaption",
                  value,
                )
              }
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <SectionTitle
            eyebrow="04"
            title="Platform snapshot"
            description="The metrics displayed immediately below the hero."
          />

          <div className="mt-6 space-y-3">
            {data.sections.stats.map(
              (stat, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto]"
                >
                  <Field
                    label="Metric label"
                    value={stat.label}
                    onChange={(value) =>
                      updateStat(
                        index,
                        "label",
                        value,
                      )
                    }
                  />

                  <Field
                    label="Value"
                    value={stat.value}
                    onChange={(value) =>
                      updateStat(
                        index,
                        "value",
                        value,
                      )
                    }
                  />

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() =>
                        removeStat(
                          index,
                        )
                      }
                      className="w-full rounded-lg border border-red-200 bg-white px-3 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 md:w-auto"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ),
            )}

            <button
              type="button"
              onClick={addStat}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              + Add metric
            </button>
          </div>

          <div className="mt-6 grid gap-5 border-t border-slate-100 pt-6">
            <Field
              label="Eyebrow"
              value={
                data.sections
                  .statsEyebrow
              }
              onChange={(value) =>
                setValue(
                  "sections.statsEyebrow",
                  value,
                )
              }
            />

            <Field
              label="Section title"
              value={
                data.sections
                  .statsTitle
              }
              onChange={(value) =>
                setValue(
                  "sections.statsTitle",
                  value,
                )
              }
            />

            <TextArea
              label="Section description"
              value={
                data.sections
                  .statsDescription
              }
              onChange={(value) =>
                setValue(
                  "sections.statsDescription",
                  value,
                )
              }
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <SectionTitle
            eyebrow="05"
            title="Capabilities"
            description="Manage every capability card displayed on the public website."
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {data.sections.features.map(
              (feature, index) => (
                <article
                  key={index}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">
                      Capability {index + 1}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        removeFeature(
                          index,
                        )
                      }
                      className="text-xs font-semibold text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    <Field
                      label="Eyebrow"
                      value={
                        feature.eyebrow
                      }
                      onChange={(value) =>
                        updateFeature(
                          index,
                          "eyebrow",
                          value,
                        )
                      }
                    />

                    <Field
                      label="Title"
                      value={
                        feature.title
                      }
                      onChange={(value) =>
                        updateFeature(
                          index,
                          "title",
                          value,
                        )
                      }
                    />

                    <TextArea
                      label="Description"
                      value={
                        feature.text
                      }
                      onChange={(value) =>
                        updateFeature(
                          index,
                          "text",
                          value,
                        )
                      }
                    />
                  </div>
                </article>
              ),
            )}
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={addFeature}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              + Add capability
            </button>
          </div>

          <div className="mt-8 grid gap-5 border-t border-slate-100 pt-6">
            <Field
              label="Eyebrow"
              value={
                data.sections
                  .capabilitiesEyebrow
              }
              onChange={(value) =>
                setValue(
                  "sections.capabilitiesEyebrow",
                  value,
                )
              }
            />

            <Field
              label="Section title"
              value={
                data.sections
                  .capabilitiesTitle
              }
              onChange={(value) =>
                setValue(
                  "sections.capabilitiesTitle",
                  value,
                )
              }
            />

            <TextArea
              label="Section description"
              value={
                data.sections
                  .capabilitiesDescription
              }
              onChange={(value) =>
                setValue(
                  "sections.capabilitiesDescription",
                  value,
                )
              }
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <SectionTitle
            eyebrow="06"
            title="Workspaces"
            description="Control the role/workspace names shown on the landing page."
          />

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.sections.roles.map(
              (role, index) => (
                <div
                  key={index}
                  className="flex gap-2"
                >
                  <input
                    value={role}
                    onChange={(event) =>
                      updateRole(
                        index,
                        event.target.value,
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      removeRole(
                        index,
                      )
                    }
                    className="rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    ×
                  </button>
                </div>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={addRole}
            className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            + Add workspace
          </button>

          <div className="mt-8 grid gap-5 border-t border-slate-100 pt-6">
            <Field
              label="Eyebrow"
              value={
                data.sections
                  .rolesEyebrow
              }
              onChange={(value) =>
                setValue(
                  "sections.rolesEyebrow",
                  value,
                )
              }
            />

            <Field
              label="Section title"
              value={
                data.sections
                  .rolesTitle
              }
              onChange={(value) =>
                setValue(
                  "sections.rolesTitle",
                  value,
                )
              }
            />

            <TextArea
              label="Section description"
              value={
                data.sections
                  .rolesDescription
              }
              onChange={(value) =>
                setValue(
                  "sections.rolesDescription",
                  value,
                )
              }
            />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <SectionTitle
            eyebrow="07"
            title="Final CTA"
            description="Control the final call-to-action section before the footer."
          />

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Field
              label="Eyebrow"
              value={
                data.sections.ctaEyebrow
              }
              onChange={(value) =>
                setValue(
                  "sections.ctaEyebrow",
                  value,
                )
              }
            />

            <Field
              label="Button label"
              value={
                data.sections.ctaLabel
              }
              onChange={(value) =>
                setValue(
                  "sections.ctaLabel",
                  value,
                )
              }
            />

            <Field
              label="Title"
              value={
                data.sections.ctaTitle
              }
              onChange={(value) =>
                setValue(
                  "sections.ctaTitle",
                  value,
                )
              }
            />

            <Field
              label="Destination"
              value={
                data.sections.ctaHref
              }
              onChange={(value) =>
                setValue(
                  "sections.ctaHref",
                  value,
                )
              }
            />

            <div className="lg:col-span-2">
              <TextArea
                label="Description"
                value={
                  data.sections
                    .ctaDescription
                }
                onChange={(value) =>
                  setValue(
                    "sections.ctaDescription",
                    value,
                  )
                }
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <SectionTitle
            eyebrow="08"
            title="Contact & footer"
            description="Optional public contact information and footer copy."
          />

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Field
              label="Email"
              value={
                data.contact.email
              }
              onChange={(value) =>
                setValue(
                  "contact.email",
                  value,
                )
              }
            />

            <Field
              label="Phone"
              value={
                data.contact.phone
              }
              onChange={(value) =>
                setValue(
                  "contact.phone",
                  value,
                )
              }
            />

            <Field
              label="Website"
              value={
                data.contact.website
              }
              onChange={(value) =>
                setValue(
                  "contact.website",
                  value,
                )
              }
            />

            <Field
              label="Address"
              value={
                data.contact.address
              }
              onChange={(value) =>
                setValue(
                  "contact.address",
                  value,
                )
              }
            />

            <div className="lg:col-span-2">
              <TextArea
                label="Footer text"
                value={
                  data.footer.text
                }
                onChange={(value) =>
                  setValue(
                    "footer.text",
                    value,
                  )
                }
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end pb-8">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {busy
              ? "Saving…"
              : "Save & publish website"}
          </button>
        </div>
      </div>
    </DashboardShell>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">
        {eyebrow}
      </p>

      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
        {title}
      </h2>

      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">
        {label}
      </span>

      <input
        value={value || ""}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">
        {label}
      </span>

      <textarea
        value={value || ""}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        rows={4}
        className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function ImageField({
  label,
  value,
  onChange,
  upload,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  upload: (
    event: ChangeEvent<HTMLInputElement>,
  ) => void;
}) {
  return (
    <div>
      <Field
        label={`${label} URL`}
        value={value}
        onChange={onChange}
      />

      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={upload}
        className="mt-2 block w-full text-xs text-slate-500"
      />

      {value && (
        <div className="mt-3 flex h-20 items-center rounded-xl border border-slate-200 bg-slate-50 p-3">
          <img
            src={value}
            alt={`${label} preview`}
            className="h-full max-w-[220px] object-contain"
          />
        </div>
      )}
    </div>
  );
}
