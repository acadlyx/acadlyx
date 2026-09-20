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
    acadlyxLogoUrl: string;
    institutionLogoUrl: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    primaryCtaLabel: string;
    primaryCtaHref: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
  };
  sections: {
    features: Feature[];
    stats: Statistic[];
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}

export default function SiteContentPage() {
  const [data, setData] =
    useState<SiteContent | null>(null);

  const [busy, setBusy] =
    useState(false);

  const [msg, setMsg] =
    useState("");

  useEffect(() => {
    let mounted = true;

    async function loadContent() {
      try {
        const response =
          await authedFetch<ApiResponse<SiteContent>>(
            "/site-content"
          );

        if (mounted) {
          setData(response.data);
        }
      } catch (error) {
        if (mounted) {
          setMsg(getErrorMessage(error));
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
    value: string
  ) {
    setData((current) => {
      if (!current) {
        return current;
      }

      const next =
        structuredClone(current) as SiteContent;

      const parts = path.split(".");
      let target: Record<string, unknown> =
        next as unknown as Record<
          string,
          unknown
        >;

      for (
        let index = 0;
        index < parts.length - 1;
        index += 1
      ) {
        const part = parts[index];

        if (
          typeof target[part] !== "object" ||
          target[part] === null
        ) {
          target[part] = {};
        }

        target = target[part] as Record<
          string,
          unknown
        >;
      }

      target[
        parts[parts.length - 1]
      ] = value;

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
      await authedFetch(
        "/site-content",
        {
          method: "PUT",
          body: JSON.stringify(data),
        }
      );

      setMsg(
        "Website content saved and published."
      );
    } catch (error) {
      setMsg(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function upload(
    event: ChangeEvent<HTMLInputElement>,
    path: string
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setBusy(true);
    setMsg("");

    try {
      const token = getAccessToken();

      if (!token) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      const formData = new FormData();

      formData.append(
        "file",
        file
      );

      const response = await fetch(
        apiUrl("/site-content/media"),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
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
            "Upload failed."
        );
      }

      const uploadedUrl =
        body.data?.url;

      if (!uploadedUrl) {
        throw new Error(
          "Upload completed but no media URL was returned."
        );
      }

      setValue(
        path,
        uploadedUrl
      );

      setMsg(
        "Image uploaded. Save to publish it."
      );
    } catch (error) {
      setMsg(getErrorMessage(error));
    } finally {
      setBusy(false);

      event.target.value = "";
    }
  }

  if (!data) {
    return (
      <DashboardShell
        title="Website CMS"
      >
        <div className="rounded-2xl bg-white p-6">
          {msg ||
            "Loading website content…"}
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Website CMS"
      subtitle="Control public website content without editing code"
      allowedRoles={[
        "SUPER_ADMIN",
        "CMS",
      ]}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Public website control center
            </p>

            <h1 className="mt-2 text-2xl font-bold">
              100% Dynamic Content
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Text, logos, hero images,
              features, statistics,
              gallery, contact and footer.
            </p>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy
              ? "Saving…"
              : "Save & publish"}
          </button>
        </div>

        {msg && (
          <div className="mb-5 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
            {msg}
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="font-semibold">
              Branding
            </h2>

            <div className="mt-4 space-y-4">
              <Field
                label="Site name"
                value={
                  data.brand.siteName
                }
                onChange={(value) =>
                  setValue(
                    "brand.siteName",
                    value
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
                    value
                  )
                }
              />

              <ImageField
                label="ACADLYX logo"
                value={
                  data.brand
                    .acadlyxLogoUrl
                }
                onChange={(value) =>
                  setValue(
                    "brand.acadlyxLogoUrl",
                    value
                  )
                }
                upload={(event) =>
                  upload(
                    event,
                    "brand.acadlyxLogoUrl"
                  )
                }
              />

              <ImageField
                label="AIMT / institution logo"
                value={
                  data.brand
                    .institutionLogoUrl
                }
                onChange={(value) =>
                  setValue(
                    "brand.institutionLogoUrl",
                    value
                  )
                }
                upload={(event) =>
                  upload(
                    event,
                    "brand.institutionLogoUrl"
                  )
                }
              />
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5">
            <h2 className="font-semibold">
              Hero
            </h2>

            <div className="mt-4 space-y-4">
              <Field
                label="Eyebrow"
                value={
                  data.hero.eyebrow
                }
                onChange={(value) =>
                  setValue(
                    "hero.eyebrow",
                    value
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
                    value
                  )
                }
              />

              <TextArea
                label="Description"
                value={
                  data.hero.description
                }
                onChange={(value) =>
                  setValue(
                    "hero.description",
                    value
                  )
                }
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Primary CTA label"
                  value={
                    data.hero
                      .primaryCtaLabel
                  }
                  onChange={(value) =>
                    setValue(
                      "hero.primaryCtaLabel",
                      value
                    )
                  }
                />

                <Field
                  label="Primary CTA URL"
                  value={
                    data.hero
                      .primaryCtaHref
                  }
                  onChange={(value) =>
                    setValue(
                      "hero.primaryCtaHref",
                      value
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
                      value
                    )
                  }
                />

                <Field
                  label="Secondary CTA URL"
                  value={
                    data.hero
                      .secondaryCtaHref
                  }
                  onChange={(value) =>
                    setValue(
                      "hero.secondaryCtaHref",
                      value
                    )
                  }
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5 xl:col-span-2">
            <h2 className="font-semibold">
              Features
            </h2>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {data.sections.features.map(
                (
                  feature,
                  index
                ) => (
                  <div
                    key={index}
                    className="rounded-xl bg-slate-50 p-4"
                  >
                    <Field
                      label={`Title ${
                        index + 1
                      }`}
                      value={
                        feature.title
                      }
                      onChange={(
                        value
                      ) => {
                        setData(
                          (current) => {
                            if (!current) {
                              return current;
                            }

                            const next =
                              structuredClone(
                                current
                              );

                            next.sections.features[
                              index
                            ] = {
                              ...next.sections
                                .features[
                                index
                              ],
                              title:
                                value,
                            };

                            return next;
                          }
                        );
                      }}
                    />

                    <div className="mt-3">
                      <TextArea
                        label="Text"
                        value={
                          feature.text
                        }
                        onChange={(
                          value
                        ) => {
                          setData(
                            (current) => {
                              if (!current) {
                                return current;
                              }

                              const next =
                                structuredClone(
                                  current
                                );

                              next.sections.features[
                                index
                              ] = {
                                ...next
                                  .sections
                                  .features[
                                  index
                                ],
                                text:
                                  value,
                              };

                              return next;
                            }
                          );
                        }}
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5">
            <h2 className="font-semibold">
              Institution stats
            </h2>

            <div className="mt-4 space-y-3">
              {data.sections.stats.map(
                (
                  statistic,
                  index
                ) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                  >
                    <Field
                      label="Label"
                      value={
                        statistic.label
                      }
                      onChange={(
                        value
                      ) => {
                        setData(
                          (current) => {
                            if (!current) {
                              return current;
                            }

                            const next =
                              structuredClone(
                                current
                              );

                            next.sections.stats[
                              index
                            ] = {
                              ...next.sections
                                .stats[
                                index
                              ],
                              label:
                                value,
                            };

                            return next;
                          }
                        );
                      }}
                    />

                    <Field
                      label="Value"
                      value={
                        statistic.value
                      }
                      onChange={(
                        value
                      ) => {
                        setData(
                          (current) => {
                            if (!current) {
                              return current;
                            }

                            const next =
                              structuredClone(
                                current
                              );

                            next.sections.stats[
                              index
                            ] = {
                              ...next.sections
                                .stats[
                                index
                              ],
                              value:
                                value,
                            };

                            return next;
                          }
                        );
                      }}
                    />
                  </div>
                )
              )}
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-5">
            <h2 className="font-semibold">
              Contact & footer
            </h2>

            <div className="mt-4 space-y-3">
              <Field
                label="Email"
                value={
                  data.contact.email
                }
                onChange={(value) =>
                  setValue(
                    "contact.email",
                    value
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
                    value
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
                    value
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
                    value
                  )
                }
              />

              <Field
                label="Footer text"
                value={
                  data.footer.text
                }
                onChange={(value) =>
                  setValue(
                    "footer.text",
                    value
                  )
                }
              />
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
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
      <span className="text-xs font-semibold text-slate-500">
        {label}
      </span>

      <input
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
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
      <span className="text-xs font-semibold text-slate-500">
        {label}
      </span>

      <textarea
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        rows={3}
        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-500"
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
    event: ChangeEvent<HTMLInputElement>
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
        accept="image/*"
        onChange={upload}
        className="mt-2 block w-full text-xs"
      />

      {value && (
        <img
          src={value}
          alt={`${label} preview`}
          className="mt-2 h-16 w-16 rounded-lg border object-contain"
        />
      )}
    </div>
  );
}
