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

import { DashboardShell } from "./DashboardShell";

import { AuthRequiredError } from "@/lib/auth";

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

type RoleFilter =
| "ALL"
| (typeof CREATION_ROLES)[number]
| "STUDENT";

type StatusFilter =
| "ALL"
| "ACTIVE"
| "INACTIVE";

function roleLabel(role: string) {
return role
.replace(/_/g, " ")
.toLowerCase()
.replace(/\b\w/g, (letter) =>
letter.toUpperCase(),
);
}

function userRoleLabel(user: AdminUser) {
return (
user.roles
.map((role) => roleLabel(role.name))
.join(", ") || "No role"
);
}

function initials(
user: Pick<
AdminUser,
"firstName" | "lastName"

> ,
> ) {
> const first =
> user.firstName?.trim()?.charAt(0) || "";

const last =
user.lastName?.trim()?.charAt(0) || "";

return (
`${first}${last}`.toUpperCase() || "?"
);
}

function Avatar({
user,
url,
size = "md",
}: {
user: AdminUser;
url: string | null;
size?: "sm" | "md" | "lg";
}) {
const sizeClass =
size === "lg"
? "h-16 w-16 text-base"
: size === "sm"
? "h-9 w-9 text-[10px]"
: "h-11 w-11 text-xs";

if (url) {
return (
<img
src={url}
alt={`${user.firstName} ${user.lastName}`}
className={`${sizeClass} rounded-2xl object-cover ring-1 ring-slate-200`}
/>
);
}

return (
<span
aria-label={`${user.firstName} ${user.lastName} profile picture placeholder`}
className={`grid ${sizeClass} shrink-0 place-items-center rounded-2xl bg-slate-950 font-black text-white`}
>
{initials(user)} </span>
);
}

function Field({
label,
name,
type = "text",
required = false,
placeholder,
}: {
label: string;
name: string;
type?: string;
required?: boolean;
placeholder?: string;
}) {
return ( <label className="block"> <span className="mb-1.5 block text-xs font-bold text-slate-600">
{label}
{required ? ( <span className="ml-1 text-red-500">
* </span>
) : null} </span>

```
  <input
    name={name}
    type={type}
    required={required}
    placeholder={placeholder}
    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
  />
</label>
```

);
}

export function UserLifecycleManager() {
const router = useRouter();

const [users, setUsers] =
useState<AdminUser[]>([]);

const [photos, setPhotos] =
useState<Record<string, string | null>>(
{},
);

const [query, setQuery] =
useState("");

const [roleFilter, setRoleFilter] =
useState<RoleFilter>("ALL");

const [statusFilter, setStatusFilter] =
useState<StatusFilter>("ALL");

const [loading, setLoading] =
useState(true);

const [error, setError] =
useState("");

const [pendingId, setPendingId] =
useState<string | null>(null);

const [showCreate, setShowCreate] =
useState(false);

const [creating, setCreating] =
useState(false);

const [createPhoto, setCreatePhoto] =
useState<File | null>(null);

const createPhotoRef =
useRef<HTMLInputElement>(null);

const load = useCallback(async () => {
setLoading(true);
setError("");

```
try {
  const rows =
    await listAdminUsers();

  setUsers(rows);

  const ids = rows.map(
    (user) => user.id,
  );

  if (ids.length > 0) {
    setPhotos(
      await getAdminUserPhotos(ids),
    );
  } else {
    setPhotos({});
  }
} catch (reason) {
  if (
    reason instanceof AuthRequiredError
  ) {
    router.replace("/login");
    return;
  }

  setError(
    reason instanceof Error
      ? reason.message
      : "Unable to load people.",
  );
} finally {
  setLoading(false);
}
```

}, [router]);

useEffect(() => {
void load();
}, [load]);

const filtered = useMemo(() => {
const term = query
.trim()
.toLowerCase();

```
return users.filter((user) => {
  const matchesSearch =
    !term ||
    [
      user.firstName,
      user.lastName,
      user.email,
      user.phone || "",
      userRoleLabel(user),
    ]
      .join(" ")
      .toLowerCase()
      .includes(term);

  const matchesRole =
    roleFilter === "ALL" ||
    user.roles.some(
      (role) =>
        role.name === roleFilter,
    );

  const matchesStatus =
    statusFilter === "ALL" ||
    (statusFilter === "ACTIVE"
      ? user.isActive
      : !user.isActive);

  return (
    matchesSearch &&
    matchesRole &&
    matchesStatus
  );
});
```

}, [
query,
roleFilter,
statusFilter,
users,
]);

const activeCount = users.filter(
(user) => user.isActive,
).length;

const inactiveCount = users.filter(
(user) => !user.isActive,
).length;

const missingPhotos = users.filter(
(user) => !photos[user.id],
).length;

async function toggleUser(
user: AdminUser,
) {
const nextState = !user.isActive;

```
if (
  !window.confirm(
    `${nextState ? "Reactivate" : "Deactivate"} ${user.firstName} ${user.lastName}?`,
  )
) {
  return;
}

setPendingId(user.id);
setError("");

try {
  const updated =
    await setAdminUserActive(
      user.id,
      nextState,
    );

  setUsers((current) =>
    current.map((entry) =>
      entry.id === updated.id
        ? {
            ...entry,
            ...updated,
          }
        : entry,
    ),
  );
} catch (reason) {
  setError(
    reason instanceof Error
      ? reason.message
      : "Unable to change account status.",
  );
} finally {
  setPendingId(null);
}
```

}

async function changePhoto(
user: AdminUser,
event: ChangeEvent<HTMLInputElement>,
) {
const file =
event.target.files?.[0];

```
event.target.value = "";

if (!file) {
  return;
}

setPendingId(user.id);
setError("");

try {
  const response =
    await uploadAdminUserPhoto(
      user.id,
      file,
    );

  setPhotos((current) => ({
    ...current,
    [user.id]: response.url,
  }));
} catch (reason) {
  setError(
    reason instanceof Error
      ? reason.message
      : "Unable to update profile picture.",
  );
} finally {
  setPendingId(null);
}
```

}

async function createPerson(
event: FormEvent<HTMLFormElement>,
) {
event.preventDefault();

```
const form =
  new FormData(event.currentTarget);

setCreating(true);
setError("");

try {
  const role = String(
    form.get("role") || "",
  ).toUpperCase();

  if (
    !CREATION_ROLES.includes(
      role as (typeof CREATION_ROLES)[number],
    )
  ) {
    throw new Error(
      "Select a valid institutional role.",
    );
  }

  const created =
    await createAdminUser({
      firstName: String(
        form.get("firstName") || "",
      ),
      lastName: String(
        form.get("lastName") || "",
      ),
      email: String(
        form.get("email") || "",
      ),
      phone: String(
        form.get("phone") || "",
      ),
      password: String(
        form.get("password") || "",
      ),
      role,
    });

  setUsers((current) => [
    created,
    ...current,
  ]);

  if (createPhoto) {
    try {
      const uploaded =
        await uploadAdminUserPhoto(
          created.id,
          createPhoto,
        );

      setPhotos((current) => ({
        ...current,
        [created.id]:
          uploaded.url,
      }));
    } catch (photoError) {
      setError(
        photoError instanceof Error
          ? `Account created, but the profile picture could not be uploaded: ${photoError.message}`
          : "Account created, but the profile picture could not be uploaded.",
      );
    }
  }

  setShowCreate(false);
  setCreatePhoto(null);

  if (createPhotoRef.current) {
    createPhotoRef.current.value = "";
  }

  event.currentTarget.reset();
} catch (reason) {
  setError(
    reason instanceof Error
      ? reason.message
      : "Unable to create the person.",
  );
} finally {
  setCreating(false);
}
```

}

return (
<DashboardShell
title="People"
subtitle="Institution-scoped people, accounts and profile management"
allowedRoles={[
"INSTITUTION_ADMIN",
]}
> <main className="mx-auto max-w-7xl space-y-6 pb-10"> <section className="overflow-hidden rounded-[28px] bg-slate-950 p-6 text-white shadow-xl shadow-slate-200/40 sm:p-8"> <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"> <div className="max-w-2xl"> <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">
Institution directory </p>

```
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Everyone who belongs here.
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-300">
            Manage institution-scoped accounts,
            keep access status accurate and make
            sure every person has a recognizable
            profile.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                setShowCreate(true)
              }
              className="rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-100"
            >
              + Add person
            </button>

            <button
              type="button"
              onClick={() =>
                router.push("/students")
              }
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Manage students
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SummaryStat
            label="People"
            value={users.length}
          />

          <SummaryStat
            label="Active"
            value={activeCount}
          />

          <SummaryStat
            label="Photos missing"
            value={missingPhotos}
          />
        </div>
      </div>
    </section>

    {error ? (
      <section
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
      >
        {error}
      </section>
    ) : null}

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            ⌕
          </span>

          <input
            value={query}
            onChange={(event) =>
              setQuery(
                event.target.value,
              )
            }
            placeholder="Search name, email, phone or role..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-4 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(event) =>
            setRoleFilter(
              event.target
                .value as RoleFilter,
            )
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400"
        >
          <option value="ALL">
            All roles
          </option>

          <option value="STUDENT">
            Student
          </option>

          {CREATION_ROLES.map(
            (role) => (
              <option
                key={role}
                value={role}
              >
                {roleLabel(role)}
              </option>
            ),
          )}
        </select>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target
                .value as StatusFilter,
            )
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400"
        >
          <option value="ALL">
            All status
          </option>

          <option value="ACTIVE">
            Active
          </option>

          <option value="INACTIVE">
            Inactive
          </option>
        </select>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-400">
        <span>
          Showing{" "}
          <strong className="text-slate-700">
            {filtered.length}
          </strong>{" "}
          of{" "}
          <strong className="text-slate-700">
            {users.length}
          </strong>{" "}
          people
        </span>

        <span>
          {inactiveCount} inactive
        </span>
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {loading ? (
        <div className="space-y-3 p-5">
          {Array.from({
            length: 7,
          }).map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-xl bg-slate-100"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-2xl">
            ♙
          </div>

          <h2 className="mt-4 text-lg font-black text-slate-950">
            No people found
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Try changing the search or filters,
            or add a new institution person.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {filtered.map((user) => (
            <PersonRow
              key={user.id}
              user={user}
              photo={
                photos[user.id] || null
              }
              pending={
                pendingId === user.id
              }
              onToggle={() =>
                void toggleUser(user)
              }
              onPhoto={(event) =>
                void changePhoto(
                  user,
                  event,
                )
              }
            />
          ))}
        </div>
      )}
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-500">
            Student records
          </p>

          <h2 className="mt-1 text-lg font-black text-slate-950">
            Students have their own administration workflow
          </h2>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Student creation includes the student profile
            and academic enrollment. It is intentionally
            separated from generic account creation.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push("/students")
          }
          className="shrink-0 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800"
        >
          Open student administration →
        </button>
      </div>
    </section>

    {showCreate ? (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-5">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-person-title"
          className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-500">
                New institution account
              </p>

              <h2
                id="add-person-title"
                className="mt-1 text-2xl font-black tracking-tight text-slate-950"
              >
                Add a person
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                This creates an institution-scoped
                account. Students use the dedicated
                student administration workflow.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowCreate(false)
              }
              className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <form
            className="mt-7 space-y-6"
            onSubmit={createPerson}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="First name"
                name="firstName"
                required
              />

              <Field
                label="Last name"
                name="lastName"
                required
              />

              <Field
                label="Email"
                name="email"
                type="email"
                required
              />

              <Field
                label="Phone"
                name="phone"
              />

              <Field
                label="Temporary password"
                name="password"
                type="password"
                required
              />

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-600">
                  Institutional role
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </span>

                <select
                  name="role"
                  required
                  defaultValue=""
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                >
                  <option value="" disabled>
                    Select role
                  </option>

                  {CREATION_ROLES.map(
                    (role) => (
                      <option
                        key={role}
                        value={role}
                      >
                        {roleLabel(role)}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-slate-200 text-2xl text-slate-500">
                  {createPhoto
                    ? "✓"
                    : "◍"}
                </div>

                <div className="flex-1">
                  <p className="font-black text-slate-900">
                    Profile picture
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Add a clear photo now. It can also
                    be changed later by an authorized
                    administrator or by the person.
                  </p>
                </div>

                <label className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50">
                  {createPhoto
                    ? "Change photo"
                    : "Choose photo"}

                  <input
                    ref={createPhotoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(event) =>
                      setCreatePhoto(
                        event.target
                          .files?.[0] ||
                          null,
                      )
                    }
                  />
                </label>
              </div>

              {createPhoto ? (
                <p className="mt-3 truncate text-xs font-semibold text-slate-500">
                  Selected:{" "}
                  {createPhoto.name}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() =>
                  setShowCreate(false)
                }
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={creating}
                className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating
                  ? "Creating..."
                  : "Create account"}
              </button>
            </div>
          </form>
        </div>
      </div>
    ) : null}
  </main>
</DashboardShell>
```

);
}

function SummaryStat({
label,
value,
}: {
label: string;
value: number;
}) {
return ( <div className="rounded-2xl border border-white/10 bg-white/5 p-4"> <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
{label} </p>

```
  <p className="mt-2 text-2xl font-black text-white">
    {value.toLocaleString("en-IN")}
  </p>
</div>
```

);
}

function PersonRow({
user,
photo,
pending,
onToggle,
onPhoto,
}: {
user: AdminUser;
photo: string | null;
pending: boolean;
onToggle: () => void;
onPhoto: (
event: ChangeEvent<HTMLInputElement>,
) => void;
}) {
const fileId =
`profile-photo-${user.id}`;

return ( <article className="flex flex-col gap-4 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:p-5"> <div className="relative"> <Avatar
       user={user}
       url={photo}
     />

```
    <label
      htmlFor={fileId}
      title="Change profile picture"
      className="absolute -bottom-1 -right-1 grid h-6 w-6 cursor-pointer place-items-center rounded-lg border-2 border-white bg-indigo-600 text-[10px] font-black text-white shadow-sm hover:bg-indigo-700"
    >
      +
    </label>

    <input
      id={fileId}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      className="hidden"
      onChange={onPhoto}
      disabled={pending}
    />
  </div>

  <div className="min-w-0 flex-1">
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="truncate font-black text-slate-950">
        {user.firstName}{" "}
        {user.lastName}
      </h3>

      <span
        className={[
          "rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em]",
          user.isActive
            ? "bg-emerald-50 text-emerald-700"
            : "bg-slate-100 text-slate-500",
        ].join(" ")}
      >
        {user.isActive
          ? "Active"
          : "Inactive"}
      </span>
    </div>

    <p className="mt-1 truncate text-sm text-slate-500">
      {user.email}
    </p>

    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-400">
      <span>
        {userRoleLabel(user)}
      </span>

      {user.phone ? (
        <span>
          {user.phone}
        </span>
      ) : null}
    </div>
  </div>

  <div className="flex items-center gap-2 sm:shrink-0">
    <button
      type="button"
      disabled={pending}
      onClick={onToggle}
      className={[
        "rounded-xl border px-3 py-2.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50",
        user.isActive
          ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
          : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50",
      ].join(" ")}
    >
      {pending
        ? "Saving..."
        : user.isActive
          ? "Deactivate"
          : "Reactivate"}
    </button>
  </div>
</article>
```

);
}
