import { authedFetch } from "@/lib/auth";
export type FinanceOverview={billed:number;collected:number;refunded:number;outstanding:number;overdue:number;collectionPercentage:number;todayCollection:number;monthCollection:number;invoiceCount:number;paymentCount:number;scope:Record<string,unknown>};
export async function financeOverview(){return (await authedFetch<{success:boolean;data:FinanceOverview}>("/finance/overview")).data;}
export async function financeInvoices(params:Record<string,string|number|undefined>={}){const q=new URLSearchParams();Object.entries(params).forEach(([k,v])=>v!==undefined&&q.set(k,String(v)));return (await authedFetch<{success:boolean;data:{items:any[];total:number;page:number;pageSize:number}}>(`/finance/invoices?${q}`)).data;}
export async function financeInvoice(id:string){return (await authedFetch<{success:boolean;data:any}>(`/finance/invoices/${id}`)).data;}
export async function financePayments(){return (await authedFetch<{success:boolean;data:any[]}>("/finance/payments")).data;}
export async function financeReceipts(){return (await authedFetch<{success:boolean;data:any[]}>("/finance/receipts")).data;}
export async function financeCollections(){return (await authedFetch<{success:boolean;data:{departments:any[]}}>("/finance/collections")).data;}
export async function financeConcessions(){return (await authedFetch<{success:boolean;data:any[]}>("/finance/concessions")).data;}
export async function financeRefunds(){return (await authedFetch<{success:boolean;data:any[]}>("/finance/refunds")).data;}
export async function financeTransactions(){return (await authedFetch<{success:boolean;data:any[]}>("/finance/transactions")).data;}

export async function financeStructures(){return (await authedFetch<{success:boolean;data:any[]}>("/erp/fee-structures")).data;}
export async function financeHeads(){return (await authedFetch<{success:boolean;data:any[]}>("/erp/fee-heads")).data;}
