"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

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
  phone: string | null;
  institution: {
    name: string;
    logoUrl: string | null;
  } | null;
  lastLoginAt: string | null;
};

const INPUT =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 caret-slate-900 outline-none placeholder:text-slate-400 transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50";

const LABEL =
  "mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500";

function initials(
  account: Account | null,
) {
  if (!account) {
    return "…";
  }

  return (
    `${account.firstName?.charAt(0) || ""}${
      account.lastName?.charAt(0) || ""
    }`.toUpperCase() ||
    "U"
  );
}

function Avatar({
  account,
  url,
  size = "md",
}: {
  account: Account | null;
  url: string | null;
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
      {initials(account)}
    </span>
  );
}

function fileToDataUrl(
  file: File,
): Promise<string> {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const reader =
        new FileReader();

      reader.onload =
        () =>
          typeof reader.result ===
          "string"
            ? resolve(
                reader.result,
              )
            : reject(
                new Error(
                  "Unable to read the selected image.",
                ),
              );

      reader.onerror =
        () =>
          reject(
            new Error(
              "Unable to read the selected image.",
            ),
          );

      reader.readAsDataURL(
        file,
      );
    },
  );
}

export function AccountMenu() {
  const router =
    useRouter();

  const menuRef =
    useRef<HTMLDivElement>(
      null,
    );

  const photoInputRef =
    useRef<HTMLInputElement>(
      null,
    );

  const [
    account,
    setAccount,
  ] =
    useState<Account | null>(
      null,
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
  ] = useState(false);

  const [
    editing,
    setEditing,
  ] = useState(false);

  const [
    password,
    setPassword,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    photoBusy,
    setPhotoBusy,
  ] = useState(false);

  const [
    busy,
    setBusy,
  ] = useState(false);

  useEffect(
    () => {
      if (account) {
        return;
      }

      let active = true;

      Promise.all([
        authedFetch<{
          success: true;
          data: Account;
        }>(
          "/auth/account",
        ),

        authedFetch<{
          success: true;
          data: {
            userId: string;
            url: string | null;
          };
        }>(
          "/auth/account/photo",
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
              accountResponse.data,
            );

            setPhotoUrl(
              photoResponse.data
                .url,
            );
          },
        )
        .catch(
          (error) => {
            if (
              error instanceof
              AuthRequiredError
            ) {
              router.replace(
                "/login",
              );
            } else if (
              active
            ) {
              setMessage(
                error instanceof
                  Error
                  ? error.message
                  : "Unable to load account.",
              );
            }
          },
        );

      return () => {
        active = false;
      };
    },
    [account, router],
  );

  useEffect(
    () => {
      function handleOutsideClick(
        event: MouseEvent,
      ) {
        if (
          !menuRef.current?.contains(
            event.target as Node,
          )
        ) {
          setOpen(false);
        }
      }

      if (open) {
        document.addEventListener(
          "mousedown",
          handleOutsideClick,
        );
      }

      return () =>
        document.removeEventListener(
          "mousedown",
          handleOutsideClick,
        );
    },
    [open],
  );

  async function saveProfile(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form =
      new FormData(
        event.currentTarget,
      );

    setBusy(true);
    setMessage("");

    try {
      const response =
        await authedFetch<{
          success: true;
          data: Account;
        }>(
          "/auth/account",
          {
            method: "PATCH",
            body:
              JSON.stringify({
                firstName:
                  form.get(
                    "firstName",
                  ),

                lastName:
                  form.get(
                    "lastName",
                  ),

                phone:
                  form.get(
                    "phone",
                  ) || null,
              }),
          },
        );

      setAccount(
        response.data,
      );

      setEditing(false);

      setMessage(
        "Profile details saved successfully.",
      );
    } catch (
      error
    ) {
      setMessage(
        error instanceof
          Error
          ? error.message
          : "Unable to save profile.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function changePhoto(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith(
        "image/",
      )
    ) {
      setMessage(
        "Please select an image file.",
      );

      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      setMessage(
        "Profile pictures must be 5 MB or smaller.",
      );

      return;
    }

    setPhotoBusy(true);
    setMessage("");

    try {
      const response =
        await uploadMyProfilePhoto(
          await fileToDataUrl(
            file,
          ),
        );

      setPhotoUrl(
        response.url,
      );

      setMessage(
        "Profile picture updated successfully.",
      );
    } catch (
      error
    ) {
      setMessage(
        error instanceof
          Error
          ? error.message
          : "Unable to update profile picture.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  async function savePassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const form =
      new FormData(
        event.currentTarget,
      );

    const currentPassword =
      String(
        form.get(
          "currentPassword",
        ) || "",
      );

    const newPassword =
      String(
        form.get(
          "newPassword",
        ) || "",
      );

    const confirmPassword =
      String(
        form.get(
          "confirmPassword",
        ) || "",
      );

    if (
      newPassword.length <
      10
    ) {
      setMessage(
        "New password must contain at least 10 characters.",
      );

      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setMessage(
        "New passwords do not match.",
      );

      return;
    }

    setBusy(true);
    setMessage("");

    try {
      await authedFetch(
        "/auth/change-password",
        {
          method: "POST",
          body:
            JSON.stringify({
              currentPassword,
              newPassword,
            }),
        },
      );

      clearTokens();

      router.replace(
        "/login",
      );
    } catch (
      error
    ) {
      setMessage(
        error instanceof
          Error
          ? error.message
          : "Unable to change password.",
      );

      setBusy(false);
    }
  }

  return (
    <div
      ref={menuRef}
      className="relative text-slate-900 [color-scheme:light]"
    >
      <button
        type="button"
        onClick={() => {
          setOpen(
            (value) =>
              !value,
          );

          setMessage("");

          setEditing(false);

          setPassword(false);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
      >
        <Avatar
          account={account}
          url={photoUrl}
          size="sm"
        />

        <span className="hidden max-w-28 truncate text-xs font-bold text-slate-700 sm:block">
          {account?.firstName ||
            "Account"}
        </span>

        <span className="text-slate-400">
          ⌄
        </span>
      </button>

      {open &&
        !account && (
          <div className="absolute right-0 top-[calc(100%+10px)] z-[70] w-72 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600 shadow-xl">
            Loading account
            details…
          </div>
        )}

      {open &&
        account && (
          <div className="absolute right-0 top-[calc(100%+10px)] z-[70] w-[min(94vw,460px)] overflow-hidden rounded-[26px] border border-slate-200 bg-white text-slate-900 shadow-2xl">
            <div className="bg-slate-950 p-5 text-white">
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
                  <p className="truncate text-base font-black">
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
                    {account
                      .institution
                      ?.name ||
                      "ACADLYX Platform"}
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

            <div className="p-5">
              {message && (
                <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-800">
                  {message}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(
                      true,
                    );

                    setPassword(
                      false,
                    );

                    setMessage(
                      "",
                    );
                  }}
                  className={`rounded-xl px-3 py-3 text-sm font-black transition ${
                    editing
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-700 hover:bg-white"
                  }`}
                >
                  Profile details
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPassword(
                      true,
                    );

                    setEditing(
                      false,
                    );

                    setMessage(
                      "",
                    );
                  }}
                  className={`rounded-xl px-3 py-3 text-sm font-black transition ${
                    password
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-700 hover:bg-white"
                  }`}
                >
                  Password
                </button>
              </div>

              {!editing &&
                !password && (
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p
                        className={
                          LABEL
                        }
                      >
                        Email
                      </p>

                      <p className="break-all text-sm font-bold text-slate-900">
                        {
                          account.email
                        }
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p
                        className={
                          LABEL
                        }
                      >
                        Phone
                      </p>

                      <p className="text-sm font-bold text-slate-900">
                        {account
                          .phone ||
                          "Not provided"}
                      </p>
                    </div>
                  </div>
                )}

              {editing && (
                <form
                  onSubmit={
                    saveProfile
                  }
                  className="mt-5 grid gap-4"
                >
                  <label>
                    <span
                      className={
                        LABEL
                      }
                    >
                      First name
                    </span>

                    <input
                      name="firstName"
                      defaultValue={
                        account.firstName
                      }
                      required
                      className={
                        INPUT
                      }
                    />
                  </label>

                  <label>
                    <span
                      className={
                        LABEL
                      }
                    >
                      Last name
                    </span>

                    <input
                      name="lastName"
                      defaultValue={
                        account.lastName
                      }
                      required
                      className={
                        INPUT
                      }
                    />
                  </label>

                  <label>
                    <span
                      className={
                        LABEL
                      }
                    >
                      Phone
                    </span>

                    <input
                      name="phone"
                      defaultValue={
                        account.phone ||
                        ""
                      }
                      className={
                        INPUT
                      }
                    />
                  </label>

                  <div className="flex justify-end">
                    <button
                      disabled={
                        busy
                      }
                      className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {busy
                        ? "Saving…"
                        : "Save profile"}
                    </button>
                  </div>
                </form>
              )}

              {password && (
                <form
                  onSubmit={
                    savePassword
                  }
                  className="mt-5 grid gap-4"
                >
                  <label>
                    <span
                      className={
                        LABEL
                      }
                    >
                      Current password
                    </span>

                    <input
                      name="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      required
                      className={
                        INPUT
                      }
                    />
                  </label>

                  <label>
                    <span
                      className={
                        LABEL
                      }
                    >
                      New password
                    </span>

                    <input
                      name="newPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={10}
                      required
                      placeholder="At least 10 characters"
                      className={
                        INPUT
                      }
                    />
                  </label>

                  <label>
                    <span
                      className={
                        LABEL
                      }
                    >
                      Confirm new password
                    </span>

                    <input
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={10}
                      required
                      className={
                        INPUT
                      }
                    />
                  </label>

                  <p className="text-xs leading-5 text-slate-500">
                    Changing your
                    password signs you
                    out so the new
                    credentials can be
                    established cleanly.
                  </p>

                  <div className="flex justify-end">
                    <button
                      disabled={
                        busy
                      }
                      className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-blue-600 disabled:opacity-50"
                    >
                      {busy
                        ? "Changing…"
                        : "Change password"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
