import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiRequest } from "../api/client";
import { displayValue, recordTitle, safeRecordEntries, toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type Kind = "text" | "number" | "date" | "boolean" | "relation";
type Relation = "campuses" | "departments" | "programs" | "academic-years" | "semesters" | "sections" | "courses";
type Field = {
  key: string;
  label: string;
  kind: Kind;
  required?: boolean;
  maxLength?: number;
  relation?: Relation;
  optional?: boolean;
  create?: boolean;
  edit?: boolean;
  initial?: string | boolean;
};
type Config = {
  title: string;
  endpoint: string;
  read: string;
  create?: string;
  update?: string;
  remove?: string;
  fields: Field[];
};
type Row = Record<string, unknown>;
type Values = Record<string, string | boolean>;

const PAGE_SIZE = 50;
const CONFIGS: Record<string, Config> = {
  campuses: {
    title: "Campuses", endpoint: "/campuses", read: "campuses.read", create: "campuses.create", update: "campuses.update", remove: "campuses.delete",
    fields: [
      { key: "name", label: "Campus name", kind: "text", required: true, maxLength: 150 },
      { key: "code", label: "Campus code", kind: "text", required: true, maxLength: 30 },
      { key: "address", label: "Address", kind: "text", optional: true, maxLength: 500 },
      { key: "isActive", label: "Active", kind: "boolean", initial: true },
    ],
  },
  departments: {
    title: "Departments", endpoint: "/departments", read: "departments.read", create: "departments.create", update: "departments.update", remove: "departments.delete",
    fields: [
      { key: "name", label: "Department name", kind: "text", required: true, maxLength: 150 },
      { key: "code", label: "Department code", kind: "text", required: true, maxLength: 20 },
      { key: "campusId", label: "Campus", kind: "relation", relation: "campuses", optional: true },
      { key: "isActive", label: "Active", kind: "boolean", initial: true },
    ],
  },
  programs: {
    title: "Programmes", endpoint: "/programs", read: "programs.read", create: "programs.create", update: "programs.update", remove: "programs.delete",
    fields: [
      { key: "departmentId", label: "Department", kind: "relation", relation: "departments", required: true },
      { key: "name", label: "Programme name", kind: "text", required: true, maxLength: 150 },
      { key: "code", label: "Programme code", kind: "text", required: true, maxLength: 20 },
      { key: "level", label: "Level", kind: "text", required: true, maxLength: 30 },
      { key: "durationYears", label: "Duration (years)", kind: "number", required: true, initial: "3" },
      { key: "isActive", label: "Active", kind: "boolean", initial: true },
    ],
  },
  "academic-years": {
    title: "Academic years", endpoint: "/academic-years", read: "academic-years.read", create: "academic-years.create", update: "academic-years.update",
    fields: [
      { key: "name", label: "Academic year name", kind: "text", required: true, maxLength: 20 },
      { key: "startDate", label: "Start date", kind: "date", required: true },
      { key: "endDate", label: "End date", kind: "date", required: true },
      { key: "isCurrent", label: "Current academic year", kind: "boolean", initial: false },
    ],
  },
  batches: {
    title: "Batches", endpoint: "/batches", read: "batches.read", create: "batches.create", update: "batches.update", remove: "batches.delete",
    fields: [
      { key: "name", label: "Batch name", kind: "text", required: true, maxLength: 150 },
      { key: "code", label: "Batch code", kind: "text", required: true, maxLength: 30 },
      { key: "programId", label: "Programme", kind: "relation", relation: "programs", required: true },
      { key: "admissionYear", label: "Admission year", kind: "number", required: true },
      { key: "completionYear", label: "Completion year", kind: "number", required: true },
      { key: "isActive", label: "Active", kind: "boolean", initial: true, create: false },
    ],
  },
  semesters: {
    title: "Semesters", endpoint: "/semesters", read: "semesters.read", create: "semesters.create", update: "semesters.update", remove: "semesters.delete",
    fields: [
      { key: "programId", label: "Programme", kind: "relation", relation: "programs", required: true, edit: false },
      { key: "academicYearId", label: "Academic year", kind: "relation", relation: "academic-years", required: true, edit: false },
      { key: "number", label: "Semester number", kind: "number", required: true },
      { key: "name", label: "Semester name", kind: "text", required: true, maxLength: 50 },
      { key: "startDate", label: "Start date", kind: "date", optional: true },
      { key: "endDate", label: "End date", kind: "date", optional: true },
      { key: "isActive", label: "Active", kind: "boolean", initial: true },
    ],
  },
  sections: {
    title: "Sections", endpoint: "/sections", read: "sections.read", create: "sections.create", update: "sections.update", remove: "sections.delete",
    fields: [
      { key: "semesterId", label: "Semester", kind: "relation", relation: "semesters", required: true, edit: false },
      { key: "name", label: "Section name", kind: "text", required: true, maxLength: 50 },
      { key: "capacity", label: "Capacity", kind: "number", optional: true },
      { key: "isActive", label: "Active", kind: "boolean", initial: true },
    ],
  },
  courses: {
    title: "Courses", endpoint: "/courses", read: "courses.read", create: "courses.create", update: "courses.update", remove: "courses.delete",
    fields: [
      { key: "departmentId", label: "Department", kind: "relation", relation: "departments", required: true },
      { key: "code", label: "Course code", kind: "text", required: true, maxLength: 20 },
      { key: "name", label: "Course name", kind: "text", required: true, maxLength: 150 },
      { key: "credits", label: "Credits", kind: "number", required: true, initial: "3" },
      { key: "description", label: "Description", kind: "text", optional: true, maxLength: 2000 },
      { key: "isActive", label: "Active", kind: "boolean", initial: true },
    ],
  },
  "course-offerings": {
    title: "Course offerings", endpoint: "/course-offerings", read: "course-offerings.read", create: "course-offerings.create", update: "course-offerings.update", remove: "course-offerings.delete",
    fields: [
      { key: "courseId", label: "Course", kind: "relation", relation: "courses", required: true, edit: false },
      { key: "semesterId", label: "Semester", kind: "relation", relation: "semesters", required: true, edit: false },
      { key: "sectionId", label: "Section", kind: "relation", relation: "sections", required: true, edit: false },
      { key: "capacity", label: "Capacity", kind: "number", optional: true },
      { key: "registrationOpen", label: "Registration open", kind: "boolean", initial: false },
      { key: "isElective", label: "Elective course", kind: "boolean", initial: false },
      { key: "isActive", label: "Active", kind: "boolean", initial: true },
    ],
  },
};

const RELATION_ENDPOINT: Record<Relation, string> = {
  campuses: "/campuses?page=1&pageSize=100",
  departments: "/departments?page=1&pageSize=100",
  programs: "/programs?page=1&pageSize=100",
  "academic-years": "/academic-years?page=1&pageSize=100",
  semesters: "/semesters?page=1&pageSize=100",
  sections: "/sections?page=1&pageSize=100",
  courses: "/courses?page=1&pageSize=100",
};

function object(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}

function rowId(row: Row): string {
  return typeof row.id === "string" ? row.id : "";
}

function optionLabel(row: Row): string {
  const name = typeof row.name === "string" ? row.name : typeof row.title === "string" ? row.title : "";
  const code = typeof row.code === "string" ? row.code : "";
  return [name || code || "Record", name && code ? code : ""].filter(Boolean).join(" · ");
}

function initialValues(config: Config, editing: boolean): Values {
  const values: Values = {};
  for (const field of config.fields) {
    if (editing && field.edit === false) continue;
    if (!editing && field.create === false) continue;
    if (field.kind === "boolean") values[field.key] = typeof field.initial === "boolean" ? field.initial : false;
    else values[field.key] = typeof field.initial === "string" ? field.initial : "";
  }
  return values;
}

function valuesForRow(config: Config, row: Row): Values {
  const values = initialValues(config, true);
  for (const field of config.fields) {
    if (field.edit === false) continue;
    const raw = row[field.key];
    if (field.kind === "boolean") values[field.key] = raw === true;
    else if (field.kind === "date") values[field.key] = typeof raw === "string" ? raw.slice(0, 10) : "";
    else values[field.key] = typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
  }
  return values;
}

function createPayload(config: Config, values: Values, editing: boolean): Row {
  const payload: Row = {};
  for (const field of config.fields) {
    if (editing && field.edit === false) continue;
    if (!editing && field.create === false) continue;
    const raw = values[field.key];
    if (field.kind === "boolean") {
      if (raw !== undefined) payload[field.key] = raw === true;
      continue;
    }
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) {
      if (field.required) throw new Error(field.label + " is required.");
      // A blank optional campus selection intentionally clears that relation on update.
      if (editing && field.key === "campusId" && config.endpoint === "/departments") payload[field.key] = null;
      continue;
    }
    if (field.kind === "number") {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) throw new Error(field.label + " must be a valid number.");
      payload[field.key] = numeric;
    } else if (field.kind === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(value + "T00:00:00.000Z").getTime())) {
        throw new Error(field.label + " must use YYYY-MM-DD.");
      }
      payload[field.key] = value + "T00:00:00.000Z";
    } else {
      if (field.maxLength && value.length > field.maxLength) throw new Error(field.label + " cannot exceed " + field.maxLength + " characters.");
      payload[field.key] = value;
    }
  }
  if (!Object.keys(payload).length) throw new Error("Enter at least one field before saving.");
  if (config.endpoint === "/academic-years") {
    const start = String(payload.startDate || "");
    const end = String(payload.endDate || "");
    if (start && end && new Date(end).getTime() <= new Date(start).getTime()) {
      throw new Error("End date must be after start date.");
    }
  }
  if (config.endpoint === "/batches" && Number(payload.completionYear) <= Number(payload.admissionYear)) {
    throw new Error("Completion year must be after admission year.");
  }
  return payload;
}

export function supportsAcademicRecords(moduleId: string): boolean {
  return Object.prototype.hasOwnProperty.call(CONFIGS, moduleId);
}

export function AcademicRecordsScreen({ moduleId }: { moduleId: string }) {
  const { user } = useAuth();
  const { context } = useWorkspaceContext();
  const queryClient = useQueryClient();
  const config = CONFIGS[moduleId];
  const workspaceKey = JSON.stringify(context?.scope ?? {});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [editing, setEditing] = useState<Row | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [values, setValues] = useState<Values>(() => config ? initialValues(config, false) : {});
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const requiredRelations = useMemo(() => new Set((config?.fields || []).map((field) => field.relation).filter((value): value is Relation => Boolean(value))), [config]);
  const listQuery = useQuery({
    queryKey: ["academic-records", user?.id, workspaceKey, moduleId, page, search],
    queryFn: () => apiRequest<unknown>(config!.endpoint + "?page=" + page + "&pageSize=" + PAGE_SIZE + (search.trim() ? "&search=" + encodeURIComponent(search.trim()) : "")),
    enabled: Boolean(user?.id && config && user.permissions.includes(config.read)),
    staleTime: 0,
  });
  const campuses = useQuery({ queryKey: ["academic-options", user?.id, workspaceKey, "campuses"], queryFn: () => apiRequest<unknown>(RELATION_ENDPOINT.campuses), enabled: Boolean(user?.id && requiredRelations.has("campuses") && user.permissions.includes("campuses.read")), staleTime: 0 });
  const departments = useQuery({ queryKey: ["academic-options", user?.id, workspaceKey, "departments"], queryFn: () => apiRequest<unknown>(RELATION_ENDPOINT.departments), enabled: Boolean(user?.id && requiredRelations.has("departments") && user.permissions.includes("departments.read")), staleTime: 0 });
  const programs = useQuery({ queryKey: ["academic-options", user?.id, workspaceKey, "programs"], queryFn: () => apiRequest<unknown>(RELATION_ENDPOINT.programs), enabled: Boolean(user?.id && requiredRelations.has("programs") && user.permissions.includes("programs.read")), staleTime: 0 });
  const years = useQuery({ queryKey: ["academic-options", user?.id, workspaceKey, "academic-years"], queryFn: () => apiRequest<unknown>(RELATION_ENDPOINT["academic-years"]), enabled: Boolean(user?.id && requiredRelations.has("academic-years") && user.permissions.includes("academic-years.read")), staleTime: 0 });
  const semesters = useQuery({ queryKey: ["academic-options", user?.id, workspaceKey, "semesters"], queryFn: () => apiRequest<unknown>(RELATION_ENDPOINT.semesters), enabled: Boolean(user?.id && requiredRelations.has("semesters") && user.permissions.includes("semesters.read")), staleTime: 0 });
  const sections = useQuery({ queryKey: ["academic-options", user?.id, workspaceKey, "sections"], queryFn: () => apiRequest<unknown>(RELATION_ENDPOINT.sections), enabled: Boolean(user?.id && requiredRelations.has("sections") && user.permissions.includes("sections.read")), staleTime: 0 });
  const courses = useQuery({ queryKey: ["academic-options", user?.id, workspaceKey, "courses"], queryFn: () => apiRequest<unknown>(RELATION_ENDPOINT.courses), enabled: Boolean(user?.id && requiredRelations.has("courses") && user.permissions.includes("courses.read")), staleTime: 0 });

  const relationQueries = { campuses, departments, programs, "academic-years": years, semesters, sections, courses };
  const relationRows = (relation: Relation) => toCollection(relationQueries[relation].data).map(object);
  const rows = useMemo(() => {
    const loaded = toCollection(listQuery.data).map(object);
    return loaded.sort((left, right) => {
      const leftName = recordTitle(left, rowId(left)).toLowerCase();
      const rightName = recordTitle(right, rowId(right)).toLowerCase();
      return sort === "asc" ? leftName.localeCompare(rightName) : rightName.localeCompare(leftName);
    });
  }, [listQuery.data, sort]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["academic-records", user?.id, workspaceKey, moduleId] }),
      queryClient.invalidateQueries({ queryKey: ["academic-options", user?.id, workspaceKey] }),
      queryClient.invalidateQueries({ queryKey: ["module", user?.id, workspaceKey] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-work", user?.id, workspaceKey] }),
    ]);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!config || !user) throw new Error("The active module is unavailable.");
      const payload = createPayload(config, values, Boolean(editing));
      const permission = editing ? config.update : config.create;
      if (!permission || !user.permissions.includes(permission)) throw new Error("Your session does not permit this operation.");
      return apiRequest<unknown>(editing ? config.endpoint + "/" + encodeURIComponent(rowId(editing)) : config.endpoint, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      setError("");
      setFeedback(editing ? "Record updated successfully." : "Record created successfully.");
      setShowForm(false);
      setEditing(null);
      if (config) setValues(initialValues(config, false));
      await invalidate();
    },
    onError: (reason: unknown) => setError(reason instanceof Error ? reason.message : "The record could not be saved."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (!config || !user || !config.remove || !user.permissions.includes(config.remove)) throw new Error("Your session does not permit deactivation.");
      return apiRequest<unknown>(config.endpoint + "/" + encodeURIComponent(id), { method: "DELETE" });
    },
    onSuccess: async () => {
      setError("");
      setFeedback("Record deactivated successfully.");
      if (editing) { setEditing(null); setShowForm(false); }
      await invalidate();
    },
    onError: (reason: unknown) => setError(reason instanceof Error ? reason.message : "The record could not be deactivated."),
  });

  const beginCreate = () => {
    if (!config) return;
    setEditing(null);
    setValues(initialValues(config, false));
    setError("");
    setFeedback("");
    setShowForm(true);
  };

  const beginEdit = (row: Row) => {
    if (!config) return;
    setEditing(row);
    setValues(valuesForRow(config, row));
    setError("");
    setFeedback("");
    setShowForm(true);
  };

  const askRemove = (row: Row) => {
    const id = rowId(row);
    if (!id || !config) return;
    const heading = recordTitle(row, config.title.slice(0, -1));
    Alert.alert("Deactivate " + heading + "?", "The existing ACADLYX endpoint will validate your permission, scope and record state before changing anything.", [
      { text: "Cancel", style: "cancel" },
      { text: "Deactivate", style: "destructive", onPress: () => remove.mutate(id) },
    ]);
  };

  if (!config) return null;
  const canRead = Boolean(user?.permissions.includes(config.read));
  const canCreate = Boolean(config.create && user?.permissions.includes(config.create));
  const canUpdate = Boolean(config.update && user?.permissions.includes(config.update));
  const canRemove = Boolean(config.remove && user?.permissions.includes(config.remove));
  const isBusy = save.isPending || remove.isPending;
  const formFields = config.fields.filter((field) => editing ? field.edit !== false : field.create !== false);
  const listItems = rows;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={listQuery.isRefetching} onRefresh={() => { void listQuery.refetch(); }} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ACADEMIC ADMINISTRATION</Text>
          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.subtitle}>Records use the existing ACADLYX API, server validation and active academic workspace. Mutations require the exact permission for this operation.</Text>
          <TextInput accessibilityLabel={"Search " + config.title} value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} style={styles.search} placeholder="Search records" placeholderTextColor={colors.textMuted} returnKeyType="search" />
          <View style={styles.toolbar}>
            <Text style={styles.muted}>{listQuery.isLoading ? "Loading records…" : listQuery.isError ? "Records unavailable" : listItems.length + " records on page " + page}</Text>
            <Pressable accessibilityRole="button" onPress={() => setSort((value) => value === "asc" ? "desc" : "asc")} style={styles.secondary}><Text style={styles.secondaryText}>Sort: {sort === "asc" ? "A–Z" : "Z–A"}</Text></Pressable>
          </View>
          {canCreate ? <Pressable accessibilityRole="button" onPress={beginCreate} style={styles.primary}><Text style={styles.primaryText}>Create record</Text></Pressable> : null}
        </View>

        {feedback ? <Text accessibilityRole="text" style={styles.success}>{feedback}</Text> : null}
        {error ? <View accessibilityRole="alert" style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        {!canRead ? <View style={styles.state}><Text style={styles.stateTitle}>Read access not granted</Text><Text style={styles.muted}>Your session does not include {config.read}. Ask an administrator to review role, scope and module entitlement.</Text></View> : null}
        {canRead && listQuery.isLoading ? <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Loading authorized records…</Text></View> : null}
        {canRead && listQuery.isError ? <View style={styles.state}><Text style={styles.stateTitle}>{listQuery.error instanceof ApiError && listQuery.error.status === 403 ? "Access not granted" : "Could not load records"}</Text><Text style={styles.muted}>{listQuery.error instanceof Error ? listQuery.error.message : "The request failed. Try again."}</Text><Pressable onPress={() => { void listQuery.refetch(); }} style={styles.secondary}><Text style={styles.secondaryText}>Retry</Text></Pressable></View> : null}

        {showForm && (editing ? canUpdate : canCreate) ? <View style={styles.form}>
          <Text style={styles.formTitle}>{editing ? "Edit record" : "Create " + config.title.toLowerCase().replace(/s$/, "")}</Text>
          {formFields.map((field) => {
            const value = values[field.key];
            if (field.kind === "boolean") {
              return <Pressable key={field.key} accessibilityRole="checkbox" accessibilityState={{ checked: value === true }} onPress={() => setValues((previous) => ({ ...previous, [field.key]: value !== true }))} style={styles.booleanRow}><View style={[styles.check, value === true ? styles.checked : null]}><Text style={styles.checkMark}>{value === true ? "✓" : ""}</Text></View><Text style={styles.fieldLabel}>{field.label}</Text></Pressable>;
            }
            if (field.kind === "relation" && field.relation) {
              const optionsQuery = relationQueries[field.relation];
              const options = relationRows(field.relation);
              return <View key={field.key} style={styles.formField}><Text style={styles.fieldLabel}>{field.label}{field.required ? " *" : ""}</Text>
                {field.optional ? <Pressable accessibilityRole="button" onPress={() => setValues((previous) => ({ ...previous, [field.key]: "" }))} style={[styles.choice, !value ? styles.choiceSelected : null]}><Text style={[styles.choiceText, !value ? styles.choiceTextSelected : null]}>No selection</Text></Pressable> : null}
                {optionsQuery.isLoading ? <Text style={styles.muted}>Loading authorized choices…</Text> : optionsQuery.isError ? <Text style={styles.inlineError}>Options unavailable: {optionsQuery.error instanceof Error ? optionsQuery.error.message : "request failed"}</Text> : options.length ? <View style={styles.choiceList}>{options.map((option) => { const id = rowId(option); const selected = value === id; return <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setValues((previous) => ({ ...previous, [field.key]: id }))} style={[styles.choice, selected ? styles.choiceSelected : null]}><Text style={[styles.choiceText, selected ? styles.choiceTextSelected : null]}>{optionLabel(option)}</Text></Pressable>; })}</View> : <Text style={styles.muted}>No authorized options are available. Raw record IDs are not accepted as a manual substitute.</Text>}
              </View>;
            }
            return <View key={field.key} style={styles.formField}><Text style={styles.fieldLabel}>{field.label}{field.required ? " *" : ""}</Text><TextInput accessibilityLabel={field.label} value={typeof value === "string" ? value : ""} onChangeText={(next) => setValues((previous) => ({ ...previous, [field.key]: next }))} style={styles.input} placeholder={field.kind === "date" ? "YYYY-MM-DD" : field.label} placeholderTextColor={colors.textMuted} autoCapitalize={field.key === "code" ? "characters" : "sentences"} keyboardType={field.kind === "number" ? "decimal-pad" : "default"} maxLength={field.maxLength} editable={!isBusy} />{field.kind === "date" ? <Text style={styles.hint}>Enter a valid date as YYYY-MM-DD.</Text> : null}</View>;
          })}
          <View style={styles.formActions}><Pressable accessibilityRole="button" disabled={isBusy} onPress={() => save.mutate()} style={[styles.primary, isBusy ? styles.disabled : null]}><Text style={styles.primaryText}>{save.isPending ? "Saving…" : editing ? "Save changes" : "Create record"}</Text></Pressable><Pressable accessibilityRole="button" disabled={isBusy} onPress={() => { setShowForm(false); setEditing(null); setError(""); }} style={styles.secondary}><Text style={styles.secondaryText}>Cancel</Text></Pressable></View>
        </View> : null}

        {canRead && !listQuery.isLoading && !listQuery.isError && !listItems.length ? <View style={styles.state}><Text style={styles.stateTitle}>No records found</Text><Text style={styles.muted}>No records match the active search and authorized workspace.</Text>{canCreate ? <Pressable onPress={beginCreate} style={styles.primary}><Text style={styles.primaryText}>Create the first record</Text></Pressable> : null}</View> : null}
        {canRead ? listItems.map((row, index) => {
          const id = rowId(row);
          const title = recordTitle(row, config.title.slice(0, -1) + " " + String(index + 1));
          const fields = safeRecordEntries(row).filter(([key]) => !["createdAt", "updatedAt", "deletedAt"].includes(key)).slice(0, 4);
          return <View key={id || title + index} style={styles.record}>
            <View style={styles.recordHeader}><Text style={styles.recordTitle}>{title}</Text><Text style={[styles.status, row.isActive === false ? styles.inactive : styles.active]}>{row.isActive === false ? "INACTIVE" : "RECORD"}</Text></View>
            {fields.map(([key, value]) => <View key={key} style={styles.recordField}><Text style={styles.detailLabel}>{key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ")}</Text><Text style={styles.detailValue}>{displayValue(value)}</Text></View>)}
            <View style={styles.recordActions}>{canUpdate ? <Pressable accessibilityRole="button" onPress={() => beginEdit(row)} style={styles.secondary}><Text style={styles.secondaryText}>Edit</Text></Pressable> : null}{canRemove ? <Pressable accessibilityRole="button" disabled={isBusy} onPress={() => askRemove(row)} style={styles.danger}><Text style={styles.dangerText}>{remove.isPending && remove.variables === id ? "Deactivating…" : "Deactivate"}</Text></Pressable> : null}</View>
          </View>;
        }) : null}

        {canRead && !listQuery.isLoading && !listQuery.isError ? <View style={styles.pagination}><Pressable accessibilityRole="button" disabled={page <= 1 || listQuery.isFetching} onPress={() => setPage((value) => Math.max(1, value - 1))} style={[styles.secondary, page <= 1 ? styles.disabled : null]}><Text style={styles.secondaryText}>Previous</Text></Pressable><Text style={styles.muted}>Page {page}</Text><Pressable accessibilityRole="button" disabled={listItems.length < PAGE_SIZE || listQuery.isFetching} onPress={() => setPage((value) => value + 1)} style={[styles.secondary, listItems.length < PAGE_SIZE ? styles.disabled : null]}><Text style={styles.secondaryText}>Next</Text></Pressable></View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: spacing.xl },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: 10 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  search: { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 11, marginTop: 2 },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  muted: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  state: { alignItems: "center", justifyContent: "center", gap: 10, padding: spacing.xl },
  stateTitle: { color: colors.text, fontSize: 16, fontWeight: "800", textAlign: "center" },
  primary: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 11, paddingHorizontal: 15, alignItems: "center", justifyContent: "center" },
  primaryText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  secondary: { borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  form: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, gap: 13 },
  formTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  formField: { gap: 7 },
  fieldLabel: { color: colors.text, fontSize: 12, fontWeight: "800" },
  input: { borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 11, paddingVertical: 10, color: colors.text, backgroundColor: colors.surface, fontSize: 13 },
  hint: { color: colors.textMuted, fontSize: 10 },
  choiceList: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  choice: { borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 9, paddingVertical: 8, marginRight: 4, marginBottom: 4 },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  choiceText: { color: colors.text, fontSize: 11, fontWeight: "700" },
  choiceTextSelected: { color: colors.primary, fontWeight: "900" },
  booleanRow: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 3 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  checked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: colors.white, fontSize: 14, fontWeight: "900" },
  formActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  errorBox: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, borderColor: colors.danger, borderWidth: 1, borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.md },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 18 },
  inlineError: { color: colors.danger, fontSize: 11 },
  success: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, color: colors.success, fontSize: 12, fontWeight: "800" },
  record: { marginHorizontal: spacing.lg, marginBottom: 10, padding: spacing.md, borderRadius: radius.md, borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surface, gap: 8 },
  recordHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  recordTitle: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "900" },
  status: { fontSize: 9, fontWeight: "900", borderRadius: 20, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4 },
  active: { color: colors.primary, backgroundColor: colors.primarySoft },
  inactive: { color: colors.danger, backgroundColor: colors.surfaceMuted },
  recordField: { borderTopColor: colors.surfaceMuted, borderTopWidth: 1, paddingTop: 7 },
  detailLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
  detailValue: { color: colors.text, fontSize: 12, lineHeight: 18, marginTop: 2 },
  recordActions: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, marginTop: 5 },
  danger: { borderColor: colors.danger, borderWidth: 1, borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 12, alignItems: "center" },
  dangerText: { color: colors.danger, fontSize: 11, fontWeight: "900" },
  pagination: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, paddingVertical: spacing.md },
});
