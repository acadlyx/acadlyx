"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  DashboardShell,
} from "./DashboardShell";

import {
  AuthRequiredError,
  getCurrentUser,
} from "@/lib/auth";

import {
  approveAdminUserDeletionRequest,
  listAdminUserDeletionRequests,
  rejectAdminUserDeletionRequest,
  UserDeletionRequest,
} from "@/lib/adminApi";

function formatDate(
  value?: string | null,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}

function fullName(
  person:
    | {
        firstName: string;
        lastName: string;
      }
    | null
    | undefined,
): string {
  if (!person) {
    return "Unknown user";
  }

  return (
    `${person.firstName || ""} ${
      person.lastName || ""
    }`.trim() ||
    "Unknown user"
  );
}

function statusClasses(
  status: UserDeletionRequest["status"],
): string {
  switch (status) {
    case "PENDING":
      return "bg-amber-50 text-amber-700 ring-amber-200";

    case "APPROVED":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";

    case "REJECTED":
      return "bg-slate-100 text-slate-600 ring-slate-200";

    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

function statusLabel(
  status: UserDeletionRequest["status"],
): string {
  switch (status) {
    case "PENDING":
      return "Pending";

    case "APPROVED":
      return "Approved";

    case "REJECTED":
      return "Rejected";

    default:
      return status;
  }
}

export default function UserDeletionApprovals() {
  const [
    requests,
    setRequests,
  ] = useState<
    UserDeletionRequest[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    actionError,
    setActionError,
  ] = useState<string | null>(
    null,
  );

  const [
    processingId,
    setProcessingId,
  ] = useState<string | null>(
    null,
  );

  const loadRequests =
    useCallback(
      async (
        showRefreshing = false,
      ) => {
        if (showRefreshing) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        try {
          const user =
            await getCurrentUser();

          if (!user) {
            throw new AuthRequiredError();
          }

          const data =
            await listAdminUserDeletionRequests();

          setRequests(
            Array.isArray(data)
              ? data
              : [],
          );
        } catch (err) {
          if (
            err instanceof
            AuthRequiredError
          ) {
            setError(
              "Your session has expired. Please sign in again.",
            );
          } else if (
            err instanceof Error
          ) {
            setError(
              err.message ||
                "Unable to load deletion requests.",
            );
          } else {
            setError(
              "Unable to load deletion requests.",
            );
          }
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const pendingRequests =
    useMemo(
      () =>
        requests.filter(
          (request) =>
            request.status ===
            "PENDING",
        ),
      [requests],
    );

  const reviewedRequests =
    useMemo(
      () =>
        requests.filter(
          (request) =>
            request.status !==
            "PENDING",
        ),
      [requests],
    );

  const handleApprove =
    useCallback(
      async (
        request: UserDeletionRequest,
      ) => {
        const targetName =
          fullName(
            request.targetUser,
          );

        const confirmed =
          window.confirm(
            `Permanently delete ${targetName}'s account?\n\nThis action cannot be undone.`,
          );

        if (!confirmed) {
          return;
        }

        setProcessingId(
          request.id,
        );

        setActionError(null);

        try {
          await approveAdminUserDeletionRequest(
            request.id,
          );

          await loadRequests(
            true,
          );
        } catch (err) {
          if (
            err instanceof Error
          ) {
            setActionError(
              err.message ||
                "Unable to approve the deletion request.",
            );
          } else {
            setActionError(
              "Unable to approve the deletion request.",
            );
          }
        } finally {
          setProcessingId(null);
        }
      },
      [loadRequests],
    );

  const handleReject =
    useCallback(
      async (
        request: UserDeletionRequest,
      ) => {
        const targetName =
          fullName(
            request.targetUser,
          );

        const confirmed =
          window.confirm(
            `Reject the permanent deletion request for ${targetName}?`,
          );

        if (!confirmed) {
          return;
        }

        setProcessingId(
          request.id,
        );

        setActionError(null);

        try {
          await rejectAdminUserDeletionRequest(
            request.id,
          );

          await loadRequests(
            true,
          );
        } catch (err) {
          if (
            err instanceof Error
          ) {
            setActionError(
              err.message ||
                "Unable to reject the deletion request.",
            );
          } else {
            setActionError(
              "Unable to reject the deletion request.",
            );
          }
        } finally {
          setProcessingId(null);
        }
      },
      [loadRequests],
    );

  return (
    <DashboardShell
      title="User Deletion Approvals"
      subtitle="Review and process permanent account deletion requests."
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Permanent Deletion Requests
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Review requests before permanently
              deleting institution user accounts.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadRequests(
                true,
              )
            }
            disabled={
              loading ||
              refreshing
            }
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-medium">
              Unable to load deletion requests
            </p>

            <p className="mt-1">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadRequests()
              }
              className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Try again
            </button>
          </div>
        )}

        {actionError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {!loading &&
          !error && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">
                    Total Requests
                  </p>

                  <p className="mt-2 text-3xl font-semibold text-slate-900">
                    {requests.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                  <p className="text-sm font-medium text-amber-700">
                    Pending Approval
                  </p>

                  <p className="mt-2 text-3xl font-semibold text-amber-900">
                    {pendingRequests.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-medium text-slate-500">
                    Reviewed
                  </p>

                  <p className="mt-2 text-3xl font-semibold text-slate-900">
                    {reviewedRequests.length}
                  </p>
                </div>
              </div>

              <section className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Pending Requests
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    These requests require review.
                  </p>
                </div>

                {pendingRequests.length ===
                  0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-6 w-6"
                        aria-hidden="true"
                      >
                        <path
                          d="M5 12.5 9.5 17 19 7.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>

                    <h3 className="mt-4 text-base font-semibold text-slate-900">
                      No pending requests
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      There are currently no permanent
                      deletion requests waiting for approval.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingRequests.map(
                      (
                        request,
                      ) => {
                        const processing =
                          processingId ===
                          request.id;

                        return (
                          <article
                            key={
                              request.id
                            }
                            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                          >
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-base font-semibold text-slate-900">
                                    {fullName(
                                      request.targetUser,
                                    )}
                                  </h3>

                                  <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusClasses(
                                      request.status,
                                    )}`}
                                  >
                                    {statusLabel(
                                      request.status,
                                    )}
                                  </span>
                                </div>

                                <p className="mt-1 break-all text-sm text-slate-500">
                                  {
                                    request
                                      .targetUser
                                      .email
                                  }
                                </p>

                                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                      Target Role
                                    </p>

                                    <p className="mt-1 text-sm font-medium text-slate-800">
                                      {
                                        request
                                          .targetUser
                                          .role
                                      }
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                      Requested
                                    </p>

                                    <p className="mt-1 text-sm font-medium text-slate-800">
                                      {formatDate(
                                        request.createdAt,
                                      )}
                                    </p>
                                  </div>

                                  <div className="sm:col-span-2">
                                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                      Requested By
                                    </p>

                                    <p className="mt-1 text-sm font-medium text-slate-800">
                                      {fullName(
                                        request.requester,
                                      )}
                                    </p>

                                    <p className="break-all text-sm text-slate-500">
                                      {
                                        request
                                          .requester
                                          .email
                                      }
                                    </p>
                                  </div>

                                  {request.reason && (
                                    <div className="sm:col-span-2">
                                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                        Reason
                                      </p>

                                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                        {
                                          request.reason
                                        }
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleApprove(
                                      request,
                                    )
                                  }
                                  disabled={
                                    processing ||
                                    !request.canApprove
                                  }
                                  className="inline-flex min-w-[190px] items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {processing
                                    ? "Processing..."
                                    : "Approve Permanent Delete"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleReject(
                                      request,
                                    )
                                  }
                                  disabled={
                                    processing
                                  }
                                  className="inline-flex min-w-[190px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>

                            {!request.canApprove && (
                              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                You can view this request, but
                                your current authority cannot
                                approve it.
                              </div>
                            )}
                          </article>
                        );
                      },
                    )}
                  </div>
                )}
              </section>

              {reviewedRequests.length >
                0 && (
                <section className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Review History
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Previously reviewed permanent deletion
                      requests.
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                              User
                            </th>

                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Role
                            </th>

                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Requested By
                            </th>

                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Status
                            </th>

                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Reviewed
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {reviewedRequests.map(
                            (
                              request,
                            ) => (
                              <tr
                                key={
                                  request.id
                                }
                                className="hover:bg-slate-50"
                              >
                                <td className="px-5 py-4">
                                  <div className="font-medium text-slate-900">
                                    {fullName(
                                      request.targetUser,
                                    )}
                                  </div>

                                  <div className="mt-0.5 text-sm text-slate-500">
                                    {
                                      request
                                        .targetUser
                                        .email
                                    }
                                  </div>
                                </td>

                                <td className="px-5 py-4 text-sm text-slate-600">
                                  {
                                    request
                                      .targetUser
                                      .role
                                  }
                                </td>

                                <td className="px-5 py-4">
                                  <div className="text-sm font-medium text-slate-800">
                                    {fullName(
                                      request.requester,
                                    )}
                                  </div>

                                  <div className="mt-0.5 text-sm text-slate-500">
                                    {
                                      request
                                        .requester
                                        .email
                                    }
                                  </div>
                                </td>

                                <td className="px-5 py-4">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusClasses(
                                      request.status,
                                    )}`}
                                  >
                                    {statusLabel(
                                      request.status,
                                    )}
                                  </span>
                                </td>

                                <td className="px-5 py-4 text-sm text-slate-600">
                                  {formatDate(
                                    request.reviewedAt,
                                  )}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
      </div>
    </DashboardShell>
  );
}
