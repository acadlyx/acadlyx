"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  DashboardShell,
} from "./DashboardShell";

import {
  AuthRequiredError,
} from "@/lib/auth";

import {
  AdminUser,
  createAdminUser,
  getAdminUserPhotos,
  listAdminUsers,
  setAdminUserActive,
  uploadAdminUserPhoto,
} from "@/lib/adminApi";

const CREATION_ROLES = [
  "INSTITUTION_ADMIN",
  "CHAIRMAN",
  "DIRECTOR",
  "DEAN",
  "REGISTRAR",
  "HOD",
  "FACULTY",
  "ACCOUNTS",
  "HR",
  "ADMISSIONS",
  "EXAMINATION",
  "LIBRARIAN",
  "PLACEMENT",
  "IT",
] as const;

function roleLabel(
  user: AdminUser
) {
  return user.roles
    .map(
      (role) =>
        role.name.replace(
          /_/g,
          " "
        )
    )
    .join(", ") ||
    "No role";
}

function initials(
  user: Pick<
    AdminUser,
    "firstName" | "lastName"
  >
) {
  return `${user.firstName.charAt(
    0
  )}${user.lastName.charAt(
    0
  )}`.toUpperCase();
}

function Avatar({
  user,
  url,
}: {
  user: AdminUser;
  url: string | null;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={`${user.firstName} ${user.lastName}`}
        className="h-11 w-11 rounded-2xl object-cover ring-1 ring-slate-200"
      />
    );
  }

  return (
    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-xs font-black text-white">
      {initials(user)}
    </span>
  );
}

export function UserLifecycleManager() {
  const router =
    useRouter();

  const [
    users,
    setUsers,
  ] =
    useState<
      AdminUser[]
    >([]);

  const [
    photos,
    setPhotos,
  ] =
    useState<
      Record<
        string,
        string | null
      >
    >({});

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    pendingId,
    setPendingId,
  ] =
    useState<
      string | null
    >(null);

  const [
    showCreate,
    setShowCreate,
  ] =
    useState(false);

  const [
    creating,
    setCreating,
  ] =
    useState(false);

  const [
    createPhoto,
    setCreatePhoto,
  ] =
    useState<File | null>(
      null
    );

  const createPhotoRef =
    useRef<HTMLInputElement>(
      null
    );

  const load =
    useCallback(
      async () => {
        setLoading(
          true
        );

        setError("");

        try {
          const rows =
            await listAdminUsers();

          setUsers(rows);

          setPhotos(
            await getAdminUserPhotos(
              rows.map(
                (
                  user
                ) =>
                  user.id
              )
            )
          );
        } catch (
          reason
        ) {
          if (
            reason instanceof
            AuthRequiredError
          ) {
            router.replace(
              "/login"
            );
          } else {
            setError(
              reason instanceof
                Error
                ? reason.message
                : "Unable to load people."
            );
          }
        } finally {
          setLoading(
            false
          );
        }
      },
      [router]
    );

  useEffect(() => {
    void load();
  }, [load]);

  const filtered =
    useMemo(() => {
      const term =
        query
          .trim()
          .toLocaleLowerCase();

      if (!term) {
        return users;
      }

      return users.filter(
        (
          user
        ) =>
          `${user.firstName} ${user.lastName} ${user.email} ${roleLabel(
            user
          )}`
            .toLocaleLowerCase()
            .includes(
              term
            )
      );
    }, [
      query,
      users,
    ]);

  async function toggle(
    user: AdminUser
  ) {
    const active =
      user.isActive;

    if (
      !window.confirm(
        `${
          active
            ? "Deactivate"
            : "Reactivate"
        } ${user.firstName} ${user.lastName}?`
      )
    ) {
      return;
    }

    setPendingId(
      user.id
    );

    setError("");

    try {
      const updated =
        await setAdminUserActive(
          user.id,
          !active
        );

      setUsers(
        (
          current
        ) =>
          current.map(
            (
              entry
            ) =>
              entry.id ===
              updated.id
                ? {
                    ...entry,
                    ...updated,
                  }
                : entry
          )
      );
    } catch (
      reason
    ) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to change account status."
      );
    } finally {
      setPendingId(
        null
      );
    }
  }

  async function changePhoto(
    user: AdminUser,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    event.target.value =
      "";

    if (!file) {
      return;
    }

    setPendingId(
      user.id
    );

    setError("");

    try {
      const response =
        await uploadAdminUserPhoto(
          user.id,
          file
        );

      setPhotos(
        (
          current
        ) => ({
          ...current,
          [user.id]:
            response.url,
        })
      );
    } catch (
      reason
    ) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to update profile picture."
      );
    } finally {
      setPendingId(
        null
      );
    }
  }

  async function createPerson(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const form =
      new FormData(
        event.currentTarget
      );

    setCreating(
      true
    );

    setError("");

    try {
      const created =
        await createAdminUser({
          firstName:
            String(
              form.get(
                "firstName"
              ) || ""
            ),

          lastName:
            String(
              form.get(
                "lastName"
              ) || ""
            ),

          email:
            String(
              form.get(
                "email"
              ) || ""
            ),

          phone:
            String(
              form.get(
                "phone"
              ) || ""
            ),

          password:
            String(
              form.get(
                "password"
              ) || ""
            ),

          role:
            String(
              form.get(
                "role"
              ) || ""
            ),
        });

      let photoUrl:
        | string
        | null =
        null;

      if (createPhoto) {
        const uploaded =
          await uploadAdminUserPhoto(
            created.id,
            createPhoto
          );

        photoUrl =
          uploaded.url;
      }

      setUsers(
        (
          current
        ) => [
          {
            ...created,
          },
          ...current,
        ]
      );

      setPhotos(
        (
          current
        ) => ({
          ...current,
          [created.id]:
            photoUrl,
        })
      );

      setShowCreate(
        false
      );

      setCreatePhoto(
        null
      );

      if (
        createPhotoRef.current
      ) {
        createPhotoRef.current.value =
          "";
      }
    } catch (
      reason
    ) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to create the person."
      );
    } finally {
      setCreating(
        false
      );
    }
  }

  return (
    <DashboardShell
      title="People & Access"
      subtitle="Institution-scoped people, accounts and access lifecycle"
      allowedRoles={[
        "INSTITUTION_ADMIN",
        "SUPER_ADMIN",
      ]}
    >
      <main className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500">
                Institution directory
              </p>

              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                Everyone in your
                institution
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Create
                institution-scoped
                accounts, maintain
                access status and
                keep every person
                represented by a
                real profile
                picture.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setShowCreate(
                    true
                  )
                }
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
              >
                + Add person
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/admissions"
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Student admission
              </button>
            </div>
          </div>

          <input
            value={query}
            onChange={(
              event
            ) =>
              setQuery(
                event.target.value
              )
            }
            placeholder="Search name, email or role"
            className="mt-5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white"
          />
        </section>

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
          >
            {error}

            <button
              onClick={() =>
                void load()
              }
              className="ml-3 font-bold underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  <tr>
                    <th className="px-5 py-3">
                      Person
                    </th>
                    <th className="px-5 py-3">
                      Role
                    </th>
                    <th className="px-5 py-3">
                      Contact
                    </th>
                    <th className="px-5 py-3">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filtered.map(
                    (
                      user
                    ) => {
                      const photoUrl =
                        photos[
                          user.id
                        ] ??
                        null;

                      return (
                        <tr
                          key={
                            user.id
                          }
                          className="hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar
                                user={
                                  user
                                }
                                url={
                                  photoUrl
                                }
                              />

                              <div className="min-w-0">
                                <p className="font-bold text-slate-950">
                                  {
                                    user.firstName
                                  }{" "}
                                  {
                                    user.lastName
                                  }
                                </p>

                                <p className="truncate text-xs text-slate-500">
                                  {
                                    user.email
                                  }
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-xs font-bold text-slate-600">
                            {roleLabel(
                              user
                            )}
                          </td>

                          <td className="px-5 py-4 text-xs text-slate-500">
                            {
                              user.phone ||
                              "No phone"
                            }
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                                user.isActive
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {user.isActive
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50">
                                Picture

                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/gif"
                                  className="hidden"
                                  disabled={
                                    pendingId ===
                                    user.id
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    void changePhoto(
                                      user,
                                      event
                                    )
                                  }
                                />
                              </label>

                              <button
                                disabled={
                                  pendingId ===
                                  user.id
                                }
                                onClick={() =>
                                  void toggle(
                                    user
                                  )
                                }
                                className={`rounded-lg border px-3 py-2 text-[11px] font-bold disabled:opacity-50 ${
                                  user.isActive
                                    ? "border-red-200 text-red-700"
                                    : "border-emerald-200 text-emerald-700"
                                }`}
                              >
                                {pendingId ===
                                user.id
                                  ? "Saving…"
                                  : user.isActive
                                    ? "Deactivate"
                                    : "Reactivate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>

            {!filtered.length && (
              <p className="p-10 text-center text-sm text-slate-500">
                No people match
                this search.
              </p>
            )}
          </section>
        )}

        {showCreate && (
          <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/45 p-4">
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500">
                    People
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-950">
                    Add institution
                    person
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Creates an
                    institution-scoped
                    account. Add the
                    person's picture
                    now or let them
                    add it after
                    signing in.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowCreate(
                      false
                    )
                  }
                  className="text-2xl text-slate-400"
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={
                  createPerson
                }
                className="mt-6 grid gap-4 sm:grid-cols-2"
              >
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-500">
                    First name
                  </span>

                  <input
                    name="firstName"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-500">
                    Last name
                  </span>

                  <input
                    name="lastName"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-500">
                    Email
                  </span>

                  <input
                    name="email"
                    type="email"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-500">
                    Phone
                  </span>

                  <input
                    name="phone"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-500">
                    Role
                  </span>

                  <select
                    name="role"
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
                  >
                    {CREATION_ROLES.map(
                      (
                        role
                      ) => (
                        <option
                          key={
                            role
                          }
                          value={
                            role
                          }
                        >
                          {role.replace(
                            /_/g,
                            " "
                          )}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-slate-500">
                    Initial password
                  </span>

                  <input
                    name="password"
                    type="password"
                    minLength={
                      8
                    }
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-bold text-slate-500">
                    Profile picture
                  </span>

                  <input
                    ref={
                      createPhotoRef
                    }
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(
                      event
                    ) =>
                      setCreatePhoto(
                        event
                          .target
                          .files?.[0] ||
                          null
                      )
                    }
                    className="block w-full rounded-xl border border-dashed border-slate-300 p-3 text-sm"
                  />
                </label>

                <div className="flex justify-end gap-2 sm:col-span-2">
                  <button
                    type="button"
                    onClick={() =>
                      setShowCreate(
                        false
                      )
                    }
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
                  >
                    Cancel
                  </button>

                  <button
                    disabled={
                      creating
                    }
                    className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {creating
                      ? "Creating…"
                      : "Create person"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </DashboardShell>
  );
}
