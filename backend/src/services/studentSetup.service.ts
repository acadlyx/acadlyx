import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { recordAuditLog } from "./audit.service";

export async function completeStudentSetup(
  institutionId: string,
  studentId: string,
  actor: AuthenticatedUser,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      institutionId,
      isActive: true,
      userRoles: {
        some: { role: { name: "STUDENT", institutionId } },
      },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      idNumber: true,
      profile: {
        select: {
          admissionNumber: true,
          status: true,
        },
      },
      studentEnrollments: {
        where: { institutionId, status: "ACTIVE" },
        orderBy: { enrolledAt: "desc" },
        take: 1,
        select: {
          id: true,
          programId: true,
          academicYearId: true,
          semesterId: true,
          sectionId: true,
          rollNumber: true,
          program: { select: { id: true, name: true, code: true } },
          academicYear: { select: { id: true, name: true } },
          semester: { select: { id: true, name: true, number: true } },
          section: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!student) throw new AppError("Student not found", 404);
  if (!student.profile) throw new AppError("Student master profile is incomplete", 409);

  const enrollment = student.studentEnrollments[0];
  if (!enrollment || !enrollment.semesterId || !enrollment.sectionId) {
    throw new AppError(
      "Student needs an active program, academic year, semester and section before course setup can be completed",
      409
    );
  }

  const offerings = await prisma.courseOffering.findMany({
    where: {
      institutionId,
      semesterId: enrollment.semesterId,
      sectionId: enrollment.sectionId,
      isActive: true,
    },
    orderBy: { course: { code: "asc" } },
    select: {
      id: true,
      isElective: true,
      registrationOpen: true,
      course: { select: { id: true, code: true, name: true, credits: true } },
    },
  });

  const existing = await prisma.courseRegistration.findMany({
    where: {
      institutionId,
      studentId,
      courseOfferingId: { in: offerings.map((item) => item.id) },
    },
    select: {
      id: true,
      courseOfferingId: true,
      status: true,
    },
  });

  const existingByOffering = new Map(existing.map((item) => [item.courseOfferingId, item]));
  const compulsory = offerings.filter((item) => !item.isElective);
  const elective = offerings.filter((item) => item.isElective);

  const results = await prisma.$transaction(async (tx) => {
    const assigned: Array<{
      courseOfferingId: string;
      courseCode: string;
      courseName: string;
      credits: number;
      status: string;
      action: "CREATED" | "UPDATED" | "UNCHANGED";
    }> = [];

    for (const offering of compulsory) {
      const current = existingByOffering.get(offering.id);

      if (current?.status === "APPROVED") {
        assigned.push({
          courseOfferingId: offering.id,
          courseCode: offering.course.code,
          courseName: offering.course.name,
          credits: offering.course.credits,
          status: "APPROVED",
          action: "UNCHANGED",
        });
        continue;
      }

      const saved = current
        ? await tx.courseRegistration.update({
            where: { id: current.id },
            data: {
              status: "APPROVED",
              decidedById: actor.id,
              decidedAt: new Date(),
              remarks: "Automatically completed by Student Setup Center",
            },
          })
        : await tx.courseRegistration.create({
            data: {
              institutionId,
              studentId,
              courseOfferingId: offering.id,
              status: "APPROVED",
              decidedById: actor.id,
              decidedAt: new Date(),
              remarks: "Automatically completed by Student Setup Center",
            },
          });

      assigned.push({
        courseOfferingId: offering.id,
        courseCode: offering.course.code,
        courseName: offering.course.name,
        credits: offering.course.credits,
        status: saved.status,
        action: current ? "UPDATED" : "CREATED",
      });
    }

    return assigned;
  });

  const skippedElectives = elective.map((offering) => {
    const current = existingByOffering.get(offering.id);
    return {
      courseOfferingId: offering.id,
      courseCode: offering.course.code,
      courseName: offering.course.name,
      credits: offering.course.credits,
      status: current?.status ?? "NOT_SELECTED",
    };
  });

  const activeRegistrations = await prisma.courseRegistration.findMany({
    where: {
      institutionId,
      studentId,
      status: "APPROVED",
      courseOffering: {
        semesterId: enrollment.semesterId,
        sectionId: enrollment.sectionId,
      },
    },
    select: {
      courseOffering: { select: { course: { select: { credits: true } } } },
    },
  });

  const registeredCredits = activeRegistrations.reduce(
    (sum, item) => sum + item.courseOffering.course.credits,
    0
  );

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "student.setup.complete",
    entityType: "User",
    entityId: student.id,
    metadata: {
      studentId: student.id,
      enrollmentId: enrollment.id,
      compulsoryOfferings: compulsory.length,
      assignedCount: results.length,
      electiveCount: elective.length,
      registeredCredits,
    } satisfies Prisma.InputJsonValue,
    ...meta,
  });

  return {
    student: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`.trim(),
      email: student.email,
      idNumber: student.idNumber,
      admissionNumber: student.profile.admissionNumber,
    },
    enrollment: {
      id: enrollment.id,
      program: enrollment.program,
      academicYear: enrollment.academicYear,
      semester: enrollment.semester,
      section: enrollment.section,
      rollNumber: enrollment.rollNumber,
    },
    summary: {
      courseOfferingsFound: offerings.length,
      compulsoryFound: compulsory.length,
      compulsoryAssigned: results.length,
      electivesAvailable: elective.length,
      registeredCredits,
    },
    compulsory: results,
    electives: skippedElectives,
    complete: results.length === compulsory.length,
  };
}
