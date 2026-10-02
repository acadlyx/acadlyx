import { ReactNode } from "react";
import { PageHeader } from "@/components/ui/AcadlyxDesignSystem";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  eyebrow?: string;
}

export function SectionHeader({ title, subtitle, action, eyebrow }: SectionHeaderProps) {
  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title}
      description={subtitle}
      actions={action}
    />
  );
}
