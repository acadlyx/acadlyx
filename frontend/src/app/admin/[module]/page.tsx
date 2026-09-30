import { AdminModulePage } from "@/components/admin/AdminModulePage";

interface AdminModuleRouteProps {
  params: Promise<{
    module: string;
  }>;
}

export default async function AdminModuleRoute({
  params,
}: AdminModuleRouteProps) {
  const { module } = await params;

  return (
    <AdminModulePage module={module} />
  );
}
