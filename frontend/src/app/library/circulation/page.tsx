import { redirect } from "next/navigation";

export default function LibraryCirculationRedirect(): never {
  redirect("/library?tab=circulation");
}
