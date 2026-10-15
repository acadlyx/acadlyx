"use client";

import { redirect } from "next/navigation";

/** Legacy route: permanently route to the Director workspace before client auth guards run. */
export default function DirectorOperationsRedirect() {
  redirect("/director");
}
