"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, getCachedCurrentUser, getCurrentUser } from "@/lib/auth";
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

function can(user: ReturnType<typeof getCachedCurrentUser>, permission: string) {
  return Boolean(user?.permissions.includes(permission));
}

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
  const [tab, setTab] = useState<Tab>("outcomes");
  const [offerings, setOfferings] = useState<ObeOffering[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [courseOutcomes, setCourseOutcomes] = useState<CourseOutcome[]>([]);
  const [programmeOutcomes, setProgrammeOutcomes] = useState<ProgrammeOutcome[]>([]);
  const [mappings, setMappings] = useState<Record<string, number>>({});
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

  const normalizedRole = user?.roles?.[0]?.toUpperCase() ?? "";
  const isStudent = normalizedRole === "STUDENT";
  const canEditMapping = !isStudent && can(user, "obe.mapping.manage");
  const canManageAssessment = can(user, "obe.assessment.manage");
  const canCalculate = can(user, "obe.attainment.calculate");

  const loadOfferings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listObeOfferings();
      setOfferings(data);
      setSelectedOfferingId((current) => current || data[0]?.id || "");
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Unable to load OBE course offerings.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const loadSelected = useCallback(async () => {
    if (!selectedOffering) return;
    setWorking(true);
    setError("");
    try {
      const [mapping, assessmentRows, attainmentRows] = await Promise.all([
        getMapping(selectedOffering.id),
        listObeAssessments(selectedOffering.id),
        getAttainment(selectedOffering.id),
      ]);
      setCourseOutcomes(mapping.outcomes);
      setProgrammeOutcomes(mapping.programmeOutcomes);
      const matrix: Record<string, number> = {};
      mapping.mappings.forEach((row) => {
        matrix[`${row.courseOutcomeId}:${row.programmeOutcomeId}`] = row.level;
      });
      setMappings(matrix);
      setAssessments(assessmentRows);
      setAttainment(attainmentRows.items);
      setItemDrafts([]);
      setSelectedItemId("");
      setScoreRows([]);
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Unable to load OBE data.");
    } finally {
      setWorking(false);
    }
  }, [router, selectedOffering]);

  useEffect(() => {
    void getCurrentUser().then(setUser).catch(() => undefined);
    void loadOfferings();
  }, [loadOfferings]);

  useEffect(() => {
    void loadSelected();
  }, [loadSelected]);

  async function saveProgrammeOutcome() {
    if (!selectedOffering || !poCode.trim() || !poDescription.trim()) return;
    setWorking(true); setError(""); setMessage("");
    try {
      await createProgrammeOutcome(selectedOffering.semester.programId, {
        type: poType,
        code: poCode.trim().toUpperCase(),
        description: poDescription.trim(),
        displayOrder: programmeOutcomes.length,
      });
      setPoCode(""); setPoDescription("");
      setMessage(`${poType} created.`);
      await loadSelected();
    } catch (err) { setError(err instanceof Error ? err.message : `Unable to create ${poType}.`); }
    finally { setWorking(false); }
  }

  async function saveCourseOutcome() {
    if (!selectedOffering || !coCode.trim() || !coStatement.trim()) return;
    setWorking(true); setError(""); setMessage("");
    try {
      await createCourseOutcome(selectedOffering.course.id, {
        code: coCode.trim().toUpperCase(),
        statement: coStatement.trim(),
        bloomLevel: coBloom.trim() || undefined,
        displayOrder: courseOutcomes.length,
      });
      setCoCode(""); setCoStatement(""); setCoBloom("");
      setMessage("Course outcome created.");
      await loadSelected();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to create course outcome."); }
    finally { setWorking(false); }
  }

  function setMappingLevel(coId: string, poId: string, level: number) {
    setMappings((current) => ({ ...current, [`${coId}:${poId}`]: level }));
  }

  async function saveMapping() {
    if (!selectedOffering) return;
    setWorking(true); setError(""); setMessage("");
    try {
      const rows = Object.entries(mappings).map(([key, level]) => {
        const [courseOutcomeId, programmeOutcomeId] = key.split(":");
        return { courseOutcomeId, programmeOutcomeId, level };
      });
      await replaceMapping(selectedOffering.id, rows);
      setMessage("CO–PO/PSO mapping saved as draft.");
      await loadSelected();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save mapping."); }
    finally { setWorking(false); }
  }

  async function submitCurrentMapping() {
    if (!selectedOffering) return;
    setWorking(true); setError(""); setMessage("");
    try { await submitMapping(selectedOffering.id); setMessage("Mapping submitted for review."); await loadSelected(); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to submit mapping."); }
    finally { setWorking(false); }
  }

  async function createAssessment() {
    if (!selectedOffering || !assessmentName.trim()) return;
    setWorking(true); setError(""); setMessage("");
    try {
      const assessment = await createObeAssessment({
        courseOfferingId: selectedOffering.id,
        name: assessmentName.trim(),
        type: assessmentType,
        maxMarks: Number(assessmentMarks),
      });
      setAssessments((current) => [...current, assessment]);
      setAssessmentName("");
      setMessage("OBE assessment created. Add question/CO mapping next.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to create assessment."); }
    finally { setWorking(false); }
  }

  function addItemDraft() {
    setItemDrafts((current) => [...current, { itemCode: `Q${current.length + 1}`, description: "", maxMarks: "5", courseOutcomeId: courseOutcomes[0]?.id ?? "" }]);
  }

  async function saveAssessmentItems(assessment: ObeAssessment) {
    setWorking(true); setError(""); setMessage("");
    try {
      const items = itemDrafts.filter((item) => item.courseOutcomeId && item.itemCode.trim()).map((item, index) => ({ itemCode: item.itemCode.trim(), description: item.description.trim() || undefined, maxMarks: Number(item.maxMarks), courseOutcomeId: item.courseOutcomeId, displayOrder: index }));
      await replaceAssessmentItems(assessment.id, items);
      setMessage("Assessment-to-CO mapping saved.");
      await loadSelected();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save assessment mapping."); }
    finally { setWorking(false); }
  }

  async function publishAssessment(assessment: ObeAssessment) {
    setWorking(true); setError(""); setMessage("");
    try { await updateObeAssessment(assessment.id, "PUBLISHED"); setMessage("Assessment published for attainment calculation."); await loadSelected(); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to publish assessment."); }
    finally { setWorking(false); }
  }

  async function openScores(itemId: string) {
    setSelectedItemId(itemId); setWorking(true); setError("");
    try {
      const data = await getAssessmentItemScores(itemId);
      const byStudent = new Map(data.scores.map((score) => [score.studentId, score]));
      setScoreRows(data.roster.map((student) => ({ ...student, marksObtained: byStudent.get(student.studentId)?.marksObtained?.toString() ?? "", isAbsent: byStudent.get(student.studentId)?.isAbsent ?? false })));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load assessment scores."); }
    finally { setWorking(false); }
  }

  async function saveScores() {
    if (!selectedItemId) return;
    setWorking(true); setError(""); setMessage("");
    try {
      await replaceAssessmentItemScores(selectedItemId, scoreRows.filter((row) => row.marksObtained !== "").map((row) => ({ studentId: row.studentId, marksObtained: Number(row.marksObtained), isAbsent: row.isAbsent })));
      setMessage("Assessment scores saved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save scores."); }
    finally { setWorking(false); }
  }

  async function runProgrammeCalculation() {
    if (!selectedOffering) return;
    setWorking(true); setError(""); setMessage("");
    try {
      await calculateProgrammeAttainment({ programId: selectedOffering.semester.programId, academicYearId: selectedOffering.semester.academicYear.id, semesterId: selectedOffering.semester.id });
      setMessage("Programme PO/PSO attainment run calculated. The run is stored separately for historical traceability.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to calculate programme attainment."); }
    finally { setWorking(false); }
  }

  async function runCalculation() {
    if (!selectedOffering) return;
    setWorking(true); setError(""); setMessage("");
    try { const data = await calculateAttainment(selectedOffering.id); setAttainment(data.items); setMessage("CO attainment recalculated from the current assessment evidence."); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to calculate attainment."); }
    finally { setWorking(false); }
  }

  const tabs: Array<{ id: Tab; label: string }> = isStudent
    ? [{ id: "attainment", label: "My Outcome Attainment" }]
    : [
        { id: "outcomes", label: "Course Outcomes" },
        { id: "mapping", label: "CO–PO / PSO Mapping" },
        { id: "assessments", label: "Assessments" },
        { id: "attainment", label: "CO Attainment" },
      ];

  return (
    <DashboardShell
      title="Outcome Based Education"
      subtitle="CO–PO/PSO mapping, assessment evidence and attainment"
      allowedRoles={["CHAIRMAN", "DIRECTOR", "DEAN", "REGISTRAR", "HOD", "FACULTY", "EXAMINATION", "STUDENT"]}
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-acadlyx-primary">Academic outcomes</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">OBE workspace</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">Configure course outcomes, map them to programme outcomes, connect assessment questions to COs, enter evidence and calculate attainment. Authority remains role and scope controlled by the API.</p>
            </div>
            <div className="min-w-[320px]">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Course offering</label>
              <select value={selectedOfferingId} onChange={(e) => setSelectedOfferingId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500">
                <option value="">Select a course offering</option>
                {offerings.map((offering) => <option key={offering.id} value={offering.id}>{offering.course.code} — {offering.course.name} · {offering.semester.name} · {offering.section.name}</option>)}
              </select>
            </div>
          </div>
        </section>

        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</div>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div>}

        {loading && <DashboardCard><p className="text-sm text-slate-500">Loading OBE workspace…</p></DashboardCard>}

        {!loading && !selectedOffering && <DashboardCard><p className="font-bold text-slate-900">No accessible course offerings</p><p className="mt-1 text-sm text-slate-500">Faculty see assigned offerings; HODs see their department; leadership sees institution-scoped offerings.</p></DashboardCard>}

        {selectedOffering && (
          <>
            <section className="grid gap-4 sm:grid-cols-4">
              <DashboardCard><p className="text-xs font-bold uppercase text-slate-400">Course</p><p className="mt-1 font-black text-slate-950">{selectedOffering.course.code}</p><p className="text-xs text-slate-500">{selectedOffering.course.name}</p></DashboardCard>
              <DashboardCard><p className="text-xs font-bold uppercase text-slate-400">Programme</p><p className="mt-1 font-black text-slate-950">{selectedOffering.semester.program.code}</p><p className="text-xs text-slate-500">{selectedOffering.semester.program.name}</p></DashboardCard>
              <DashboardCard><p className="text-xs font-bold uppercase text-slate-400">Semester</p><p className="mt-1 font-black text-slate-950">{selectedOffering.semester.name}</p><p className="text-xs text-slate-500">Section {selectedOffering.section.name}</p></DashboardCard>
              <DashboardCard><p className="text-xs font-bold uppercase text-slate-400">Attainment rows</p><p className="mt-1 text-3xl font-black text-slate-950">{attainment.length}</p><p className="text-xs text-slate-500">COs currently calculated</p></DashboardCard>
            </section>

            <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              {tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold ${tab === item.id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{item.label}</button>)}
            </div>

            {tab === "outcomes" && (
              <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
                <DashboardCard title="Course outcomes">
                  {courseOutcomes.length === 0 ? <p className="text-sm text-slate-500">No COs have been configured for this course.</p> : <div className="space-y-3">{courseOutcomes.map((co) => <div key={co.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-black text-slate-950">{co.code}</p><p className="mt-1 text-sm text-slate-600">{co.statement}</p></div>{co.bloomLevel && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{co.bloomLevel}</span>}</div></div>)}</div>}
                </DashboardCard>
                {canEditMapping && <DashboardCard title="Add course outcome"><div className="space-y-3"><input value={coCode} onChange={(e) => setCoCode(e.target.value)} placeholder="CO1" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /><textarea value={coStatement} onChange={(e) => setCoStatement(e.target.value)} placeholder="Course outcome statement" rows={4} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /><input value={coBloom} onChange={(e) => setCoBloom(e.target.value)} placeholder="Bloom level e.g. Apply" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /><button disabled={working || !coCode.trim() || !coStatement.trim()} onClick={() => void saveCourseOutcome()} className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Add CO</button></div></DashboardCard>}
              </div>
            )}

            {tab === "mapping" && (
              <div className="space-y-6">
                {can(user, "obe.manage") && <DashboardCard title="Programme Outcomes / PSOs">
                  <div className="grid gap-3 md:grid-cols-[130px_140px_1fr_auto]">
                    <select value={poType} onChange={(e) => setPoType(e.target.value as "PO" | "PSO")} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="PO">PO</option><option value="PSO">PSO</option></select>
                    <input value={poCode} onChange={(e) => setPoCode(e.target.value)} placeholder="PO1 / PSO1" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                    <input value={poDescription} onChange={(e) => setPoDescription(e.target.value)} placeholder="Outcome description" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                    <button disabled={working || !poCode.trim() || !poDescription.trim()} onClick={() => void saveProgrammeOutcome()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Add</button>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">{programmeOutcomes.map((po) => <div key={po.id} className="rounded-xl border border-slate-200 p-3"><span className="font-black">{po.code}</span><span className="ml-2 text-sm text-slate-600">{po.description}</span></div>)}</div>
                </DashboardCard>}
                <DashboardCard title="CO–PO / PSO mapping matrix">
                {courseOutcomes.length === 0 || programmeOutcomes.length === 0 ? <p className="text-sm text-slate-500">Create the course outcomes and programme outcomes before building the matrix.</p> : <div className="overflow-x-auto"><table className="min-w-[760px] w-full border-collapse text-sm"><thead><tr><th className="border border-slate-200 bg-slate-50 p-3 text-left">CO</th>{programmeOutcomes.map((po) => <th key={po.id} className="border border-slate-200 bg-slate-50 p-3 text-center">{po.code}</th>)}</tr></thead><tbody>{courseOutcomes.map((co) => <tr key={co.id}><td className="border border-slate-200 p-3 font-bold text-slate-800">{co.code}</td>{programmeOutcomes.map((po) => { const key = `${co.id}:${po.id}`; const value = mappings[key] ?? 0; return <td key={po.id} className="border border-slate-200 p-2 text-center"><select disabled={!canEditMapping} value={value} onChange={(e) => setMappingLevel(co.id, po.id, Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"><option value={0}>—</option><option value={1}>1 · Low</option><option value={2}>2 · Moderate</option><option value={3}>3 · High</option></select></td>})}</tr>)}</tbody></table><div className="mt-4 flex flex-wrap gap-2">{canEditMapping && <><button disabled={working} onClick={() => void saveMapping()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Save mapping</button><button disabled={working} onClick={() => void submitCurrentMapping()} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Submit for review</button></>}</div></div>}
              </DashboardCard>
              </div>
            )}

            {tab === "assessments" && (
              <div className="space-y-6">
                {canManageAssessment && <DashboardCard title="Create assessment"><div className="grid gap-3 md:grid-cols-4"><input value={assessmentName} onChange={(e) => setAssessmentName(e.target.value)} placeholder="Internal Assessment 1" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" /><select value={assessmentType} onChange={(e) => setAssessmentType(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"><option>INTERNAL</option><option>QUIZ</option><option>ASSIGNMENT</option><option>MID_TERM</option><option>END_TERM</option><option>PRACTICAL</option><option>PROJECT</option></select><input type="number" value={assessmentMarks} onChange={(e) => setAssessmentMarks(e.target.value)} min="1" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" /><button disabled={working || !assessmentName.trim()} onClick={() => void createAssessment()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Create</button></div></DashboardCard>}
                {assessments.length === 0 && <DashboardCard><p className="text-sm text-slate-500">No OBE assessments created for this course offering.</p></DashboardCard>}
                {assessments.map((assessment) => <AssessmentCard key={assessment.id} assessment={assessment} courseOutcomes={courseOutcomes} canManage={canManageAssessment} working={working} itemDrafts={itemDrafts} setItemDrafts={setItemDrafts} onAddItem={addItemDraft} onSaveItems={saveAssessmentItems} onPublish={publishAssessment} onOpenScores={openScores} selectedItemId={selectedItemId} scoreRows={scoreRows} setScoreRows={setScoreRows} onSaveScores={saveScores} />)}
              </div>
            )}

            {tab === "attainment" && <DashboardCard title="CO attainment"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">Current calculation from published/locked assessment evidence and the active OBE policy.</p>{canCalculate && <div className="flex flex-wrap gap-2"><button disabled={working} onClick={() => void runCalculation()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{working ? "Calculating…" : "Recalculate CO attainment"}</button>{can(user, "obe.attainment.approve") && <button disabled={working} onClick={() => void runProgrammeCalculation()} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Calculate PO / PSO run</button>}</div>}</div>{attainment.length === 0 ? <p className="text-sm text-slate-500">No attainment has been calculated yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-sm"><thead><tr>{["CO", "Direct", "Indirect", "Final", "Level", "Students assessed", "Meeting target"].map((heading) => <th key={heading} className="border border-slate-200 bg-slate-50 p-3 text-left">{heading}</th>)}</tr></thead><tbody>{attainment.map((row) => <tr key={row.id}><td className="border border-slate-200 p-3"><span className="font-black">{row.courseOutcome.code}</span><span className="ml-2 text-xs text-slate-500">{row.courseOutcome.statement}</span></td><td className="border border-slate-200 p-3">{row.directAttainment ?? "—"}</td><td className="border border-slate-200 p-3">{row.indirectAttainment ?? "—"}</td><td className="border border-slate-200 p-3 font-black">{row.finalAttainment === null ? "—" : row.finalAttainment.toFixed(2)}</td><td className="border border-slate-200 p-3 font-bold">{levelLabel(row.attainmentLevel)}</td><td className="border border-slate-200 p-3">{row.studentsAssessed}/{row.studentCount}</td><td className="border border-slate-200 p-3">{row.studentsMeetingTarget}</td></tr>)}</tbody></table></div>}</DashboardCard>}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function AssessmentCard({ assessment, courseOutcomes, canManage, working, itemDrafts, setItemDrafts, onAddItem, onSaveItems, onPublish, onOpenScores, selectedItemId, scoreRows, setScoreRows, onSaveScores }: {
  assessment: ObeAssessment;
  courseOutcomes: CourseOutcome[];
  canManage: boolean;
  working: boolean;
  itemDrafts: ItemDraft[];
  setItemDrafts: Dispatch<SetStateAction<ItemDraft[]>>;
  onAddItem: () => void;
  onSaveItems: (assessment: ObeAssessment) => void;
  onPublish: (assessment: ObeAssessment) => void;
  onOpenScores: (itemId: string) => void;
  selectedItemId: string;
  scoreRows: Array<{ studentId: string; firstName: string; lastName: string; rollNumber?: string | null; marksObtained: string; isAbsent: boolean }>;
  setScoreRows: Dispatch<SetStateAction<Array<{ studentId: string; firstName: string; lastName: string; rollNumber?: string | null; marksObtained: string; isAbsent: boolean }>>>;
  onSaveScores: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const startEditing = () => {
    setItemDrafts(assessment.items.map((item) => ({ itemCode: item.itemCode, description: item.description ?? "", maxMarks: String(item.maxMarks), courseOutcomeId: item.courseOutcome.id })));
    setEditing(true);
  };
  return <DashboardCard>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black text-slate-950">{assessment.name}</p><p className="mt-1 text-xs text-slate-500">{assessment.type} · Max {assessment.maxMarks} · {assessment.status}</p></div>{canManage && <div className="flex gap-2">{assessment.status === "DRAFT" && <button onClick={() => { startEditing(); }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold">Map questions</button>}{assessment.status === "DRAFT" && assessment.items.length > 0 && <button disabled={working} onClick={() => void onPublish(assessment)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">Publish</button>}</div>}</div>
    {assessment.items.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr><th className="border border-slate-200 bg-slate-50 p-2 text-left">Item</th><th className="border border-slate-200 bg-slate-50 p-2 text-left">CO</th><th className="border border-slate-200 bg-slate-50 p-2 text-left">Max</th><th className="border border-slate-200 bg-slate-50 p-2">Evidence</th></tr></thead><tbody>{assessment.items.map((item) => <tr key={item.id}><td className="border border-slate-200 p-2 font-bold">{item.itemCode}</td><td className="border border-slate-200 p-2">{item.courseOutcome.code}</td><td className="border border-slate-200 p-2">{item.maxMarks}</td><td className="border border-slate-200 p-2 text-center">{canManage && <button onClick={() => void onOpenScores(item.id)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold">Enter scores</button>}</td></tr>)}</tbody></table></div>}
    {editing && canManage && <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/40 p-4"><div className="flex items-center justify-between"><p className="font-bold text-slate-900">Assessment → CO mapping</p><button onClick={onAddItem} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold">Add question</button></div><div className="mt-3 space-y-2">{itemDrafts.map((item, index) => <div key={`${item.itemCode}-${index}`} className="grid gap-2 md:grid-cols-[100px_1fr_100px_180px]"><input value={item.itemCode} onChange={(e) => setItemDrafts((rows) => rows.map((row, i) => i === index ? { ...row, itemCode: e.target.value } : row))} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" /><input value={item.description} onChange={(e) => setItemDrafts((rows) => rows.map((row, i) => i === index ? { ...row, description: e.target.value } : row))} placeholder="Question description" className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" /><input type="number" min="0.1" value={item.maxMarks} onChange={(e) => setItemDrafts((rows) => rows.map((row, i) => i === index ? { ...row, maxMarks: e.target.value } : row))} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" /><select value={item.courseOutcomeId} onChange={(e) => setItemDrafts((rows) => rows.map((row, i) => i === index ? { ...row, courseOutcomeId: e.target.value } : row))} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"><option value="">Select CO</option>{courseOutcomes.map((co) => <option key={co.id} value={co.id}>{co.code}</option>)}</select></div>)}</div><button disabled={working} onClick={() => void onSaveItems(assessment)} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">Save question mapping</button></div>}
    {selectedItemId && assessment.items.some((item) => item.id === selectedItemId) && <div className="mt-5 rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><p className="font-bold text-slate-900">Student scores</p><button disabled={working} onClick={onSaveScores} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">Save scores</button></div><div className="mt-3 max-h-[360px] overflow-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Roll</th><th className="p-2 text-left">Student</th><th className="p-2 text-left">Marks</th><th className="p-2 text-left">Absent</th></tr></thead><tbody>{scoreRows.map((row, index) => <tr key={row.studentId} className="border-t border-slate-100"><td className="p-2 text-xs text-slate-500">{row.rollNumber ?? "—"}</td><td className="p-2 font-semibold">{row.firstName} {row.lastName}</td><td className="p-2"><input value={row.marksObtained} onChange={(e) => setScoreRows((rows) => rows.map((item, i) => i === index ? { ...item, marksObtained: e.target.value } : item))} type="number" min="0" className="w-24 rounded-lg border border-slate-300 px-2 py-1.5" /></td><td className="p-2"><input checked={row.isAbsent} onChange={(e) => setScoreRows((rows) => rows.map((item, i) => i === index ? { ...item, isAbsent: e.target.checked } : item))} type="checkbox" /></td></tr>)}</tbody></table></div></div>}
  </DashboardCard>;
}
