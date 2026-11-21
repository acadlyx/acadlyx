import FinanceExpenseManagement from "@/components/accounts/FinanceExpenseManagement";
export default function Page(){return <FinanceExpenseManagement approvalOnly allowedRoles={["DIRECTOR"]} homeHref="/director/fees"/>;}
