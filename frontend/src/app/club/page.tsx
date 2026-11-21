import { RoleRedirect } from "@/components/navigation/RoleRedirect";

export default function ClubLegacyRoute() {
  return (
    <RoleRedirect
      destinations={{ CLUB_PRESIDENT: "/club-president" }}
      title="Opening the Club President workspace…"
    />
  );
}
