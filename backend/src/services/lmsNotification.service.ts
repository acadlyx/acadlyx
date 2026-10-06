import { prisma } from "../lib/prisma";
import { subscribeDomainEvent, DomainEvent } from "./domainEvent.service";

async function recipients(institutionId:string, courseOfferingId:string, actorId:string|null) {
  const offering=await prisma.courseOffering.findFirst({where:{id:courseOfferingId,institutionId},select:{facultyId:true}});
  const registrations=await prisma.courseRegistration.findMany({where:{institutionId,courseOfferingId,status:"APPROVED"},select:{studentId:true}});
  const ids=[offering?.facultyId,...registrations.map(r=>r.studentId)].filter((id):id is string=>Boolean(id)&&id!==actorId);
  return [...new Set(ids)];
}
async function notify(event:DomainEvent) {
  if(!event.institutionId) return;
  const p=event.payload as Record<string,unknown>;
  const offeringId=typeof p.courseOfferingId==="string"?p.courseOfferingId:null;
  if(!offeringId) return;
  const ids=await recipients(event.institutionId,offeringId,event.actorId);
  if(!ids.length) return;
  let title="LMS update"; let body="There is a new update in your course workspace.";
  switch(event.name){
    case "lms.course.published": title="Course published"; body="Your course is now published in ACADLYX LMS."; break;
    case "lms.assignment.created": title="New assignment"; body="A new assignment is available in your course."; break;
    case "lms.assignment.updated": title="Assignment updated"; body="An assignment in your course was updated."; break;
    case "lms.assignment.submitted": title="Assignment submitted"; body="A student submitted an assignment."; break;
    case "lms.assignment.reviewed": title="Assignment graded"; body="Your assignment submission has been reviewed."; break;
    case "lms.quiz.created": title="New quiz"; body="A new quiz was added to your course."; break;
    case "lms.quiz.status_changed": title="Quiz status changed"; body="A quiz in your course changed status."; break;
    case "lms.quiz.submitted": title="Quiz submitted"; body="A quiz attempt was submitted."; break;
    case "lms.quiz.graded": title="Quiz graded"; body="Your quiz attempt has been graded."; break;
    case "lms.live_class.scheduled": title="Live class scheduled"; body="A new live class was scheduled."; break;
    case "lms.announcement.published": title="Course announcement"; body="A new announcement was published."; break;
    case "lms.discussion.created": title="Course discussion"; body="A new message was posted in your course discussion."; break;
    default: return;
  }
  await prisma.notification.createMany({data:ids.map(userId=>({institutionId:event.institutionId as string,userId,title,body}))});
}
subscribeDomainEvent("*",event=>{void notify(event).catch(()=>undefined);});
