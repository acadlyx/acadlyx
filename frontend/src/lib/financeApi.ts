import { authedFetch,authedDownload } from "@/lib/auth";
export type FinanceOverview={billed:number;collected:number;refunded:number;outstanding:number;overdue:number;collectionPercentage:number;todayCollection:number;monthCollection:number;invoiceCount:number;paymentCount:number;scope:Record<string,unknown>};
export async function financeOverview(){return (await authedFetch<{success:boolean;data:FinanceOverview}>("/finance/overview")).data;}
export async function financeCommandCenter(period:"today"|"week"|"month"|"quarter"|"academic"="academic"){return (await authedFetch<{success:boolean;data:any}>(`/finance/command-center?period=${period}`)).data;}
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
export async function financeAssignStructure(id:string){return (await authedFetch<{success:boolean;data:{generated:number;skipped:number;studentCount?:number}}>(`/erp/fee-structures/${id}/assign`,{method:"POST",body:JSON.stringify({})})).data;}

export async function downloadFinanceExport(type:"invoices"|"payments"|"receipts"|"transactions",format:"xlsx"|"csv"|"docx"|"pdf"|"json"="xlsx"){const x=await authedDownload(`/finance/export?type=${type}&format=${format}`);const url=URL.createObjectURL(x.blob);const a=document.createElement("a");a.href=url;a.download=x.filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}

export async function financeAudit(){return (await authedFetch<{success:boolean;data:any[]}>("/finance/audit")).data}


export type FinanceExpenseInput = {category:string;description:string;amount:string;vendor?:string;reference?:string;spentAt:string;supportDetails?:string;supportingDocumentUrl?:string;supportingDocumentFileId?:string;campusId?:string;departmentId?:string};
export async function financeExpenses(params:Record<string,string|undefined>={}){const q=new URLSearchParams();Object.entries(params).forEach(([k,v])=>{if(v)q.set(k,v)});return(await authedFetch<{success:boolean;data:any[]}>("/finance/expenses?"+q.toString())).data}
export async function createFinanceExpense(input:FinanceExpenseInput){return(await authedFetch<{success:boolean;data:any}>("/finance/expenses",{method:"POST",body:JSON.stringify(input)})).data}
export async function updateFinanceExpense(id:string,input:FinanceExpenseInput){return(await authedFetch<{success:boolean;data:any}>("/finance/expenses/"+id,{method:"PUT",body:JSON.stringify(input)})).data}
export async function decideFinanceExpense(id:string,decision:"APPROVED"|"REJECTED",comment:string){return(await authedFetch<{success:boolean;data:any}>("/finance/expenses/"+id+"/decision",{method:"POST",body:JSON.stringify({decision,comment})})).data}
export async function financeExpenseHistory(id:string){return(await authedFetch<{success:boolean;data:any[]}>("/finance/expenses/"+id+"/history")).data}

export async function downloadFinanceExpenses(format:"xlsx"|"csv"|"docx"|"pdf"|"json"="xlsx"){const x=await authedDownload("/finance/expenses/export?format="+format);const url=URL.createObjectURL(x.blob);const a=document.createElement("a");a.href=url;a.download=x.filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}

export async function financeRecordPayment(id:string,input:{amount:string;method:string;reference?:string;notes?:string;idempotencyKey:string}){return(await authedFetch<{success:boolean;data:any}>("/finance/invoices/"+id+"/payments",{method:"POST",body:JSON.stringify(input)})).data}
export async function financeRequestConcession(id:string,input:{amount:string;type:string;reason:string}){return(await authedFetch<{success:boolean;data:any}>("/finance/invoices/"+id+"/concessions",{method:"POST",body:JSON.stringify(input)})).data}
export async function financeRequestRefund(paymentId:string,input:{amount:string;reason:string}){return(await authedFetch<{success:boolean;data:any}>("/finance/payments/"+paymentId+"/refunds",{method:"POST",body:JSON.stringify(input)})).data}
export async function financeApproveConcession(id:string){return(await authedFetch<{success:boolean;data:any}>("/finance/concessions/"+id+"/approve",{method:"POST",body:JSON.stringify({})})).data}
export async function financeApproveRefund(id:string){return(await authedFetch<{success:boolean;data:any}>("/finance/refunds/"+id+"/approve",{method:"POST",body:JSON.stringify({})})).data}
export async function financeProcessRefund(id:string,input?:{externalSettlementReference?:string;confirmExternalSettlement?:boolean}){return(await authedFetch<{success:boolean;data:any}>("/finance/refunds/"+id+"/process",{method:"POST",body:JSON.stringify(input||{})})).data}
export async function financeCancelInvoice(id:string){return(await authedFetch<{success:boolean;data:any}>("/finance/invoices/"+id+"/cancel",{method:"POST",body:JSON.stringify({})})).data}
