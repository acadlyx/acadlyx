"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

type WorkspaceShellContextValue = {
  kind: "admin";
};

const WorkspaceShellContext = createContext<WorkspaceShellContextValue | null>(null);

export function WorkspaceShellProvider({
  kind,
  children,
}: {
  kind: "admin";
  children: ReactNode;
}) {
  return (
    <WorkspaceShellContext.Provider value={{ kind }}>
      {children}
    </WorkspaceShellContext.Provider>
  );
}

export function useWorkspaceShellContext() {
  return useContext(WorkspaceShellContext);
}
