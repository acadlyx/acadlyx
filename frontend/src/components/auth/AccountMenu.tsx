"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  authedFetch,
  AuthRequiredError,
  clearTokens,
} from "@/lib/auth";

import {
  uploadMyProfilePhoto,
} from "@/lib/adminApi";

type Account = {
  id: string;

  email: string;

  firstName: string;

  lastName: string;

  phone:
    | string
    | null;

  institution: {
    name: string;
    logoUrl:
      | string
      | null;
  } | null;

  lastLoginAt:
    | string
    | null;
};

function initials(
  account: Account | null
) {
  if (!account) {
    return "…";
  }

  return `${account.firstName.charAt(
    0
  )}${account.lastName.charAt(
    0
  )}`.toUpperCase();
}

function Avatar({
  account,
  url,
  size = "md",
}: {
  account: Account | null;
  url:
    | string
    | null;
  size?:
    | "sm"
    | "md"
    | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "h-16 w-16 text-lg"
      : size === "sm"
        ? "h-9 w-9 text-xs"
        : "h-11 w-11 text-sm";

  if (url) {
    return (
      <img
        src={url}
        alt={`${account?.firstName || "User"} ${
          account?.lastName || ""
        }`.trim()}
        className={`${sizeClass} rounded-2xl object-cover ring-2 ring-white shadow-sm`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} grid place-items-center rounded-2xl bg-slate-950 font-black text-white shadow-sm`}
    >
      {initials(
        account
      )}
    </span>
  );
}

export function AccountMenu() {
  const router =
    useRouter();

  const menuRef =
    useRef<HTMLDivElement>(
      null
    );

  const photoInputRef =
    useRef<HTMLInputElement>(
      null
    );

  const [
    account,
    setAccount,
  ] =
    useState<Account | null>(
      null
    );

  const [
    photoUrl,
    setPhotoUrl,
  ] =
    useState<
      string | null
    >(null);

  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    editing,
    setEditing,
  ] =
    useState(false);

  const [
    password,
    setPassword,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    photoBusy,
    setPhotoBusy,
  ] =
    useState(false);

  useEffect(() => {
    if (account) {
      return;
    }

    let active =
      true;

    Promise.all([
      authedFetch<{
        success: true;
        data: Account;
      }>(
        "/auth/account"
      ),

      authedFetch<{
        success: true;
        data: {
          userId: string;
          url:
            | string
            | null;
        };
      }>(
        "/auth/account/photo"
      ),
    ])
      .then(
        ([
          accountResponse,
          photoResponse,
        ]) => {
          if (!active) {
            return;
          }

          setAccount(
            accountResponse.data
          );

          setPhotoUrl(
            photoResponse.data.url
          );
        }
      )
      .catch(
        (error) => {
          if (
            error instanceof
            AuthRequiredError
          ) {
            router.replace(
              "/login"
            );
          }
        }
      );

    return () => {
      active = false;
    };
  }, [
    account,
    router,
  ]);

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent
    ) {
      if (
        !menuRef.current?.contains(
          event.target as Node
        )
      ) {
        setOpen(
          false
        );
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

  async function saveProfile(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const form =
      new FormData(
        event.currentTarget
      );

    try {
      const response =
        await authedFetch<{
          success: true;
          data: Account;
        }>(
          "/auth/account",
          {
            method:
              "PATCH",

            body:
              JSON.stringify({
                firstName:
                  form.get(
                    "firstName"
                  ),

                lastName:
                  form.get(
                    "lastName"
                  ),

                phone:
                  form.get(
                    "phone"
                  ) ||
                  null,
              }),
          }
        );

      setAccount(
        response.data
      );

      setEditing(
        false
      );

      setMessage(
        "Profile details saved."
      );
    } catch (
      error
    ) {
      setMessage(
        error instanceof
          Error
          ? error.message
          : "Unable to save profile."
      );
    }
  }

  async function changePhoto(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    event.target.value =
      "";

    if (!file) {
      return;
    }

    setPhotoBusy(
      true
    );

    setMessage("");

    try {
      const response =
        await uploadMyProfilePhoto(
          file
        );

      setPhotoUrl(
        response.url
      );

      setMessage(
        "Profile picture updated."
      );
    } catch (
      error
    ) {
      setMessage(
        error instanceof
          Error
          ? error.message
          : "Unable to update profile picture."
      );
    } finally {
      setPhotoBusy(
        false
      );
    }
  }

  async function savePassword(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const form =
      new FormData(
        event.currentTarget
      );

    const newPassword =
      String(
        form.get(
          "newPassword"
        ) || ""
      );

    const confirmPassword =
      String(
        form.get(
          "confirmPassword"
        ) || ""
      );

    if (
      newPassword !==
      confirmPassword
    ) {
      setMessage(
        "New passwords do not match."
      );

      return;
    }

    try {
      await authedFetch(
        "/auth/change-password",
        {
          method:
            "POST",

          body:
            JSON.stringify({
              currentPassword:
                form.get(
                  "currentPassword"
                ),

              newPassword,
            }),
        }
      );

      clearTokens();

      router.replace(
        "/login"
      );
    } catch (
      error
    ) {
      setMessage(
        error instanceof
          Error
          ? error.message
          : "Unable to change password."
      );
    }
  }

  return (
    <div
      ref={menuRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() => {
          setOpen(
            (
              value
            ) =>
              !value
          );

          setMessage(
            ""
          );

          setEditing(
            false
          );

          setPassword(
            false
          );
        }}
        aria-expanded={
          open
        }
        aria-haspopup="dialog"
        className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
      >
        <Avatar
          account={
            account
          }
          url={
            photoUrl
          }
          size="sm"
        />

        <span className="hidden max-w-28 truncate text-xs font-bold text-slate-700 sm:block">
          {
            account?.firstName ||
            "Account"
          }
        </span>

        <span className="text-slate-400">
          ⌄
        </span>
      </button>

      {open &&
        !account && (
          <div className="absolute right-0 top-[calc(100%+10px)] z-[70] w-64 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-xl">
            Loading account
            details…
          </div>
        )}

      {open &&
        account && (
          <div className="absolute right-0 top-[calc(100%+10px)] z-[70] w-[min(92vw,410px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-100 bg-slate-950 p-5 text-white">
              <div className="flex items-center gap-3">
                <Avatar
                  account={
                    account
                  }
                  url={
                    photoUrl
                  }
                  size="lg"
                />

                <div className="min-w-0">
                  <p className="truncate font-black">
                    {
                      account.firstName
                    }{" "}
                    {
                      account.lastName
                    }
                  </p>

                  <p className="truncate text-xs text-slate-300">
                    {
                      account.email
                    }
                  </p>

                  <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {
                      account
                        .institution
                        ?.name ||
                      "ACADLYX Platform"
                    }
                  </p>
                </div>
              </div>

              <input
                ref={
                  photoInputRef
                }
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={
                  changePhoto
                }
              />

              <button
                type="button"
                disabled={
                  photoBusy
                }
                onClick={() =>
                  photoInputRef.current?.click()
                }
                className="mt-4 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold text-white hover:bg-white/15 disabled:opacity-50"
              >
                {photoBusy
                  ? "Uploading…"
                  : "Change profile picture"}
              </button>
            </div>

            <div className="p-4">
              {message && (
                <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
                  {
                    message
                  }
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(
                      (
                        value
                      ) =>
                        !value
                    );

                    setPassword(
                      false
                    );

                    setMessage(
                      ""
                    );
                  }}
                  className={`rounded-xl px-3 py-2.5 text-xs font-bold ${
                    editing
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  Profile details
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPassword(
                      (
                        value
                      ) =>
                        !value
                    );

                    setEditing(
                      false
                    );

                    setMessage(
                      ""
                    );
                  }}
                  className={`rounded-xl px-3 py-2.5 text-xs font-bold ${
                    password
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  Password
                </button>
              </div>

              {editing && (
                <form
                  onSubmit={
                    saveProfile
                  }
                  className="mt-4 grid gap-3"
                >
                  <input
                    name="firstName"
                    defaultValue={
                      account.firstName
                    }
                    required
                    placeholder="First name"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />

                  <input
                    name="lastName"
                    defaultValue={
                      account.lastName
                    }
                    required
                    placeholder="Last name"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />

                  <input
                    name="phone"
                    defaultValue={
                      account.phone ||
                      ""
                    }
                    placeholder="Phone"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />

                  <button className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white">
                    Save profile
                  </button>
                </form>
              )}

              {password && (
                <form
                  onSubmit={
                    savePassword
                  }
                  className="mt-4 grid gap-3"
                >
                  <input
                    name="currentPassword"
                    type="password"
                    required
                    placeholder="Current password"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />

                  <input
                    name="newPassword"
                    type="password"
                    minLength={
                      10
                    }
                    required
                    placeholder="New password (10+ characters)"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />

                  <input
                    name="confirmPassword"
                    type="password"
                    minLength={
                      10
                    }
                    required
                    placeholder="Confirm new password"
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
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
