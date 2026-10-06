import { AdminStudentsPage } from "@/components/admin/AdminStudentsPage";

export default async function AdminStudentsRoute({ searchParams }: { searchParams: Promise<{ departmentId?: string }> }) {
  const params = await searchParams;
  return <AdminStudentsPage departmentId={params.departmentId} />;
}
