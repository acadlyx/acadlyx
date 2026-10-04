import FinanceInvoiceDetail from "@/components/accounts/FinanceInvoiceDetail";
export default function Page({params}:{params:{id:string}}){return <FinanceInvoiceDetail id={params.id}/>;}