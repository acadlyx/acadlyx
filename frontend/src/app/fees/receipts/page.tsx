import { redirect } from "next/navigation";

export default function LegacyFeeReceiptsPage(): never {
  redirect("/accounts/receipts");
}
