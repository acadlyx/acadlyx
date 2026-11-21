import FinanceExpenseManagement from "@/components/accounts/FinanceExpenseManagement";
export default function Page(){return <FinanceExpenseManagement approvalOnly allowedRoles={["CHAIRMAN"]} homeHref="/chairman/fees"/>;}
