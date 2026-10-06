import { AdminStudentsPage } from "@/components/admin/AdminStudentsPage";

export default function AdminStudentsRoute({ searchParams }: { searchParams: { departmentId?: string } }) {
  return <AdminStudentsPage departmentId={searchParams.departmentId} />;
}
