import { redirect } from "next/navigation";

/*
 * Subscription plans are reviewed and assigned per tenant in the
 * Platform overview's institutions section, which renders each tenant's
 * current entitlement.
 */
export default function Page(): never {
  redirect("/superadmin?section=institutions");
}
