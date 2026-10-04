"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, getCachedCurrentUser, getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/authority";
import {
  calculateAttainment,
  calculateProgrammeAttainment,
  createProgrammeOutcome,
  createCourseOutcome,
  createObeAssessment,
  getAssessmentItemScores,
  getAttainment,
  getMapping,
  listObeAssessments,
  listObeOfferings,
  replaceAssessmentItemScores,
  replaceAssessmentItems,
  replaceMapping,
  submitMapping,
  reviewMapping,
  updateObeAssessment,
  type CourseOutcome,
  type ObeAssessment,
  type ObeAttainment,
  type ObeOffering,
  type ProgrammeOutcome,
} from "@/lib/obeApi";

type Tab = "outcomes" | "mapping" | "assessments" | "attainment";

type ItemDraft = {
  itemCode: string;
  description: string;
  maxMarks: string;
  courseOutcomeId: string;
};

function levelLabel(level: number | null) {
  if (level === null) return "—";
  if (level === 3) return "Level 3";
  if (level === 2) return "Level 2";
  if (level === 1) return "Level 1";
  return "Not attained";
}

export default function ObePage() {
  const router = useRouter();
  const [user, setUser] = useState(getCachedCurrentUser());
  const isStudent = user?.roles?.some((role) => role.trim().toUpperCase() === "STUDENT") ?? false;
  const [tab, setTab] = useState<Tab>("outcomes");
  const [offerings, setOfferings] = useState<ObeOffering[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [courseOutcomes, setCourseOutcomes] = useState<CourseOutcome[]>([]);
  const [programmeOutcomes, setProgrammeOutcomes] = useState<ProgrammeOutcome[]>([]);
  const [mappings, setMappings] = useState<Record<string, number>>({});
  const [mappingStatus, setMappingStatus] = useState<"DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED" | string>("DRAFT");
  const [assessments, setAssessments] = useState<ObeAssessment[]>([]);
  const [attainment, setAttainment] = useState<ObeAttainment[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [scoreRows, setScoreRows] = useState<Array<{ studentId: string; firstName: string; lastName: string; rollNumber?: string | null; marksObtained: string; isAbsent: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [coCode, setCoCode] = useState("");
  const [coStatement, setCoStatement] = useState("");
  const [coBloom, setCoBloom] = useState("");
  const [poCode, setPoCode] = useState("");
  const [poDescription, setPoDescription] = useState("");
  const [poType, setPoType] = useState<"PO" | "PSO">("PO");
  const [assessmentName, setAssessmentName] = useState("");
  const [assessmentType, setAssessmentType] = useState("INTERNAL");
  const [assessmentMarks, setAssessmentMarks] = useState("30");
  const [itemDrafts, setItemDrafts] = useState<ItemDraft[]>([]);

  const selectedOffering = useMemo(
    () => offerings.find((item) => item.id === selectedOfferingId) ?? null,
    [offerings, selectedOfferingId]
  );

  const canEditMapping = hasPermission(user, "obe.mapping.manage") && (mappingStatus === "DRAFT" || mappingStatus === "RETURNED");
  const canSubmitMapping = hasPermission(user, "obe.mapping.submit") && mappingStatus !== "SUBMITTED" && mappingStatus !== "APPROVED";
  const canReviewMapping = hasPermission(user, "obe.attainment.approve") && mappingStatus === "SUBMITTED";
  const canManageAssessment = hasPermission(user, "obe.assessment.manage");
  const canCalculate = hasPermission(user, "obe.attainment.calculate");