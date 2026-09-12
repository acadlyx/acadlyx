import { prisma } from "../lib/prisma";

/** Deterministic readiness: 60% weighted skills, 20% profile, 20% academic. */
export async function getCareerIntelligence(institutionId: string, studentId: string, academicHealth = 0) {
  const path = await prisma.careerPath.findFirst({ where: { studentId, isPrimary: true }, include: { targetRole: { include: { roleSkills: { include: { skill: true } } } } } });
  const skills = await prisma.studentSkill.findMany({ where: { institutionId, studentId }, include: { skill: true } });
  const profile = await prisma.user.findFirst({ where: { id: studentId, institutionId }, select: { phone: true } });
  if (!path) return { targetRole: null, readiness: 0, skills, missingSkills: [], recommendations: ["Select a target role to start your career plan"], opportunities: [] };
  const skillMap = new Map(skills.map(x => [x.skillId, x.proficiency]));
  const required = path.targetRole.roleSkills;
  const totalWeight = required.reduce((n, x) => n + x.weight, 0) || 1;
  const coverage = required.reduce((n, x) => n + Math.min(1, (skillMap.get(x.skillId) || 0) / x.minimumLevel) * x.weight, 0) / totalWeight * 100;
  const profileScore = profile?.phone ? 100 : 50;
  const readiness = Math.round(coverage * .6 + profileScore * .2 + academicHealth * .2);
  const missingSkills = required.filter(x => (skillMap.get(x.skillId) || 0) < x.minimumLevel).map(x => ({ name: x.skill.name, requiredLevel: x.minimumLevel, currentLevel: skillMap.get(x.skillId) || 0 }));
  const opportunities = await prisma.opportunity.findMany({ where: { institutionId, isActive: true, OR: [{ targetRoleId: path.targetRoleId }, { targetRoleId: null }] }, select: { id: true, title: true, organization: true, deadline: true }, take: 10, orderBy: { createdAt: "desc" } });
  return { targetRole: { id: path.targetRole.id, name: path.targetRole.name }, readiness, skills: skills.map(x => ({ name: x.skill.name, proficiency: x.proficiency })), missingSkills, recommendations: missingSkills.slice(0, 3).map(s => `Improve ${s.name} to ${s.requiredLevel}%`), opportunities };
}
