import { DashboardShell } from "@/components/dashboard/DashboardShell";
import Phase2ModulePage from "@/components/phase2/Phase2ModulePage";

export default function Page() {
  return (
    <DashboardShell title="Admission Management" subtitle="ACADLYX Core ERP">
      <Phase2ModulePage module="admissions" />
    </DashboardShell>
  );
}
