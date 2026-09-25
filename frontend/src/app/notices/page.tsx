"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/DashboardShell";

import {
  AuthRequiredError,
  getCurrentUser,
} from "@/lib/auth";

import {
  createNotice,
  getErpWorkspace,
  listDepartments,
} from "@/lib/erpApi";

export default function NoticesPage() {
  const router =
    useRouter();

  const [
    noticeCount,
    setNoticeCount,
  ] = useState(0);

  const [
    departments,
    setDepartments,
  ] = useState<
    Array<{
      id: string;
      name: string;
    }>
  >([]);

  const [
    canManage,
    setCanManage,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    form,
    setForm,
  ] = useState({
    title:
      "",
    body:
      "",
    audience:
      "ALL",
    departmentId:
      "",
    expiresAt:
      "",
  });

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const user =
            await getCurrentUser();

          if (
            !user.roles.includes(
              "INSTITUTION_ADMIN",
            )
          ) {
            router.replace(
              "/login",
            );

            return;
          }

          setCanManage(
            user.permissions.includes(
              "notices.manage",
            ),
          );

          const [
            workspace,
            departmentList,
          ] =
            await Promise.all([
              getErpWorkspace(),
              listDepartments(),
            ]);

          setNoticeCount(
            workspace.stats
              ?.notices ??
              0,
          );

          setDepartments(
            departmentList,
          );
        } catch (
          reason
        ) {
          if (
            reason instanceof
            AuthRequiredError
          ) {
            router.replace(
              "/login",
            );

            return;
          }

          setError(
            reason instanceof
              Error
              ? reason.message
              : "Unable to load notices.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [router],
    );

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (
      !form.title.trim() ||
      !form.body.trim()
    ) {
      setError(
        "Title and message are required.",
      );

      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await createNotice(
        {
          title:
            form.title.trim(),
          body:
            form.body.trim(),
          audience:
            form.audience,
          departmentId:
            form.departmentId ||
            undefined,
          expiresAt:
            form.expiresAt ||
            undefined,
        },
      );

      setForm({
        title:
          "",
        body:
          "",
        audience:
          "ALL",
        departmentId:
          "",
        expiresAt:
          "",
      });

      setSuccess(
        "Notice published successfully.",
      );

      await load();
    } catch (
      reason
    ) {
      setError(
        reason instanceof
          Error
          ? reason.message
          : "Unable to publish notice.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  return (
    <DashboardShell
      title="Notices"
      subtitle="Institution-wide communications"
      allowedRoles={[
        "INSTITUTION_ADMIN",
      ]}
    >
      <main className="mx-auto max-w-[1100px] space-y-5 pb-10">
        <section className="rounded-[26px] border border-[#dfe7ee] bg-white p-5 shadow-[0_8px_28px_rgba(20,32,50,0.04)] sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2864e8]">
                Institution communications
              </p>

              <h1 className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#172033]">
                Notices
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#718298]">
                Publish operational and
                academic notices within the
                institution scope.
              </p>
            </div>

            <div className="rounded-[18px] bg-[#f4f7fa] px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#92a1b4]">
                Published notices
              </p>

              <p className="mt-1 text-2xl font-black text-[#172033]">
                {loading
                  ? "—"
                  : noticeCount}
              </p>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}

        <section className="rounded-[26px] border border-[#dfe7ee] bg-white p-5 shadow-[0_8px_28px_rgba(20,32,50,0.04)] sm:p-7">
          <div className="mb-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#92a1b4]">
              Publisher
            </p>

            <h2 className="mt-1 text-lg font-black text-[#243149]">
              Create institution notice
            </h2>
          </div>

          {!canManage ? (
            <div className="rounded-[18px] border border-[#dfe7ee] bg-[#f7f9fb] p-5 text-sm leading-6 text-[#718298]">
              This account can view notices
              but does not have notice
              publishing authority.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#7b8b9e]">
                    Title
                  </span>

                  <input
                    value={
                      form.title
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          title:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    placeholder="Notice title"
                    className="w-full rounded-[13px] border border-[#d9e2ea] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2864e8]"
                  />
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#7b8b9e]">
                    Audience
                  </span>

                  <select
                    value={
                      form.audience
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          audience:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    className="w-full rounded-[13px] border border-[#d9e2ea] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2864e8]"
                  >
                    <option value="ALL">
                      Everyone
                    </option>

                    <option value="STUDENTS">
                      Students
                    </option>

                    <option value="FACULTY">
                      Faculty
                    </option>

                    <option value="STAFF">
                      Staff
                    </option>
                  </select>
                </label>
              </div>

              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#7b8b9e]">
                  Message
                </span>

                <textarea
                  value={
                    form.body
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm(
                      (
                        current,
                      ) => ({
                        ...current,
                        body:
                          event
                            .target
                            .value,
                      }),
                    )
                  }
                  rows={7}
                  placeholder="Write the notice…"
                  className="w-full resize-y rounded-[13px] border border-[#d9e2ea] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2864e8]"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#7b8b9e]">
                    Department
                  </span>

                  <select
                    value={
                      form.departmentId
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          departmentId:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    className="w-full rounded-[13px] border border-[#d9e2ea] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2864e8]"
                  >
                    <option value="">
                      All departments
                    </option>

                    {departments.map(
                      (
                        department,
                      ) => (
                        <option
                          key={
                            department.id
                          }
                          value={
                            department.id
                          }
                        >
                          {
                            department.name
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#7b8b9e]">
                    Expiry
                  </span>

                  <input
                    type="datetime-local"
                    value={
                      form.expiresAt
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          expiresAt:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    className="w-full rounded-[13px] border border-[#d9e2ea] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2864e8]"
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={
                    saving
                  }
                  onClick={() =>
                    void save()
                  }
                  className="rounded-[13px] bg-[#2864e8] px-5 py-2.5 text-sm font-extrabold text-white shadow-[0_7px_16px_rgba(40,100,232,0.18)] transition hover:bg-[#1f57d0] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Publishing…"
                    : "Publish notice"}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </DashboardShell>
  );
}
