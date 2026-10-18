import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest, AuthTokens, clearTokens, getAccessToken, getRefreshToken, storeTokens } from "../api/client";

export type AuthUser = {
  id: string;
  email?: string;
  idNumber?: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  permissions: string[];
  tenantFeatures?: string[];
  [key: string]: unknown;
};
export type SignInResult =
  | { mfaRequired: true; challengeToken: string; expiresAt?: string }
  | { mfaRequired: false; user: AuthUser };

type LoginPayload = { mfaRequired?: boolean; challengeToken?: string; expiresAt?: string; user?: AuthUser; tokens?: AuthTokens };
type AuthStatus = "restoring" | "authenticated" | "unauthenticated";
type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  signIn: (identifier: string, password: string) => Promise<SignInResult>;
  verifyMfa: (challengeToken: string, code: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeUser(value: AuthUser): AuthUser {
  if (!value || typeof value.id !== "string") throw new Error("The authentication service returned an invalid user profile.");
  return {
    ...value,
    roles: Array.isArray(value.roles) ? value.roles : [],
    permissions: Array.isArray(value.permissions) ? value.permissions : []
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("restoring");

  const acceptSession = useCallback(async (payload: LoginPayload): Promise<AuthUser> => {
    if (!payload.tokens || !payload.user) throw new Error("ACADLYX did not return a complete authenticated session.");
    await storeTokens(payload.tokens);
    const currentUser = normalizeUser(payload.user);
    setUser(currentUser);
    setStatus("authenticated");
    return currentUser;
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const currentUser = await apiRequest<AuthUser>("/auth/me");
    setUser(normalizeUser(currentUser));
    setStatus("authenticated");
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const [access, refresh] = await Promise.all([getAccessToken(), getRefreshToken()]);
      if (!access && !refresh) {
        if (active) setStatus("unauthenticated");
        return;
      }
      try {
        const currentUser = await apiRequest<AuthUser>("/auth/me");
        if (active) { setUser(normalizeUser(currentUser)); setStatus("authenticated"); }
      } catch {
        await clearTokens();
        if (active) { setUser(null); setStatus("unauthenticated"); }
      }
    })();
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async (identifier: string, password: string): Promise<SignInResult> => {
    const payload = await apiRequest<LoginPayload>("/auth/login", {
      method: "POST", auth: false,
      body: JSON.stringify({ identifier: identifier.trim(), password })
    });
    if (payload.mfaRequired) {
      if (!payload.challengeToken) throw new Error("The MFA challenge response was incomplete.");
      return { mfaRequired: true, challengeToken: payload.challengeToken, expiresAt: payload.expiresAt };
    }
    const currentUser = await acceptSession(payload);
    return { mfaRequired: false, user: currentUser };
  }, [acceptSession]);

  const verifyMfa = useCallback(async (challengeToken: string, code: string): Promise<AuthUser> => {
    const payload = await apiRequest<LoginPayload>("/auth/mfa/verify", {
      method: "POST", auth: false,
      body: JSON.stringify({ challengeToken, code: code.trim() })
    });
    return acceptSession(payload);
  }, [acceptSession]);

  const signOut = useCallback(async () => {
    const refreshToken = await getRefreshToken();
    try {
      if (refreshToken) {
        await apiRequest("/auth/logout", {
          method: "POST", auth: false,
          body: JSON.stringify({ refreshToken }),
          retryOnUnauthorized: false
        });
      }
    } catch {
      // Local sign-out must complete even if the backend cannot be reached.
    } finally {
      await clearTokens();
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await apiRequest("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword })
    });
    await signOut();
  }, [signOut]);

  const value = useMemo<AuthContextValue>(() => ({
    user, status, signIn, verifyMfa, signOut, changePassword, refreshCurrentUser
  }), [user, status, signIn, verifyMfa, signOut, changePassword, refreshCurrentUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}