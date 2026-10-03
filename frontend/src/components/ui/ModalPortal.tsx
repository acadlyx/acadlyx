"use client";

import {
  CSSProperties,
  MouseEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type ModalLayer = "base" | "nested" | "critical" | "toast";

const ROOT_ID = "acadlyx-modal-root";
const BASE_Z = 1000;
const STEP_Z = 10;

type StackEntry = {
  id: number;
  layer: ModalLayer;
};

let nextId = 1;
const stack: StackEntry[] = [];

function getRoot() {
  if (typeof document === "undefined") return null;

  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("data-acadlyx-modal-root", "true");
    root.style.position = "relative";
    root.style.zIndex = "0";
    document.body.appendChild(root);
  }

  return root;
}

function zIndexFor(index: number, layer: ModalLayer) {
  const layerOffset =
    layer === "critical" ? 5 : layer === "toast" ? 6 : 0;

  return BASE_Z + index * STEP_Z + layerOffset;
}

function getTopId() {
  return stack.length ? stack[stack.length - 1].id : null;
}

function lockBodyScroll() {
  const body = document.body;
  const count = Number(body.dataset.acadlyxModalCount || "0") + 1;
  body.dataset.acadlyxModalCount = String(count);
  body.dataset.acadlyxModalOpen = "true";
  if (count === 1) {
    body.dataset.acadlyxPreviousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
  }
}

function unlockBodyScroll() {
  const body = document.body;
  const count = Math.max(
    0,
    Number(body.dataset.acadlyxModalCount || "0") - 1,
  );

  if (count === 0) {
    const previous = body.dataset.acadlyxPreviousOverflow || "";
    body.style.overflow = previous;
    delete body.dataset.acadlyxModalCount;
    delete body.dataset.acadlyxPreviousOverflow;
    delete body.dataset.acadlyxModalOpen;
  } else {
    body.dataset.acadlyxModalCount = String(count);
  }
}

function focusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("aria-hidden"));
}

export function ModalPortal({
  children,
  layer = "base",
  className = "",
  onBackdropClick,
}: {
  children: ReactNode;
  layer?: ModalLayer;
  className?: string;
  onBackdropClick?: () => void;
}) {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [stackIndex, setStackIndex] = useState(0);
  const idRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const target = getRoot();
    setRoot(target);
    if (!target) return;

    const id = nextId++;
    idRef.current = id;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    stack.push({ id, layer });
    setStackIndex(stack.length - 1);
    lockBodyScroll();

    return () => {
      const index = stack.findIndex((entry) => entry.id === id);
      if (index >= 0) stack.splice(index, 1);

      unlockBodyScroll();

      if (restoreFocusRef.current && document.contains(restoreFocusRef.current)) {
        window.setTimeout(() => restoreFocusRef.current?.focus(), 0);
      }

      if (target && !target.children.length) target.remove();
    };
  }, [layer]);

  useEffect(() => {
    const id = idRef.current;
    if (id == null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (getTopId() !== id) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onBackdropClick?.();
        return;
      }

      if (event.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      const focusable = focusableElements(container);
      if (!focusable.length) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onBackdropClick]);

  useEffect(() => {
    if (!root) return;
    const timer = window.setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const focusable = focusableElements(container);
      (focusable[0] || container).focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [root]);

  if (!root) return null;

  const style: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: zIndexFor(stackIndex, layer),
    isolation: "isolate",
    transform: "none",
    filter: "none",
    WebkitFilter: "none",
    willChange: "auto",
  };

  function handleBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (
      event.target === event.currentTarget &&
      getTopId() === idRef.current
    ) {
      onBackdropClick?.();
    }
  }

  return createPortal(
    <div
      ref={containerRef}
      tabIndex={-1}
      className={`fixed inset-0 flex h-[100dvh] w-screen items-start justify-center overflow-y-auto overscroll-contain bg-slate-950/45 p-4 sm:p-6 ${className}`}
      style={style}
      onMouseDown={handleBackdrop}
      data-acadlyx-modal-layer={layer}
      data-acadlyx-modal-stack-index={stackIndex}
      data-acadlyx-modal-id={idRef.current ?? undefined}
    >
      {children}
    </div>,
    root,
  );
}

export const MODAL_Z_INDEX = {
  base: BASE_Z,
  nested: BASE_Z + STEP_Z,
  critical: BASE_Z + STEP_Z * 2,
  toast: BASE_Z + STEP_Z * 3,
} as const;
