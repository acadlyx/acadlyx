"use client";

import { CSSProperties, MouseEvent, ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type ModalLayer = "base" | "nested" | "critical" | "toast";
const Z_INDEX: Record<ModalLayer, number> = { base: 10000, nested: 11000, critical: 12000, toast: 13000 };
const ROOT_ID = "acadlyx-modal-root";

function getRoot() {
  if (typeof document === "undefined") return null;
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("data-acadlyx-modal-root", "true");
    document.body.appendChild(root);
  }
  return root;
}

export function ModalPortal({ children, layer = "base", className = "", onBackdropClick }: { children: ReactNode; layer?: ModalLayer; className?: string; onBackdropClick?: () => void }) {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  useEffect(() => { const target = getRoot(); setRoot(target); return () => { if (target && !target.children.length) target.remove(); }; }, []);
  useEffect(() => { if (!root) return; document.body.dataset.acadlyxModalOpen = "true"; return () => { if (!document.getElementById(ROOT_ID)?.children.length) delete document.body.dataset.acadlyxModalOpen; }; }, [root]);
  if (!root) return null;

  const style: CSSProperties = { position: "fixed", inset: 0, zIndex: Z_INDEX[layer], isolation: "isolate", transform: "none", filter: "none", WebkitFilter: "none", contain: "layout paint" };
  function handleBackdrop(event: MouseEvent<HTMLDivElement>) { if (event.target === event.currentTarget) onBackdropClick?.(); }

  return createPortal(<div className={`fixed inset-0 flex h-[100dvh] w-screen items-start justify-center overflow-y-auto overscroll-contain bg-slate-950/45 p-4 sm:p-6 ${className}`} style={style} onMouseDown={handleBackdrop} data-acadlyx-modal-layer={layer}>{children}</div>, root);
}

export const MODAL_Z_INDEX = Z_INDEX;
