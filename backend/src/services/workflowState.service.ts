import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthenticatedUser } from "../types/auth";

export type WorkflowState =
  | "NOT_STARTED" | "AVAILABLE" | "IN_PROGRESS" | "PENDING" | "SUBMITTED"
  | "COMPLETED" | "MARKED" | "ENROLLED" | "APPROVED" | "REJECTED"
  | "PAID" | "GENERATED" | "PUBLISHED" | "EXPIRED" | "CANCELLED"
  | "LOCKED" | "REOPENED" | "DROPPED" | "ISSUED" | "REVIEWED";

export interface WorkflowAction {
  key:string; label:string; kind:"primary"|"secondary"|"danger"|"status";
  enabled:boolean; reason?:string; permission?:string; reversible?:boolean;
}
export interface WorkflowStateResult {
  workflow:string; entityId:string; state:WorkflowState;
  completed:boolean; editable:boolean; locked:boolean;
  actions:WorkflowAction[]; source:{table:string;id:string};
  updatedAt:string;
}

const has=(a:AuthenticatedUser,p:string)=>a.permissions.includes(p);
const role=(a:AuthenticatedUser,r:string)=>a.roles.some(x=>x.toUpperCase()===r);

function action(key:string,label:string,enabled:boolean,permission?:string,reason?:string,kind:WorkflowAction["kind"]="secondary",reversible=false):WorkflowAction{
 return {key,label,kind,enabled,permission,reason,reversible};
}

export async function getWorkflowState(institutionId:string, actor:AuthenticatedUser, workflow:string, entityId:string):Promise<WorkflowStateResult>{
 let state:WorkflowState="NOT_STARTED", editable=false, table="", updatedAt=new Date(0), actions:WorkflowAction[]=[];
 const w=workflow.toLowerCase();

 if(w==="assignment_submission"){
  const x=await prisma.assignmentSubmission.findFirst({where:{id:entityId,institutionId},select:{id: true,status:true,submittedAt:true,updatedAt:true,studentId:true}});
  if(!x) throw new Error("Workflow record not found");
  table="assignment_submissions"; updatedAt=x.updatedAt;
  state=x.status==="REVIEWED"?"REVIEWED":x.status==="LATE"?"SUBMITTED":"SUBMITTED";
  const mine=x.studentId===actor.id;
  const canReopen=has(actor,"assignments.manage")||has(actor,"assignments.update")||role(actor,"FACULTY")||role(actor,"HOD");
  editable=mine && state==="REOPENED";
  actions=[
   action("view","View submission",true,undefined,undefined,"secondary"),
   ...(mine?[]:[action("review","Review",canReopen,"assignments.update",canReopen?undefined:"You do not have permission to review submissions.","primary")]),
   ...(canReopen?[action("reopen","Reopen",true,"assignments.update",undefined,"danger",true)]:[])
  ];
 } else if(w==="enrollment"||w==="student_enrollment"){
  const x=await prisma.studentEnrollment.findFirst({where:{id:entityId,institutionId},select:{id:true,status:true,enrolledAt:true,updatedAt:true,userId:true}});
  if(!x) throw new Error("Workflow record not found");
  table="student_enrollments";updatedAt=x.updatedAt;
  state=x.status==="ACTIVE"?"ENROLLED":x.status==="DROPPED"?"DROPPED":x.status==="COMPLETED"?"COMPLETED":"CANCELLED";
  const mine=x.userId===actor.id; const canWithdraw=has(actor,"students.update")||has(actor,"students.manage");
  editable=canWithdraw;
  actions=[action("view","View enrollment",true)];
  if(state==="ENROLLED"&&mine&&canWithdraw) actions.push(action("withdraw","Withdraw",true,"students.update",undefined,"danger",true));
  else if(state==="ENROLLED"&&!mine&&canWithdraw) actions.push(action("manage","Manage enrollment",true,"students.update"));
 } else if(w==="attendance_session"||w==="attendance"){
  const x=await prisma.attendanceSession.findFirst({where:{id:entityId,institutionId},select:{id:true,isSubmitted:true,isLocked:true,submittedAt:true,updatedAt:true,facultyId:true}});
  if(!x) throw new Error("Workflow record not found");
  table="attendance_sessions";updatedAt=x.updatedAt;
  state=x.isLocked?"LOCKED":x.isSubmitted?"MARKED":"PENDING";
  const canEdit=(x.facultyId===actor.id&&has(actor,"attendance.update"))||has(actor,"attendance.manage")||role(actor,"HOD");
  editable=canEdit&&!x.isLocked;
  actions=[action("view","View attendance",true),state==="PENDING"?action("mark","Mark attendance",canEdit,"attendance.update",canEdit?undefined:"You do not have permission to mark attendance.","primary"):action("edit","Edit attendance",canEdit&&!x.isLocked,"attendance.update",x.isLocked?"Attendance is locked.":undefined,"secondary",true)];
 } else if(w==="course_registration"||w==="registration"){
  const x=await prisma.courseRegistration.findFirst({where:{id:entityId,institutionId},select:{id:true,status:true,studentId:true,updatedAt:true}});
  if(!x) throw new Error("Workflow record not found");
  table="course_registrations";updatedAt=x.updatedAt;
  state=x.status==="APPROVED"?"APPROVED":x.status==="REJECTED"?"REJECTED":x.status==="DROPPED"?"DROPPED":"PENDING";
  const mine=x.studentId===actor.id; const manage=has(actor,"registration.manage")||has(actor,"courses.manage");
  editable=manage;
  actions=[action("view","View registration",true),state==="PENDING"&&manage?action("approve","Approve",true,"registration.manage",undefined,"primary"):state==="PENDING"&&mine?action("withdraw","Withdraw request",true,"registration.update",undefined,"danger",true):state==="REJECTED"&&mine?action("resubmit","Fix & resubmit",true,"registration.update",undefined,"primary"):action("view","View status",true)];
 } else if(w==="application"){
  const x=await prisma.application.findFirst({where:{id:entityId,institutionId},select:{id:true,status:true,studentId:true,appliedAt:true,updatedAt:true}});
  if(!x) throw new Error("Workflow record not found");
  table="applications";updatedAt=x.updatedAt;
  state=(x.status as WorkflowState)||"APPLIED";
  const manage=has(actor,"applications.manage")||has(actor,"admissions.manage");
  editable=manage;
  actions=[action("view","View application",true),...(manage?[action("review","Review",true,"applications.manage")]:[])];
 } else if(w==="certificate"){
  const x=await prisma.certificate.findFirst({where:{id:entityId,institutionId},select:{id:true,status:true,studentId:true,updatedAt:true}});
  if(!x) throw new Error("Workflow record not found");
  table="certificates";updatedAt=x.updatedAt; state=x.status==="ISSUED"?"ISSUED":x.status==="REJECTED"?"REJECTED":"PENDING";
  const manage=has(actor,"certificates.manage")||has(actor,"students.manage");
  editable=manage; actions=[action("view","View certificate",true),...(state==="PENDING"&&manage?[action("issue","Issue certificate",true,"certificates.manage","", "primary")]:[])];
 } else if(w==="fee_invoice"){
  const x=await prisma.feeInvoice.findFirst({where:{id:entityId,institutionId},select:{id:true,status:true,paidAmount:true,amount:true,updatedAt:true,studentId:true}});
  if(!x) throw new Error("Workflow record not found");
  table="fee_invoices";updatedAt=x.updatedAt;
  state=x.status==="PAID"||x.paidAmount>=x.amount?"PAID":x.status==="CANCELLED"?"CANCELLED":"PENDING";
  const manage=has(actor,"fees.manage")||has(actor,"payments.manage");
  editable=manage; actions=[action("view","View fee",true),...(state==="PENDING"&&actor.id===x.studentId?[action("pay","Pay fee",true,"fees.payments.create",undefined,"primary")]:[]),...(manage?[action("manage","Manage fee",true,"fees.manage")]:[])];
 } else if(w==="exam_result"){
  const x=await prisma.examResult.findFirst({where:{id:entityId,institutionId},select:{id:true,updatedAt:true,studentId:true}});
  if(!x) throw new Error("Workflow record not found");
  table="exam_results";updatedAt=x.updatedAt;state="PUBLISHED";
  const manage=has(actor,"results.manage")||has(actor,"exams.manage"); editable=manage;
  actions=[action("view","View result",true),...(manage?[action("edit","Edit result",true,"results.manage",undefined,"secondary",true)]:[])];
 } else throw new Error(`Unsupported workflow: ${workflow}`);

 return {workflow,entityId,state,completed:["SUBMITTED","COMPLETED","MARKED","ENROLLED","APPROVED","PAID","GENERATED","PUBLISHED","ISSUED","REVIEWED"].includes(state),editable,locked:state==="LOCKED",actions,source:{table,id:entityId},updatedAt:updatedAt.toISOString()};
}

export async function getWorkflowStates(institutionId:string,actor:AuthenticatedUser,items:Array<{workflow:string;entityId:string}>){
 return Promise.all(items.map(x=>getWorkflowState(institutionId,actor,x.workflow,x.entityId)));
}
