import { redirect } from "next/navigation";

export default function AccountsFeesRedirect(): never {
  redirect("/fees");
}
