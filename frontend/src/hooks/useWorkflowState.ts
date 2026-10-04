"use client";
import { useCallback,useEffect,useState } from "react";
import { AuthRequiredError } from "@/lib/auth";
import { getWorkflowState,type WorkflowStateResult } from "@/lib/workflowApi";

export function useWorkflowState(workflow:string,entityId?:string){
 const [state,setState]=useState<WorkflowStateResult|null>(null);
 const [loading,setLoading]=useState(Boolean(entityId)); const [error,setError]=useState("");
 const refresh=useCallback(async()=>{
  if(!entityId){setState(null);setLoading(false);return;}
  setLoading(true);setError("");
  try{setState(await getWorkflowState(workflow,entityId));}
  catch(e){if(e instanceof AuthRequiredError) throw e;setError(e instanceof Error?e.message:"Unable to load workflow state.");}
  finally{setLoading(false);}
 },[workflow,entityId]);
 useEffect(()=>{void refresh();},[refresh]);
 return {state,loading,error,refresh};
}
