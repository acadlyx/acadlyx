"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { authedFetch } from "@/lib/auth";

type Feature = { eyebrow: string; title: string; text: string };
type ProductSection = {
  id: string;
  visible: boolean;
  title: string;
  body: string;
  imageUrl: string;
  imageAlt: string;
  layout: "statement" | "split";
};
type ProductPage = {
  seo: { title: string; description: string };
  title: string;
  introduction: string;
  sections: ProductSection[];
  media: Array<{ url: string; alt: string; caption: string }>;
};
type CmsData = {
  brand: { siteName: string; logoUrl: string; [key: string]: unknown };
  seo: { title: string; description: string };
  hero: {
    title: string;
    description: string;
    dashboardImageUrl: string;
    dashboardImageAlt: string;
    dashboardCaption: string;
    [key: string]: unknown;
  };
  sections: {
    capabilitiesTitle: string;
    capabilitiesDescription: string;
    features: Feature[];
    rolesTitle: string;
    rolesDescription: string;
    [key: string]: unknown;
  };
  productPage: ProductPage;
  footer: { text: string; [key: string]: unknown };
  [key: string]: unknown;
};

const fallback: CmsData = {
  brand: {
    siteName: "ACADLYX",
    logoUrl: "/branding/acadlyx-logo.png",
  },
  seo: {
    title: "ACADLYX | Education ERP for Colleges and Universities",
    description:
      "ACADLYX connects student information with admissions, academic, examination, finance and institutional workflows in one role-based Education ERP.",
  },
  hero: {
    title: "Admissions, academics and finance, connected to the student record.",
    description:
      "ACADLYX is an Education ERP for colleges and universities. It connects student information with the academic, administrative and financial workflows used across an institution.",
    dashboardImageUrl: "",
    dashboardImageAlt: "",
    dashboardCaption: "",
  },
  sections: {
    capabilitiesTitle: "The work that keeps an institution running.",
    capabilitiesDescription:
      "Admissions, student records, teaching activity, attendance, examinations and finance depend on the same institutional information. ACADLYX keeps those workflows in context.",
    features: [
      {
        eyebrow: "",
        title: "Admissions and enrolment",
        text: "Review applications, record admission decisions and carry student information into the academic record.",
      },
      {
        eyebrow: "",
        title: "Academic operations",
        text: "Manage programmes, courses, sections, timetables and the records used by academic departments and faculty.",
      },
      {
        eyebrow: "",
        title: "Attendance and examinations",
        text: "Keep attendance, assessments, examination schedules and results connected to the student’s academic journey.",
      },
      {
        eyebrow: "",
        title: "Fees and finance",
        text: "Coordinate fee structures, collections, concessions and the supporting work of finance teams.",
      },
    ],
    rolesTitle: "A student record, shared across the right teams.",
    rolesDescription:
      "Students, faculty, academic departments, administration, leadership and finance each work with different parts of the student record. ACADLYX gives each role a separate workspace and limits access to the information and actions their work requires.",
  },
  productPage: {
    seo: {
      title: "About ACADLYX | Education ERP for Colleges and Universities",
      description:
        "Product information and institutional workflows managed by the ACADLYX content team.",
    },
    title: "How ACADLYX connects institutional work.",
    introduction:
      "ACADLYX is an Education ERP for colleges and universities. It connects student records with the academic, administrative and financial work that takes place around them.",
    sections: [],
    media: [],
  },
  footer: {
    text: "Education ERP for colleges and universities.",
  },
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asText(value: unknown, defaultValue = ""): string {
  return typeof value === "string" ? value : defaultValue;
}

function normalizeFeature(value: unknown): Feature | null {
  const item = asRecord(value);
  const title = asText(item.title).trim();
  const text = asText(item.text).trim();
  return title || text
    ? { eyebrow: asText(item.eyebrow), title, text }
    : null;
}

function normalizeProductSection(value: unknown, index: number): ProductSection {
  const item = asRecord(value);
  return {
    id: asText(item.id, "section-" + (index + 1)),
    visible: typeof item.visible === "boolean" ? item.visible : true,
    title: asText(item.title),
    body: asText(item.body),
    imageUrl: asText(item.imageUrl),
    imageAlt: asText(item.imageAlt),
    layout: item.layout === "split" ? "split" : "statement",
  };
}

function normalizeContent(value: unknown): CmsData {
  const source = asRecord(value);
  const brand = asRecord(source.brand);
  const seo = asRecord(source.seo);
  const hero = asRecord(source.hero);
  const sections = asRecord(source.sections);
  const productPage = asRecord(source.productPage);
  const productSeo = asRecord(productPage.seo);
  const footer = asRecord(source.footer);

  const features = Array.isArray(sections.features)
    ? sections.features
        .map(normalizeFeature)
        .filter((item): item is Feature => item !== null)
    : fallback.sections.features;
  const productSections = Array.isArray(productPage.sections)
    ? productPage.sections.map(normalizeProductSection)
    : fallback.productPage.sections;
  const media = Array.isArray(productPage.media)
    ? productPage.media.map((value) => {
        const item = asRecord(value);
        return {
          url: asText(item.url),
          alt: asText(item.alt),
          caption: asText(item.caption),
        };
      })
    : fallback.productPage.media;

  return {
    ...fallback,
    ...source,
    brand: {
      ...fallback.brand,
      ...brand,
      siteName: asText(brand.siteName, fallback.brand.siteName),
      logoUrl: asText(brand.logoUrl, fallback.brand.logoUrl),
    },
    seo: {
      ...fallback.seo,
      ...seo,
      title: asText(seo.title, fallback.seo.title),
      description: asText(seo.description, fallback.seo.description),
    },
    hero: {
      ...fallback.hero,
      ...hero,
      title: asText(hero.title, fallback.hero.title),
      description: asText(hero.description, fallback.hero.description),
      dashboardImageUrl: asText(hero.dashboardImageUrl),
      dashboardImageAlt: asText(hero.dashboardImageAlt),
      dashboardCaption: asText(hero.dashboardCaption),
    },
    sections: {
      ...fallback.sections,
      ...sections,
      capabilitiesTitle: asText(
        sections.capabilitiesTitle,
        fallback.sections.capabilitiesTitle,
      ),
      capabilitiesDescription: asText(
        sections.capabilitiesDescription,
        fallback.sections.capabilitiesDescription,
      ),
      features,
      rolesTitle: asText(sections.rolesTitle, fallback.sections.rolesTitle),
      rolesDescription: asText(
        sections.rolesDescription,
        fallback.sections.rolesDescription,
      ),
    },
    productPage: {
      ...fallback.productPage,
      ...productPage,
      seo: {
        ...fallback.productPage.seo,
        ...productSeo,
        title: asText(productSeo.title, fallback.productPage.seo.title),
        description: asText(
          productSeo.description,
          fallback.productPage.seo.description,
        ),
      },
      title: asText(productPage.title, fallback.productPage.title),
      introduction: asText(
        productPage.introduction,
        fallback.productPage.introduction,
      ),
      sections: productSections,
      media,
    },
    footer: {
      ...fallback.footer,
      ...footer,
      text: asText(footer.text, fallback.footer.text),
    },
  } as CmsData;
}

export default function SiteContentPage() {
  const [data, setData] = useState<CmsData>(fallback);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    authedFetch<{ data?: { content?: unknown } }>("/site-content")
      .then((response) => setData(normalizeContent(response.data?.content)))
      .catch((error) =>
        setMessage(
          error instanceof Error ? error.message : "Unable to load website CMS.",
        ),
      );
  }, []);

  function set(path: string, value: unknown) {
    setData((current) => {
      const next = structuredClone(current) as CmsData;
      const parts = path.split(".");
      let cursor: Record<string, unknown> | unknown[] =
        next as unknown as Record<string, unknown>;

      for (let index = 0; index < parts.length - 1; index += 1) {
        const part = parts[index];
        const child = Array.isArray(cursor)
          ? cursor[Number(part)]
          : cursor[part];
        if (!child || typeof child !== "object") return current;
        cursor = child as Record<string, unknown> | unknown[];
      }

      const last = parts[parts.length - 1];
      if (Array.isArray(cursor)) cursor[Number(last)] = value;
      else cursor[last] = value;
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await authedFetch("/site-content", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      setMessage("Website content saved and published.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Publish failed.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>, path: string) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await authedFetch<{ data: { url: string } }>(
        "/site-content/media",
        { method: "POST", body: form },
      );
      set(path, response.data.url);
      setMessage("Image uploaded. Save to publish.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      input.value = "";
    }
  }

  return (
    <DashboardShell
      title="Website CMS"
      subtitle="Manage the public ACADLYX homepage and product information"
      allowedRoles={["SUPER_ADMIN", "CMS"]}
    >
      <div className="mx-auto max-w-7xl space-y-8 pb-10">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">
              Public website content
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Edit the published homepage and the information page reached from
              “Learn More About ACADLYX”.
            </p>
            {message ? (
              <p className="mt-3 text-sm font-medium text-slate-700" role="status">
                {message}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="min-h-11 border border-slate-900 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Publishing…" : "Save & publish"}
          </button>
        </header>

        <section className="grid gap-x-8 gap-y-8 lg:grid-cols-2">
          <div className="space-y-5">
            <Card title="Brand identity">
              <Field
                label="Site name"
                value={data.brand.siteName}
                onChange={(value) => set("brand.siteName", value)}
              />
              <div className="mt-4">
                <ImageField
                  label="Logo"
                  value={data.brand.logoUrl}
                  onChange={(value) => set("brand.logoUrl", value)}
                  upload={(event) => upload(event, "brand.logoUrl")}
                />
              </div>
            </Card>

            <Card title="Homepage search appearance">
              <Field
                label="Page title"
                value={data.seo.title}
                onChange={(value) => set("seo.title", value)}
              />
              <div className="mt-4">
                <TextArea
                  label="Search description"
                  value={data.seo.description}
                  onChange={(value) => set("seo.description", value)}
                />
              </div>
            </Card>
          </div>

          <Card title="Homepage introduction">
            <Field
              label="Main heading"
              value={data.hero.title}
              onChange={(value) => set("hero.title", value)}
            />
            <div className="mt-4">
              <TextArea
                label="Introduction"
                value={data.hero.description}
                onChange={(value) => set("hero.description", value)}
              />
            </div>
            <div className="mt-4">
              <ImageField
                label="Genuine product media (optional)"
                value={data.hero.dashboardImageUrl}
                onChange={(value) => set("hero.dashboardImageUrl", value)}
                upload={(event) => upload(event, "hero.dashboardImageUrl")}
              />
            </div>
            <div className="mt-4">
              <Field
                label="Image alternative text"
                value={data.hero.dashboardImageAlt}
                onChange={(value) => set("hero.dashboardImageAlt", value)}
              />
            </div>
            <div className="mt-4">
              <Field
                label="Media caption"
                value={data.hero.dashboardCaption}
                onChange={(value) => set("hero.dashboardCaption", value)}
              />
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              The page uses a fixed “Learn More About ACADLYX” action. Upload
              only an actual product screenshot or approved product image.
            </p>
          </Card>
        </section>

        <Card title="Institutional workflows">
          <TextGroup
            title="Section heading"
            titleValue={data.sections.capabilitiesTitle}
            descriptionValue={data.sections.capabilitiesDescription}
            onTitleChange={(value) => set("sections.capabilitiesTitle", value)}
            onDescriptionChange={(value) =>
              set("sections.capabilitiesDescription", value)
            }
          />
          <FeatureListEditor items={data.sections.features} set={set} />
        </Card>

        <Card title="Roles and access">
          <TextGroup
            title="Section heading"
            titleValue={data.sections.rolesTitle}
            descriptionValue={data.sections.rolesDescription}
            onTitleChange={(value) => set("sections.rolesTitle", value)}
            onDescriptionChange={(value) =>
              set("sections.rolesDescription", value)
            }
          />
        </Card>

        <ProductPageEditor data={data.productPage} set={set} upload={upload} />

        <Card title="Footer">
          <TextArea
            label="Footer description"
            value={data.footer.text}
            onChange={(value) => set("footer.text", value)}
          />
        </Card>
      </div>
    </DashboardShell>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 pt-6">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TextGroup({
  title,
  titleValue,
  descriptionValue,
  onTitleChange,
  onDescriptionChange,
}: {
  title: string;
  titleValue: string;
  descriptionValue: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Field label={title} value={titleValue} onChange={onTitleChange} />
      <TextArea
        label="Description"
        value={descriptionValue}
        onChange={onDescriptionChange}
      />
    </div>
  );
}

function FeatureListEditor({
  items,
  set,
}: {
  items: Feature[];
  set: (path: string, value: unknown) => void;
}) {
  function move(index: number, offset: -1 | 1) {
    const next = [...items];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    set("sections.features", next);
  }

  return (
    <div className="mt-6 border-t border-slate-200 pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Workflow entries</h3>
        <button
          type="button"
          onClick={() =>
            set("sections.features", [
              ...items,
              { eyebrow: "", title: "", text: "" },
            ])
          }
          className="text-sm font-semibold text-emerald-800 underline underline-offset-4"
        >
          Add workflow
        </button>
      </div>

      <div className="mt-4 space-y-5">
        {items.map((item, index) => (
          <article
            key={index}
            className="grid gap-3 border-b border-slate-200 pb-5 last:border-b-0"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-500">
                Workflow {index + 1}
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="text-xs font-semibold text-slate-600 underline underline-offset-4 disabled:opacity-40"
                >
                  Move up
                </button>
                <button
                  type="button"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                  className="text-xs font-semibold text-slate-600 underline underline-offset-4 disabled:opacity-40"
                >
                  Move down
                </button>
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "sections.features",
                      items.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  className="text-xs font-semibold text-red-700 underline underline-offset-4"
                >
                  Remove
                </button>
              </div>
            </div>
            <Field
              label="Workflow name"
              value={item.title}
              onChange={(value) =>
                set("sections.features." + index + ".title", value)
              }
            />
            <TextArea
              label="What this workflow does"
              value={item.text}
              onChange={(value) =>
                set("sections.features." + index + ".text", value)
              }
            />
          </article>
        ))}
      </div>
    </div>
  );
}

function ProductPageEditor({
  data,
  set,
  upload,
}: {
  data: ProductPage;
  set: (path: string, value: unknown) => void;
  upload: (event: ChangeEvent<HTMLInputElement>, path: string) => Promise<void>;
}) {
  const sections = data.sections || [];

  function update(index: number, key: keyof ProductSection, value: string | boolean) {
    set("productPage.sections." + index + "." + key, value);
  }

  function move(index: number, offset: -1 | 1) {
    const next = [...sections];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    set("productPage.sections", next);
  }

  return (
    <Card title="Learn More About ACADLYX page">
      <p className="mb-5 text-sm text-slate-600">
        Published at <code>/about-acadlyx</code>. Manage its search metadata,
        copy, section order, visibility and genuine product imagery here.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Field
          label="Page title"
          value={data.title}
          onChange={(value) => set("productPage.title", value)}
        />
        <TextArea
          label="Introduction"
          value={data.introduction}
          onChange={(value) => set("productPage.introduction", value)}
        />
        <Field
          label="Search title"
          value={data.seo.title}
          onChange={(value) => set("productPage.seo.title", value)}
        />
        <TextArea
          label="Search description"
          value={data.seo.description}
          onChange={(value) => set("productPage.seo.description", value)}
        />
      </div>

      <div className="mt-7">
        {sections.map((section, index) => (
          <article
            key={section.id || index}
            className="border-t border-slate-200 py-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Product section {index + 1}
              </h3>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="text-xs font-semibold text-slate-600 underline underline-offset-4 disabled:opacity-40"
                >
                  Move up
                </button>
                <button
                  type="button"
                  disabled={index === sections.length - 1}
                  onClick={() => move(index, 1)}
                  className="text-xs font-semibold text-slate-600 underline underline-offset-4 disabled:opacity-40"
                >
                  Move down
                </button>
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "productPage.sections",
                      sections.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  className="text-xs font-semibold text-red-700 underline underline-offset-4"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Field
                label="Section ID"
                value={section.id}
                onChange={(value) => update(index, "id", value)}
              />
              <label className="flex items-center gap-2 self-end text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={section.visible}
                  onChange={(event) =>
                    update(index, "visible", event.target.checked)
                  }
                />
                Visible publicly
              </label>
              <Field
                label="Heading"
                value={section.title}
                onChange={(value) => update(index, "title", value)}
              />
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Layout</span>
                <select
                  value={section.layout}
                  onChange={(event) =>
                    update(index, "layout", event.target.value as ProductSection["layout"])
                  }
                  className="mt-1.5 min-h-10 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="statement">Statement</option>
                  <option value="split">Split with image</option>
                </select>
              </label>
              <div className="lg:col-span-2">
                <TextArea
                  label="Section content"
                  value={section.body}
                  onChange={(value) => update(index, "body", value)}
                />
              </div>
              <ImageField
                label="Section image"
                value={section.imageUrl}
                onChange={(value) => update(index, "imageUrl", value)}
                upload={(event) =>
                  upload(event, "productPage.sections." + index + ".imageUrl")
                }
              />
              <Field
                label="Image alternative text"
                value={section.imageAlt}
                onChange={(value) => update(index, "imageAlt", value)}
              />
            </div>
          </article>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          set("productPage.sections", [
            ...sections,
            {
              id: "section-" + (sections.length + 1),
              visible: true,
              title: "",
              body: "",
              imageUrl: "",
              imageAlt: "",
              layout: "statement",
            },
          ])
        }
        className="mt-5 text-sm font-semibold text-emerald-800 underline underline-offset-4"
      >
        Add product section
      </button>
    </Card>
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
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <input
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 min-h-10 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
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
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <textarea
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="mt-1.5 w-full resize-y border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
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
  upload?: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <Field label={label + " URL"} value={value} onChange={onChange} />
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={upload}
        disabled={!upload}
        className="mt-2 block w-full text-xs text-slate-600"
      />
    </div>
  );
}
