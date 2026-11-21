import React, { PropsWithChildren, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";

/**
 * Query keys partition records by identity and workspace, but old asynchronous
 * requests must also be cancelled during account/role/workspace switches.
 * Clearing the shared client prevents private data from the prior context being
 * observed through any query whose key does not yet include every scope field.
 */
export function SessionQueryCacheBoundary({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { context } = useWorkspaceContext();
  const identity = useMemo(() => JSON.stringify({
    id: user?.id ?? null,
    institutionId: user?.institutionId ?? null,
    roles: [...(user?.roles ?? [])].sort(),
    permissions: [...(user?.permissions ?? [])].sort(),
    workspace: context?.scope ?? null,
  }), [user?.id, user?.institutionId, user?.roles, user?.permissions, context?.scope]);
  const previousIdentity = useRef(identity);

  useEffect(() => {
    if (previousIdentity.current !== identity) {
      previousIdentity.current = identity;
      void queryClient.cancelQueries();
      queryClient.clear();
    }
  }, [identity, queryClient]);

  return <>{children}</>;
}
