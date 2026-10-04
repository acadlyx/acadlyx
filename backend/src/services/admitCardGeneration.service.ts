import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthenticatedUser } from "../types/auth";
import { AppError } from "../middleware/errorHandler";
import { assertExaminationController } from "./workflowAuthority.service";
import { generateStudentHallTicketPdf } from "./examination.service";

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function u16(n:number){const b=Buffer.alloc(2);b.writeUInt16LE(n);return b;}
function u32(n:number){const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0);return b;}
function zipStore(entries:Array<{name:string;data:Buffer}>):Buffer {
  const locals:Buffer[]=[]; const centrals:Buffer[]=[]; let offset=0;
  for(const entry of entries){
    const name=Buffer.from(entry.name,"utf8"), data=entry.data, crc=crc32(data);
    const local=Buffer.concat([Buffer.from("PK\x03\x04","binary"),u16(20),u16(0x800),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);
    locals.push(local);
    const central=Buffer.concat([Buffer.from("PK\x01\x02","binary"),u16(20),u16(20),u16(0x800),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);
    centrals.push(central); offset+=local.length;
  }
  const centralSize=centrals.reduce((n,b)=>n+b.length,0);
  const end=Buffer.concat([Buffer.from("PK\x05\x06","binary"),u16(0),u16(0),u16(entries.length),u16(entries.length),u32(centralSize),u32(offset),u16(0)]);
  return Buffer.concat([...locals,...centrals,end]);
}

export async function generateBulkAdmitCardsZip(
  institutionId:string, actor:AuthenticatedUser, examSessionId:string
):Promise<{jobId:string;buffer:Buffer;filename:string}> {
  assertExaminationController(actor);
  const students=await prisma.$queryRaw<Array<{studentId:string;serialNumber:string}>>(Prisma.sql`
    SELECT "studentId","serialNumber" FROM "hall_tickets"
    WHERE "institutionId"=${institutionId} AND "examSessionId"=${examSessionId} AND "status"='ISSUED'
    ORDER BY "serialNumber" ASC
  `);
  if(!students.length) throw new AppError("No issued hall tickets are available for this examination.",404);
  if(students.length>1000) throw new AppError("Bulk generation is limited to 1000 hall tickets per request.",413);
  const jobId=randomUUID();
  await prisma.$executeRaw`INSERT INTO "admit_card_generation_jobs"
    ("id","institutionId","examSessionId","status","total","createdById")
    VALUES(${jobId},${institutionId},${examSessionId},'RUNNING',${students.length},${actor.id})`;
  const entries:Array<{name:string;data:Buffer}>=[]; let completed=0,failed=0;
  try {
    for(const student of students){
      try{
        const pdf=await generateStudentHallTicketPdf(institutionId,actor,examSessionId,student.studentId);
        entries.push({name:pdf.filename,data:pdf.buffer}); completed++;
      }catch{failed++;}
      await prisma.$executeRaw`UPDATE "admit_card_generation_jobs"
        SET "completed"=${completed},"failed"=${failed},"updatedAt"=CURRENT_TIMESTAMP
        WHERE "id"=${jobId} AND "institutionId"=${institutionId}`;
    }
    if(!entries.length) throw new AppError("No hall tickets could be generated.",422);
    const buffer=zipStore(entries);
    const filename=`ACADLYX_${examSessionId}_AdmitCards.zip`;
    await prisma.$executeRaw`UPDATE "admit_card_generation_jobs"
      SET "status"='COMPLETED',"fileName"=${filename},"updatedAt"=CURRENT_TIMESTAMP
      WHERE "id"=${jobId} AND "institutionId"=${institutionId}`;
    return {jobId,buffer,filename};
  }catch(error){
    await prisma.$executeRaw`UPDATE "admit_card_generation_jobs"
      SET "status"='FAILED',"error"=${error instanceof Error?error.message:"Bulk generation failed"},"updatedAt"=CURRENT_TIMESTAMP
      WHERE "id"=${jobId} AND "institutionId"=${institutionId}`;
    throw error;
  }
}
export async function getAdmitCardGenerationJob(institutionId:string, actor:AuthenticatedUser, id:string){
  assertExaminationController(actor);
  const rows=await prisma.$queryRaw<Array<Record<string,unknown>>>(Prisma.sql`
    SELECT * FROM "admit_card_generation_jobs" WHERE "id"=${id} AND "institutionId"=${institutionId} LIMIT 1
  `);
  if(!rows[0]) throw new AppError("Generation job not found.",404);
  return rows[0];
}
