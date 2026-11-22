import { ReactNode } from "react";
import { PageHeader } from "@/components/ui/AcadlyxDesignSystem";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  eyebrow?: string;
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <PageHeader
      title={title}
      actions={action}
    />
  );
}
