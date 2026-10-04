import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";

export type WorkflowState =
  | "NOT_STARTED" | "AVAILABLE" | "IN_PROGRESS" | "PENDING" | "SUBMITTED"
  | "COMPLETED" | "MARKED" | "ENROLLED" | "APPROVED" | "REJECTED"
  | "PAID" | "GENERATED" | "PUBLISHED" | "EXPIRED" | "CANCELLED"
  | "LOCKED" | "REOPENED" | "DROPPED" | "TRANSFERRED" | "ISSUED" | "REVIEWED" | "LATE" | "REQUESTED" | "APPLIED"
  | "UNDER_REVIEW" | "DOCUMENTS_PENDING" | "SELECTED" | "WITHDRAWN" | "DEACTIVATED" | "ACTIVE";

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
  const x=await prisma.assignmentSubmission.findFirst({where:{id:entityId,institutionId},select:{id: true,status:true,submittedAt:true,updatedAt:true,studentId:true,assignment:{select:{courseOffering:{select:{facultyId:true}}}}}});
  if(!x) throw new Error("Workflow record not found");
  const canRead = x.studentId===actor.id || has(actor,"assignments.read") || has(actor,"assignments.manage") || (role(actor,"FACULTY") && x.assignment.courseOffering.facultyId===actor.id);
  if(!canRead) throw new AppError("You do not have access to this submission.",403);
  table="assignment_submissions"; updatedAt=x.updatedAt;
  state=x.status==="REVIEWED"?"REVIEWED":x.status==="LATE"?"LATE":x.status==="REOPENED"?"REOPENED":"SUBMITTED";
  const mine=x.studentId===actor.id;
  const canReopen=has(actor,"assignments.manage")||has(actor,"assignments.update")||(role(actor,"FACULTY")&&x.assignment.courseOffering.facultyId===actor.id);
  editable=mine && state==="REOPENED";
  actions=[
   action("view","View submission",true,undefined,undefined,"secondary"),
   ...(mine?[]:[action("review","Review",canReopen,"assignments.update",canReopen?undefined:"You do not have permission to review submissions.","primary")]),
   ...(canReopen?[action("reopen","Reopen",true,"assignments.update",undefined,"danger",true)]:[])
  ];
 } else if(w==="enrollment"||w==="student_enrollment"){
  const x=await prisma.studentEnrollment.findFirst({where:{id:entityId,institutionId},select:{id:true,status:true,enrolledAt:true,updatedAt:true,userId:true}});
  if(!x) throw new Error("Workflow record not found");
  const canRead = x.userId===actor.id || has(actor,"students.read") || has(actor,"students.manage");
  if(!canRead) throw new AppError("You do not have access to this enrollment.",403);
  table="student_enrollments";updatedAt=x.updatedAt;
  state=x.status==="ACTIVE"?"ENROLLED":x.status==="DROPPED"?"DROPPED":x.status==="COMPLETED"?"COMPLETED":x.status==="TRANSFERRED"?"TRANSFERRED":"CANCELLED";
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
  const canEdit=(x.facultyId===actor.id&&has(actor,"attendance.mark"))||has(actor,"attendance.manage");
  editable=canEdit&&!x.isLocked;
  actions=[action("view","View attendance",true),state==="PENDING"?action("mark","Mark attendance",canEdit,"attendance.mark",canEdit?undefined:"You do not have permission to mark attendance.","primary"):action("edit","Edit attendance",canEdit&&!x.isLocked,"attendance.mark",x.isLocked?"Attendance is locked.":undefined,"secondary",true)];
 } else if(w==="course_registration"||w==="registration"){
  const x=await prisma.courseRegistration.findFirst({where:{id:entityId,institutionId},select:{id:true,status:true,studentId:true,updatedAt:true}});
  if(!x) throw new Error("Workflow record not found");
  const canRead = x.studentId===actor.id || has(actor,"registration.read") || has(actor,"registration.approve") || has(actor,"courses.manage");
  if(!canRead) throw new AppError("You do not have access to this registration.",403);
  table="course_registrations";updatedAt=x.updatedAt;
  state=x.status==="APPROVED"?"APPROVED":x.status==="REJECTED"?"REJECTED":x.status==="DROPPED"?"DROPPED":"REQUESTED";
  const mine=x.studentId===actor.id; const manage=has(actor,"registration.approve")||has(actor,"courses.manage");
  editable=manage;
  actions=[action("view","View registration",true),state==="REQUESTED"&&manage?action("approve","Approve",true,"registration.approve",undefined,"primary"):state==="REQUESTED"&&mine?action("withdraw","Withdraw request",true,"registration.submit",undefined,"danger",true):state==="REJECTED"&&mine?action("resubmit","Fix & resubmit",true,"registration.submit",undefined,"primary"):action("view","View status",true)];
 } else if(w==="application"){
  const x=await prisma.application.findFirst({where:{id:entityId,institutionId},select:{id:true,status:true,studentId:true,appliedAt:true}});
  if(!x) throw new Error("Workflow record not found");
  const canRead = x.studentId===actor.id || has(actor,"applications.read") || has(actor,"applications.manage") || has(actor,"admissions.manage");
  if(!canRead) throw new AppError("You do not have access to this application.",403);
  table="applications";updatedAt=x.appliedAt;
  state=(x.status as WorkflowState)||"APPLIED";
  const manage=has(actor,"applications.manage")||has(actor,"admissions.manage");
  editable=manage;
  actions=[action("view","View application",true),...(manage?[action("review","Review",true,"applications.manage")]:[])];
 } else if(w==="leave_request"||w==="leave"){
  const x=await prisma.leaveRequest.findFirst({where:{id:entityId,institutionId},select:{id:true,status:true,applicantId:true,updatedAt:true}});
  if(!x) throw new AppError("Workflow record not found",404);
  const canRead=x.applicantId===actor.id||has(actor,"leave.read")||has(actor,"leave.approve")||has(actor,"leave.manage");
  if(!canRead) throw new AppError("You do not have access to this leave request.",403);
  table="leave_requests";updatedAt=x.updatedAt;state=(x.status as WorkflowState)||"PENDING";
  const mine=x.applicantId===actor.id;const canApprove=has(actor,"leave.approve")||has(actor,"leave.manage");
  editable=canApprove;
  actions=[action("view","View leave",true),...(state==="PENDING"&&canApprove?[action("approve","Approve",true,"leave.approve",undefined,"primary"),action("reject","Reject",true,"leave.approve",undefined,"danger")]:[]),...(state==="PENDING"&&mine?[action("cancel","Cancel request",true,"leave.apply",undefined,"danger",true)]:[])];
 } else if(w==="admission_application"||w==="admission"){
  const x=await prisma.admissionApplication.findFirst({where:{id:entityId,institutionId},select:{id:true,status:true,updatedAt:true}});
  if(!x) throw new AppError("Workflow record not found",404);
  table="admission_applications";updatedAt=x.updatedAt;state=(x.status as WorkflowState)||"SUBMITTED";
  const manage=has(actor,"admissions.manage");
  editable=manage;
  actions=[action("view","View application",true),...(manage&&["SUBMITTED","UNDER_REVIEW","DOCUMENTS_PENDING"].includes(state)?[action("review","Review application",true,"admissions.manage","", "primary")]:[]),...(manage&&state==="SELECTED"?[action("enroll","Enroll applicant",true,"students.create","", "primary")]:[])];
 } else if(w==="user_account"||w==="user_lifecycle"){
  const x=await prisma.user.findFirst({where:{id:entityId,institutionId},select:{id:true,isActive:true,deletedAt:true,updatedAt:true}});
  if(!x) throw new AppError("Workflow record not found",404);
  const canRead=has(actor,"users.read")||actor.id===x.id;
  if(!canRead) throw new AppError("You do not have access to this user.",403);
  table="users";updatedAt=x.updatedAt;
  state=x.deletedAt?"DEACTIVATED":x.isActive?"ACTIVE":"DEACTIVATED";
  const manage=has(actor,"users.update");
  editable=manage;
  actions=[action("view","View user",true),...(manage&&state==="ACTIVE"? [action("deactivate","Deactivate",true,"users.update",undefined,"danger",true)] : manage?[action("activate","Activate",true,"users.update",undefined,"primary",true)]:[])];
 } else if(w==="student_movement"||w==="movement_request"){
  const x=await prisma.studentMovementRequest.findFirst({where:{id:entityId,institutionId},select:{id:true,status:true,studentId:true,updatedAt:true}});
  if(!x) throw new AppError("Workflow record not found",404);
  const canRead=x.studentId===actor.id||has(actor,"students.read")||has(actor,"students.update")||has(actor,"students.manage");
  if(!canRead) throw new AppError("You do not have access to this student movement request.",403);
  table="student_movement_requests";updatedAt=x.updatedAt;state=(x.status as WorkflowState)||"PENDING";
  const manage=has(actor,"students.update")||has(actor,"students.manage");editable=manage;
  actions=[action("view","View request",true),...(state==="PENDING"&&manage?[action("approve","Approve",true,"students.update",undefined,"primary"),action("reject","Reject",true,"students.update",undefined,"danger")]:[])];
 } else if(w==="certificate"){
  const x=await prisma.certificate.findFirst({where:{id:entityId,institutionId},select:{id:true,status:true,studentId:true,updatedAt:true}});
  if(!x) throw new Error("Workflow record not found");
  const canRead = x.studentId===actor.id || has(actor,"certificates.read") || has(actor,"certificates.issue") || has(actor,"students.manage");
  if(!canRead) throw new AppError("You do not have access to this certificate.",403);
  table="certificates";updatedAt=x.updatedAt; state=x.status==="ISSUED"?"ISSUED":x.status==="REJECTED"?"REJECTED":"REQUESTED";
  const manage=has(actor,"certificates.issue")||has(actor,"students.manage");
  editable=manage; actions=[action("view","View certificate",true),...(state==="REQUESTED"&&manage?[action("issue","Issue certificate",true,"certificates.issue","", "primary")]:[])];
 } else if(w==="fee_invoice"){
  const x=await prisma.feeInvoice.findFirst({where:{id:entityId,institutionId},select:{id:true,status:true,paidAmount:true,amount:true,updatedAt:true,studentId:true}});
  if(!x) throw new Error("Workflow record not found");
  const canRead = x.studentId===actor.id || has(actor,"fees.read") || has(actor,"fees.manage") || has(actor,"payments.manage");
  if(!canRead) throw new AppError("You do not have access to this fee invoice.",403);
  table="fee_invoices";updatedAt=x.updatedAt;
  state=x.status==="PAID"||x.paidAmount>=x.amount?"PAID":x.status==="CANCELLED"?"CANCELLED":"PENDING";
  const manage=has(actor,"fees.manage")||has(actor,"payments.manage");
  editable=manage; actions=[action("view","View fee",true),...(state==="PENDING"&&actor.id===x.studentId?[action("pay","Pay fee",true,"fees.pay",undefined,"primary")]:[]),...(manage?[action("manage","Manage fee",true,"fees.manage")]:[])];
 } else if(w==="exam_result"){
  const x=await prisma.examResult.findFirst({where:{id:entityId,institutionId},select:{id:true,updatedAt:true,studentId:true}});
  if(!x) throw new Error("Workflow record not found");
  table="exam_results";updatedAt=x.updatedAt;state="PUBLISHED";
  const manage=has(actor,"results.manage")||has(actor,"exams.manage"); editable=manage;
  actions=[action("view","View result",true),...(manage?[action("edit","Edit result",true,"results.manage",undefined,"secondary",true)]:[])];
 } else throw new Error(`Unsupported workflow: ${workflow}`);

 return {workflow,entityId,state,completed:["SUBMITTED","LATE","COMPLETED","MARKED","ENROLLED","APPROVED","PAID","GENERATED","PUBLISHED","ISSUED","REVIEWED","SELECTED","ACTIVE"].includes(state),editable,locked:state==="LOCKED",actions,source:{table,id:entityId},updatedAt:updatedAt.toISOString()};
}

export async function getWorkflowStates(institutionId:string,actor:AuthenticatedUser,items:Array<{workflow:string;entityId:string}>){
 // De-duplicate identical requests so a large table cannot accidentally issue the same
 // authoritative state query more than once. Preserve the caller's original order.
 const unique=new Map<string,{workflow:string;entityId:string}>();
 for(const item of items){
  const workflow=item.workflow.trim();
  const entityId=item.entityId.trim();
  if(!workflow || !entityId) throw new Error("Each workflow item requires workflow and entityId.");
  unique.set(`${workflow.toLowerCase()}::${entityId}`,{workflow,entityId});
 }
 const resolved=new Map<string,WorkflowStateResult>();
 await Promise.all([...unique.values()].map(async item=>{
  const result=await getWorkflowState(institutionId,actor,item.workflow,item.entityId);
  resolved.set(`${item.workflow.toLowerCase()}::${item.entityId}`,result);
 }));
 return items.map(item=>resolved.get(`${item.workflow.trim().toLowerCase()}::${item.entityId.trim()}`)!);
}
