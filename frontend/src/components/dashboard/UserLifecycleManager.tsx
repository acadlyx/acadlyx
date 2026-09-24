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
  setPend
```
