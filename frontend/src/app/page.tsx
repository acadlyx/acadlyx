"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Feature {
  eyebrow: string;
  title: string;
  text: string;
}

interface Statistic {
  label: string;
  value: string;
}

interface SiteContent {
  brand: {
    siteName: string;
    tagline: string;
    logoUrl: string;
    faviconUrl: string;
  };
  navigation: Array<{
    label: string;
    href: string;
  }>;
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
    eyebrow: "EDUCATION ERP & INSTITUTIONAL OPERATIONS",
    title: "One platform for the entire institution.",
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
    statsTitle: "Everything important, connected.",
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

    capabilitiesEyebrow: "CAPABILITIES",
    capabilitiesTitle: "ERP functionality without the ERP clutter.",
    capabilitiesDescription:
      "Each capability is designed around a real institutional workflow, with permissions and data boundaries built into the experience.",
    features: [
      {
        eyebrow: "PEOPLE",
        title: "Student & faculty management",
        text:
          "Keep institutional people, profiles, enrollment and academic relationships organized in one system.",
      },
      {
        eyebrow: "ACADEMICS",
        title: "Academic operations",
        text:
          "Connect programs, departments, courses, sections, timetable, assessments and academic records.",
      },
      {
        eyebrow: "ATTENDANCE",
        title: "Attendance intelligence",
        text:
          "Capture attendance and make the information useful to students, faculty and institutional leadership.",
      },
      {
        eyebrow: "EXAMINATIONS",
        title: "Examinations & results",
        text:
          "Manage examination workflows, marks, results and academic outcomes through controlled workspaces.",
      },
      {
        eyebrow: "FINANCE",
        title: "Fees & payments",
        text:
          "Bring invoices, fee structures, payments and student financial records into the same operational platform.",
      },
      {
        eyebrow: "INTELLIGENCE",
        title: "Institutional insights",
        text:
          "Give leadership meaningful operational visibility without exposing information outside the user's scope.",
      },
    ],

    rolesEyebrow: "WORKSPACES",
    rolesTitle: "A different experience for every responsibility.",
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
    ctaTitle: "Bring the institution into one connected workspace.",
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
    text: "Education ERP & institutional operations platform.",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function stringValue(
  value: unknown,
  fallback: string,
): string {
  return typeof value === "string" && value.trim()
    ? value
    : fallback;
}

function stringArray(
  value: unknown,
  fallback: string[],
): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0,
    )
    .map((item) => item.trim());
}

function normalizeContent(input: unknown): SiteContent {
  if (!isRecord(input)) {
    return DEFAULT_CONTENT;
  }

  const brand = isRecord(input.brand)
    ? input.brand
    : isRecord(input.branding)
      ? input.branding
      : {};

  const hero = isRecord(input.hero)
    ? input.hero
    : {};

  const sections = isRecord(input.sections)
    ? input.sections
    : {};

  const contact = isRecord(input.contact)
    ? input.contact
    : {};

  const footer = isRecord(input.footer)
    ? input.footer
    : {};

  const navigation = Array.isArray(input.navigation)
    ? input.navigation
        .filter(isRecord)
        .map((item) => ({
          label: stringValue(item.label, ""),
          href: stringValue(item.href, "#"),
        }))
        .filter((item) => item.label)
    : DEFAULT_CONTENT.navigation;

  const features = Array.isArray(sections.features)
    ? sections.features
        .filter(isRecord)
        .map((feature) => ({
          eyebrow: stringValue(
            feature.eyebrow,
            "CAPABILITY",
          ),
          title: stringValue(
            feature.title,
            "Capability",
          ),
          text: stringValue(
            feature.text,
            "",
          ),
        }))
        .filter((feature) => feature.title)
    : DEFAULT_CONTENT.sections.features;

  const stats = Array.isArray(sections.stats)
    ? sections.stats
        .filter(isRecord)
        .map((stat) => ({
          label: stringValue(
            stat.label,
            "Metric",
          ),
          value: stringValue(
            stat.value,
            "—",
          ),
        }))
        .filter((stat) => stat.label)
    : DEFAULT_CONTENT.sections.stats;

  return {
    brand: {
      siteName: stringValue(
        brand.siteName,
        DEFAULT_CONTENT.brand.siteName,
      ),
      tagline: stringValue(
        brand.tagline,
        DEFAULT_CONTENT.brand.tagline,
      ),
      logoUrl: stringValue(
        brand.logoUrl ??
          brand.acadlyxLogoUrl,
        DEFAULT_CONTENT.brand.logoUrl,
      ),
      faviconUrl: stringValue(
        brand.faviconUrl,
        "",
      ),
    },

    navigation:
      navigation.length > 0
        ? navigation
        : DEFAULT_CONTENT.navigation,

    hero: {
      eyebrow: stringValue(
        hero.eyebrow,
        DEFAULT_CONTENT.hero.eyebrow,
      ),
      title: stringValue(
        hero.title,
        DEFAULT_CONTENT.hero.title,
      ),
      description: stringValue(
        hero.description ??
          hero.subtitle,
        DEFAULT_CONTENT.hero.description,
      ),
      primaryCtaLabel: stringValue(
        hero.primaryCtaLabel ??
          hero.ctaText,
        DEFAULT_CONTENT.hero.primaryCtaLabel,
      ),
      primaryCtaHref: stringValue(
        hero.primaryCtaHref ??
          hero.ctaUrl,
        DEFAULT_CONTENT.hero.primaryCtaHref,
      ),
      secondaryCtaLabel: stringValue(
        hero.secondaryCtaLabel,
        DEFAULT_CONTENT.hero.secondaryCtaLabel,
      ),
      secondaryCtaHref: stringValue(
        hero.secondaryCtaHref,
        DEFAULT_CONTENT.hero.secondaryCtaHref,
      ),
      dashboardImageUrl: stringValue(
        hero.dashboardImageUrl,
        "",
      ),
      dashboardCaption: stringValue(
        hero.dashboardCaption,
        DEFAULT_CONTENT.hero.dashboardCaption,
      ),
    },

    sections: {
      statsEyebrow: stringValue(
        sections.statsEyebrow,
        DEFAULT_CONTENT.sections.statsEyebrow,
      ),
      statsTitle: stringValue(
        sections.statsTitle,
        DEFAULT_CONTENT.sections.statsTitle,
      ),
      statsDescription: stringValue(
        sections.statsDescription,
        DEFAULT_CONTENT.sections.statsDescription,
      ),
      stats:
        stats.length > 0
          ? stats
          : DEFAULT_CONTENT.sections.stats,

      capabilitiesEyebrow: stringValue(
        sections.capabilitiesEyebrow,
        DEFAULT_CONTENT.sections.capabilitiesEyebrow,
      ),
      capabilitiesTitle: stringValue(
        sections.capabilitiesTitle,
        DEFAULT_CONTENT.sections.capabilitiesTitle,
      ),
      capabilitiesDescription: stringValue(
        sections.capabilitiesDescription,
        DEFAULT_CONTENT.sections.capabilitiesDescription,
      ),
      features:
        features.length > 0
          ? features
          : DEFAULT_CONTENT.sections.features,

      rolesEyebrow: stringValue(
        sections.rolesEyebrow,
        DEFAULT_CONTENT.sections.rolesEyebrow,
      ),
      rolesTitle: stringValue(
        sections.rolesTitle,
        DEFAULT_CONTENT.sections.rolesTitle,
      ),
      rolesDescription: stringValue(
        sections.rolesDescription,
        DEFAULT_CONTENT.sections.rolesDescription,
      ),
      roles: stringArray(
        sections.roles,
        DEFAULT_CONTENT.sections.roles,
      ),

      ctaEyebrow: stringValue(
        sections.ctaEyebrow,
        DEFAULT_CONTENT.sections.ctaEyebrow,
      ),
      ctaTitle: stringValue(
        sections.ctaTitle,
        DEFAULT_CONTENT.sections.ctaTitle,
      ),
      ctaDescription: stringValue(
        sections.ctaDescription,
        DEFAULT_CONTENT.sections.ctaDescription,
      ),
      ctaLabel: stringValue(
        sections.ctaLabel,
        DEFAULT_CONTENT.sections.ctaLabel,
      ),
      ctaHref: stringValue(
        sections.ctaHref,
        DEFAULT_CONTENT.sections.ctaHref,
      ),
    },

    contact: {
      email: stringValue(
        contact.email,
        "",
      ),
      phone: stringValue(
        contact.phone,
        "",
      ),
      address: stringValue(
        contact.address,
        "",
      ),
      website: stringValue(
        contact.website,
        "",
      ),
    },

    footer: {
      text: stringValue(
        footer.text,
        DEFAULT_CONTENT.footer.text,
      ),
    },
  };
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function SmartLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className: string;
}) {
  if (
    href.startsWith("/") ||
    href.startsWith("#")
  ) {
    return (
      <Link
        href={href}
        className={className}
      >
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      className={className}
      target={isExternalHref(href) ? "_blank" : undefined}
      rel={isExternalHref(href) ? "noreferrer" : undefined}
    >
      {children}
    </a>
  );
}

function DashboardPreview({
  imageUrl,
  caption,
}: {
  imageUrl: string;
  caption: string;
}) {
  if (imageUrl) {
    return (
      <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.16)]">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          </div>

          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
            ACADLYX
          </span>
        </div>

        <Image
          src={imageUrl}
          alt={caption}
          width={1100}
          height={700}
          className="h-auto w-full object-cover"
          priority
        />
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-[680px]">
      <div className="absolute -inset-6 rounded-[40px] bg-blue-500/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.15)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          </div>

          <div className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Institution Overview
          </div>
        </div>

        <div className="grid grid-cols-[76px_1fr] bg-slate-50">
          <aside className="min-h-[360px] border-r border-slate-200 bg-white p-3">
            <div className="mx-auto h-8 w-8 rounded-lg bg-blue-600" />

            <div className="mt-6 space-y-2">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div
                  key={item}
                  className={`mx-auto h-8 w-8 rounded-lg ${
                    item === 1
                      ? "bg-blue-50"
                      : "bg-slate-50"
                  }`}
                />
              ))}
            </div>
          </aside>

          <div className="p-5 sm:p-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-600">
                  Dashboard
                </p>

                <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
                  Institution overview
                </h3>
              </div>

              <div className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 sm:block">
                This year
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Students", "2,486"],
                ["Faculty", "184"],
                ["Programs", "32"],
                ["Attendance", "92%"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
                    {label}
                  </p>

                  <p className="mt-2 text-lg font-bold text-slate-950">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1.5fr_1fr]">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700">
                    Academic activity
                  </p>

                  <span className="text-[10px] text-slate-400">
                    Current term
                  </span>
                </div>

                <div className="mt-5 flex h-28 items-end gap-2">
                  {[38, 54, 44, 70, 62, 82, 74, 92, 80].map(
                    (height, index) => (
                      <div
                        key={index}
                        className="flex-1 rounded-t-md bg-blue-100"
                        style={{
                          height: `${height}%`,
                        }}
                      >
                        <div
                          className="h-full rounded-t-md bg-blue-500/70"
                          style={{
                            height:
                              index === 7
                                ? "78%"
                                : index === 4
                                  ? "52%"
                                  : "36%",
                          }}
                        />
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-700">
                  Attention
                </p>

                <div className="mt-4 space-y-3">
                  {[
                    ["Pending requests", "17"],
                    ["Open assessments", "08"],
                    ["Unread notices", "12"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5"
                    >
                      <span className="text-[10px] text-slate-500">
                        {label}
                      </span>

                      <span className="text-xs font-bold text-slate-900">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="mt-4 text-[10px] text-slate-400">
              {caption}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [content, setContent] =
    useState<SiteContent>(DEFAULT_CONTENT);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const slug =
          process.env.NEXT_PUBLIC_PUBLIC_SITE_SLUG ||
          "aimt";

        const response =
          await apiFetch<
            ApiResponse<{
              content: unknown;
            }>
          >(
            `/site-content/public?slug=${encodeURIComponent(slug)}`,
          );

        if (!mounted) {
          return;
        }

        setContent(
          normalizeContent(
            response.data?.content,
          ),
        );
      } catch {
        if (mounted) {
          setContent(DEFAULT_CONTENT);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f7fb] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label={`${content.brand.siteName} home`}
          >
            <Image
              src={
                content.brand.logoUrl ||
                "/branding/acadlyx-logo.png"
              }
              alt={content.brand.siteName}
              width={40}
              height={40}
              className="h-9 w-9 object-contain"
              priority
            />

            <div className="leading-none">
              <span className="block text-[15px] font-bold tracking-[0.12em] text-slate-950">
                {content.brand.siteName}
              </span>

              <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.16em] text-slate-400">
                {content.brand.tagline}
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {content.navigation.map((item) => (
              <a
                key={`${item.label}-${item.href}`}
                href={item.href}
                className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <SmartLink
            href="/login"
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            Sign in
          </SmartLink>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_50%_10%,rgba(59,130,246,0.14),transparent_52%)]" />

        <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-20">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">
              {content.hero.eyebrow}
            </div>

            <h1 className="mx-auto mt-7 max-w-4xl text-4xl font-semibold leading-[1.05] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-7xl">
              {content.hero.title}
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              {content.hero.description}
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <SmartLink
                href={content.hero.primaryCtaHref}
                className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700"
              >
                {content.hero.primaryCtaLabel}
              </SmartLink>

              <SmartLink
                href={content.hero.secondaryCtaHref}
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {content.hero.secondaryCtaLabel}
              </SmartLink>
            </div>
          </div>

          <div className="mt-14 sm:mt-20">
            <DashboardPreview
              imageUrl={
                content.hero.dashboardImageUrl
              }
              caption={
                content.hero.dashboardCaption
              }
            />
          </div>
        </div>
      </section>

      <section
        id="platform"
        className="border-b border-slate-200 bg-[#eef3f8]"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">
              {content.sections.statsEyebrow}
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {content.sections.statsTitle}
            </h2>

            <p className="mt-4 text-base leading-7 text-slate-600">
              {content.sections.statsDescription}
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {content.sections.stats.map(
              (stat) => (
                <article
                  key={`${stat.label}-${stat.value}`}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    {stat.label}
                  </p>

                  <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
                    {stat.value}
                  </p>
                </article>
              ),
            )}
          </div>
        </div>
      </section>

      <section
        id="capabilities"
        className="border-b border-slate-200 bg-white"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">
              {content.sections.capabilitiesEyebrow}
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {content.sections.capabilitiesTitle}
            </h2>

            <p className="mt-4 text-base leading-7 text-slate-600">
              {content.sections.capabilitiesDescription}
            </p>
          </div>

          <div className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-slate-200 bg-slate-200 md:grid-cols-2 lg:grid-cols-3">
            {content.sections.features.map(
              (feature, index) => (
                <article
                  key={`${feature.title}-${index}`}
                  className="group bg-white p-7 transition hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-blue-600">
                      {feature.eyebrow}
                    </span>

                    <span className="text-sm font-semibold text-slate-300 transition group-hover:text-blue-600">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <h3 className="mt-8 text-lg font-semibold text-slate-950">
                    {feature.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {feature.text}
                  </p>

                  <div className="mt-7 h-px w-8 bg-blue-500 transition-all duration-300 group-hover:w-16" />
                </article>
              ),
            )}
          </div>
        </div>
      </section>

      <section
        id="workspaces"
        className="border-b border-slate-200 bg-[#f4f7fb]"
      >
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">
                {content.sections.rolesEyebrow}
              </p>

              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                {content.sections.rolesTitle}
              </h2>

              <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
                {content.sections.rolesDescription}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="grid gap-3 sm:grid-cols-2">
                {content.sections.roles.map(
                  (role, index) => (
                    <div
                      key={`${role}-${index}`}
                      className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-xs font-bold text-blue-700">
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <span className="text-sm font-semibold text-slate-800">
                        {role}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-950">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">
                {content.sections.ctaEyebrow}
              </p>

              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {content.sections.ctaTitle}
              </h2>

              <p className="mt-4 text-base leading-7 text-slate-300">
                {content.sections.ctaDescription}
              </p>
            </div>

            <SmartLink
              href={content.sections.ctaHref}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-blue-50"
            >
              {content.sections.ctaLabel}
            </SmartLink>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src={
                content.brand.logoUrl ||
                "/branding/acadlyx-logo.png"
              }
              alt={content.brand.siteName}
              width={30}
              height={30}
              className="h-7 w-7 object-contain"
            />

            <span className="text-sm font-bold tracking-[0.12em] text-slate-950">
              {content.brand.siteName}
            </span>
          </div>

          <p className="text-xs text-slate-500">
            {content.footer.text}
          </p>

          <div className="flex items-center gap-4 text-xs text-slate-500">
            {content.contact.email && (
              <a
                href={`mailto:${content.contact.email}`}
                className="hover:text-slate-900"
              >
                Contact
              </a>
            )}

            <Link
              href="/login"
              className="font-semibold text-blue-700 hover:text-blue-800"
            >
              Sign in
            </Link>
          </div>
        </div>
      </footer>

      {loading && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed bottom-5 right-5 z-40 h-2 w-2 rounded-full bg-blue-600 opacity-50"
        />
      )}
    </main>
  );
}
