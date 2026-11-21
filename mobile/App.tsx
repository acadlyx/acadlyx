import "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./src/auth/AuthProvider";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { SessionQueryCacheBoundary } from "./src/auth/SessionQueryCacheBoundary";
import { setActiveWorkspaceContext } from "./src/api/client";
import { getAuthorizationShape, resetAuthorizationState } from "./src/workspace/workspaceScope.mjs";
import { WorkspaceContextProvider } from "./src/workspace/WorkspaceContextProvider";
import { colors } from "./src/ui/theme";

function SessionCacheBoundary() {
  const { user, status } = useAuth();
  const client = useQueryClient();
  const authorizationShape = getAuthorizationShape(user);
  const [clearedShape, setClearedShape] = useState<string | null>(null);

  // This is a render gate, not just an effect-side cleanup: after a token
  // refresh changes the account, roles or permissions, no screen from the old
  // authorization shape may render while the query cache is being cleared.
  useEffect(() => {
    let active = true;
    setClearedShape(null);
    void (async () => {
      // Reset the module-level query filter together with cached records. A
      // new account or effective grant shape must never see the prior scope.
      await resetAuthorizationState(client, () => setActiveWorkspaceContext(null));
      if (active) setClearedShape(authorizationShape);
    })();
    return () => { active = false; };
  }, [authorizationShape, client]);

  if (status === "authenticated" && user && clearedShape !== authorizationShape) {
    return <AppBootFallback />;
  }

  return <WorkspaceContextProvider><SessionQueryCacheBoundary><RootNavigator /></SessionQueryCacheBoundary></WorkspaceContextProvider>;
}

export default function App() {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10000,
        gcTime: 60000,
        retry: (count, error) => {
          const status = typeof error === "object" && error !== null && "status" in error
            ? Number((error as { status?: number }).status)
            : 0;
          return count < 1 && (status === 0 || status >= 500);
        },
        refetchOnWindowFocus: false
      },
      mutations: { retry: false }
    }
  }));

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <SafeAreaProvider>
          <SessionCacheBoundary />
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export function AppBootFallback() {
  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
    <ActivityIndicator color={colors.primary} size="large" />
  </View>;
}
