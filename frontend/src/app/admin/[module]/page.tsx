import { AdminModulePage } from "@/components/admin/AdminModulePage";

export default async function AdminModuleRoute({
  params,
}: {
  params: Promise<{
    module: string;
  }>;
}) {
  const { module } =
    await params;

  return (
    <AdminModulePage
      module={module}
    />
  );
}
