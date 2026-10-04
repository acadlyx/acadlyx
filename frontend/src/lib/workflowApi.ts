import { authedFetch } from "./auth";
export type WorkflowAction={key:string;label:string;kind:"primary"|"secondary"|"danger"|"status";enabled:boolean;reason?:string;permission?:string;reversible?:boolean};
export type WorkflowStateResult={workflow:string;entityId:string;state:string;completed:boolean;editable:boolean;locked:boolean;actions:WorkflowAction[];source:{table:string;id:string};updatedAt:string};
export async function getWorkflowState(workflow:string,entityId:string):Promise<WorkflowStateResult>{
 const r=await authedFetch<{success:true;data:WorkflowStateResult}>(`/workflow/${encodeURIComponent(workflow)}/${encodeURIComponent(entityId)}`);
 return r.data;
}
