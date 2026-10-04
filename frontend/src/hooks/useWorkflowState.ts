"use client";
import { useCallback,useEffect,useState } from "react";
import { AuthRequiredError } from "@/lib/auth";
import { getWorkflowState,getWorkflowStates,type WorkflowStateResult } from "@/lib/workflowApi";

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

export function useWorkflowStates(items:Array<{workflow:string;entityId:string}>){
 const [states,setStates]=useState<WorkflowStateResult[]>([]);
 const [loading,setLoading]=useState(items.length>0); const [error,setError]=useState("");
 const refresh=useCallback(async()=>{
  if(items.length===0){setStates([]);setLoading(false);return;}
  setLoading(true);setError("");
  try{setStates(await getWorkflowStates(items));}
  catch(e){if(e instanceof AuthRequiredError) throw e;setError(e instanceof Error?e.message:"Unable to load workflow states.");}
  finally{setLoading(false);}
 },[JSON.stringify(items)]);
 useEffect(()=>{void refresh();},[refresh]);
 return {states,loading,error,refresh};
}
