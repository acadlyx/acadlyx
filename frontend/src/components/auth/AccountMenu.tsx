"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  authedFetch,
  AuthRequiredError,
  clearTokens,
} from "@/lib/auth";
import { useRouter } from "next/navigation";

type Account = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  institution: {
    name: string;
    logoUrl: string | null;
  } | null;
  lastLoginAt: string | null;
};

export function AccountMenu() {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  const [account, setAccount] =
    useState<Account | null>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    authedFetch<{ success: true; data: Account }>(
      "/auth/account"
    )
      .then((response) =>
        setAccount(response.data)
      )
      .catch((error) => {
        if (!(error instanceof AuthRequiredError)) {
          setAccount(null);
        }
      });
  }, []);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        !menuRef.current?.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener(
        "mousedown",
        handleOutsideClick
      );
    }

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, [open]);

  if (!account) return null;

  async function saveProfile(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    try {
      const response = await authedFetch<{
        success: true;
        data: Account;
      }>("/auth/account", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          phone: form.get("phone") || null,
        }),
      });

      setAccount((current) =>
        current
          ? { ...current, ...response.data }
          : response.data
      );

      setEditing(false);
      setMessage("Profile saved successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save profile."
      );
    }
  }

  async function savePassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const newPassword = String(
      form.get("newPassword") || ""
    );

    const confirmPassword = String(
      form.get("confirmPassword") || ""
    );

    if (newPassword !== confirmPassword) {
      setMessage("New passwords do not match.");
      return;
    }

    try {
      await authedFetch(
        "/auth/change-password",
        {
          method: "POST",
          body: JSON.stringify({
            currentPassword:
              form.get("currentPassword"),
            newPassword,
          }),
        }
      );

      clearTokens();
      router.replace("/login");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to change password."
      );
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          setMessage("");
          setEditing(false);
          setPassword(false);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-violet-500 text-[11px] font-black text-white">
          {account.firstName
            .charAt(0)
            .toUpperCase()}
          {account.lastName
            .charAt(0)
            .toUpperCase()}
        </span>

        <span className="hidden max-w-28 truncate text-xs font-bold text-slate-700 sm:block">
          {account.firstName}
        </span>

        <span className="text-slate-400">⌄</span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-[70] w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/15">
          <div className="border-b border-slate-100 bg-gradient-to-br from-sky-50 to-violet-50 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-violet-500 text-sm font-black text-white">
                {account.firstName
                  .charAt(0)
                  .toUpperCase()}
                {account.lastName
                  .charAt(0)
                  .toUpperCase()}
              </span>

              <div className="min-w-0">
                <p className="truncate font-bold text-slate-950">
                  {account.firstName}{" "}
                  {account.lastName}
                </p>

                <p className="truncate text-xs text-slate-500">
                  {account.email}
                </p>

                <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {account.institution?.name ||
                    "ACADLYX Platform"}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4">
            {message && (
              <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-700">
                {message}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing((value) => !value);
                  setPassword(false);
                  setMessage("");
                }}
                className={`rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  editing
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Profile details
              </button>

              <button
                type="button"
                onClick={() => {
                  setPassword((value) => !value);
                  setEditing(false);
                  setMessage("");
                }}
                className={`rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  password
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Password
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
              Last sign-in:{" "}
              {account.lastLoginAt
                ? new Date(
                    account.lastLoginAt
                  ).toLocaleString()
                : "Not available"}
            </div>

            {editing && (
              <form
                onSubmit={saveProfile}
                className="mt-4 grid gap-3"
              >
                <input
                  name="firstName"
                  defaultValue={
                    account.firstName
                  }
                  required
                  placeholder="First name"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />

                <input
                  name="lastName"
                  defaultValue={
                    account.lastName
                  }
                  required
                  placeholder="Last name"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />

                <input
                  name="phone"
                  defaultValue={
                    account.phone || ""
                  }
                  placeholder="Phone"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />

                <button className="rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm">
                  Save profile
                </button>
              </form>
            )}

            {password && (
              <form
                onSubmit={savePassword}
                className="mt-4 grid gap-3"
              >
                <input
                  name="currentPassword"
                  type="password"
                  required
                  placeholder="Current password"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />

                <input
                  name="newPassword"
                  type="password"
                  minLength={10}
                  required
                  placeholder="New password (10+ characters)"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />

                <input
                  name="confirmPassword"
                  type="password"
                  minLength={10}
                  required
                  placeholder="Confirm new password"
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />

                <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">
                  Change password
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
