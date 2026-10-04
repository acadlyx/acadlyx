import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthenticatedUser } from "../types/auth";

export type GlobalSearchResult={type:"person"|"course"|"notice";id:string;title:string;subtitle:string;href:string};

export async function globalSearch(institutionId:string, actor:AuthenticatedUser, query:string):Promise<GlobalSearchResult[]>{
 const q=query.trim(); if(q.length<2)return [];
 const like=`%${q}%`; const out:GlobalSearchResult[]=[];
 const canPeople=actor.permissions.includes("users.read")||actor.permissions.includes("students.read")||actor.permissions.includes("faculty.read")||actor.roles.some(r=>["DIRECTOR","DEAN","REGISTRAR","INSTITUTION_ADMIN","HOD","HR","ADMISSIONS"].includes(r));
 const canCourses=actor.permissions.includes("courses.read")||actor.roles.some(r=>["FACULTY","HOD","EXAMINATION","DIRECTOR","DEAN","REGISTRAR"].includes(r));
 const canNotices=actor.permissions.includes("notices.read")||actor.roles.length>0;
 if(canPeople){
  const people=await prisma.$queryRaw<Array<{id:string;firstName:string;lastName:string;idNumber:string;email:string}>>(Prisma.sql`
   SELECT "id","firstName","lastName","idNumber","email" FROM "users"
   WHERE "institutionId"=${institutionId} AND "isActive"=TRUE AND ("firstName" ILIKE ${like} OR "lastName" ILIKE ${like} OR "idNumber" ILIKE ${like} OR "email" ILIKE ${like})
   ORDER BY "firstName","lastName" LIMIT 8
  `);
  for(const p of people)out.push({type:"person",id:p.id,title:`${p.firstName} ${p.lastName}`.trim(),subtitle:`${p.idNumber} · ${p.email}`,href:"/erp?tab=people"});
 }
 if(canCourses){
  const courses=await prisma.$queryRaw<Array<{id:string;code:string;name:string}>>(Prisma.sql`
   SELECT "id","code","name" FROM "courses" WHERE "institutionId"=${institutionId}
   AND ("code" ILIKE ${like} OR "name" ILIKE ${like}) ORDER BY "code" LIMIT 8
  `);
  for(const c of courses)out.push({type:"course",id:c.id,title:c.code,subtitle:c.name,href:"/erp?tab=academics"});
 }
 if(canNotices){
  const notices=await prisma.$queryRaw<Array<{id:string;title:string;body:string}>>(Prisma.sql`
   SELECT "id","title","body" FROM "notices" WHERE "institutionId"=${institutionId}
   AND ("title" ILIKE ${like} OR "body" ILIKE ${like}) ORDER BY "createdAt" DESC LIMIT 6
  `);
  for(const n of notices)out.push({type:"notice",id:n.id,title:n.title,subtitle:n.body.slice(0,100),href:"/erp?tab=notices"});
 }
 return out.slice(0,20);
}
