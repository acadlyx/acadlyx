import "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./src/auth/AuthProvider";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { WorkspaceContextProvider } from "./src/workspace/WorkspaceContextProvider";
import { colors } from "./src/ui/theme";

function SessionCacheBoundary() {
  const { user } = useAuth();
  const client = useQueryClient();
  const authorizationShape = (user?.roles || []).slice().sort().join(",") + ":" + (user?.permissions || []).slice().sort().join(",");
  // A refreshed session may change a user's role or grants without changing
  // their account id. Clear old records before rendering the new authority.
  useEffect(() => { client.clear(); }, [authorizationShape, client, user?.id]);
  return <WorkspaceContextProvider><RootNavigator /></WorkspaceContextProvider>;
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
