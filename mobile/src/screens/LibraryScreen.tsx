import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "../api/client";
import { toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type Book = {
  id: string; title: string; author: string; category?: string | null; isbn?: string | null;
  availableCopies?: number; totalCopies?: number; isActive?: boolean; shelfLocation?: string | null;
  defaultLoanDays?: number; [key: string]: unknown;
};
type Person = { id: string; firstName?: string; lastName?: string; email?: string; idNumber?: string; admissionNumber?: string; [key: string]: unknown };
type Loan = {
  id: string; status: string; dueDate?: string; issuedAt?: string; returnedAt?: string;
  renewalsUsed?: number; renewalsAllowed?: number; financialBalance?: number; note?: string;
  book?: { title?: string; author?: string }; borrower?: { firstName?: string; lastName?: string; email?: string };
  [key: string]: unknown;
};
type Fine = { id: string; amount?: number; status?: string; reason?: string; issue?: { book?: { title?: string } }; [key: string]: unknown };
type Tab = "CATALOGUE" | "MY_LOANS" | "CIRCULATION" | "FINES" | "MANAGE";

function items<T>(value: unknown): T[] { return toCollection(value) as T[]; }
function dateLabel(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString();
}
function personLabel(person: Person): string {
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email || person.idNumber || person.admissionNumber || "Institution member";
}

export function LibraryScreen() {
  const { user } = useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {});
  const client = useQueryClient();
  const canRead = Boolean(user?.permissions.includes("library.read"));
  const canBorrow = Boolean(user?.permissions.includes("library.borrow"));
  const canManage = Boolean(user?.permissions.includes("library.manage"));
  const [tab, setTab] = useState<Tab>("CATALOGUE");
  const [search, setSearch] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [category, setCategory] = useState("");
  const [copies, setCopies] = useState("1");
  const [shelf, setShelf] = useState("");
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string | null>(null);
  const [borrowerSearch, setBorrowerSearch] = useState("");

  const booksQuery = useQuery({
    queryKey: ["library-books", user?.id, workspaceKey, search, availableOnly],
    queryFn: () => apiRequest<unknown>("/library/books?page=1&pageSize=50&search=" + encodeURIComponent(search.trim()) + "&availableOnly=" + String(availableOnly)),
    enabled: Boolean(user?.id),
    staleTime: 0
  });
  const mineQuery = useQuery({
    queryKey: ["library-my-loans", user?.id],
    queryFn: () => apiRequest<unknown>("/library/loans/mine"),
    enabled: Boolean(user?.id && canBorrow && tab === "MY_LOANS"),
    staleTime: 0
  });
  const circulationQuery = useQuery({
    queryKey: ["library-circulation", user?.id],
    queryFn: () => apiRequest<unknown>("/library/loans?page=1&pageSize=50"),
    enabled: Boolean(user?.id && canManage && tab === "CIRCULATION"),
    staleTime: 0
  });
  const finesQuery = useQuery({
    queryKey: ["library-fines", user?.id],
    queryFn: () => apiRequest<unknown>("/library/fines?page=1&pageSize=50"),
    enabled: Boolean(user?.id && canRead && tab === "FINES"),
    staleTime: 0
  });
  const peopleQuery = useQuery({
    queryKey: ["library-borrowers", user?.id, workspaceKey, borrowerSearch],
    queryFn: () => apiRequest<unknown>("/students?page=1&pageSize=50&search=" + encodeURIComponent(borrowerSearch.trim())),
    enabled: Boolean(user?.id && canManage && tab === "MANAGE" && form === false),
    staleTime: 15000
  });

  const books = useMemo(() => items<Book>(booksQuery.data).filter((book) => typeof book.id === "string" && typeof book.title === "string"), [booksQuery.data]);
  const mine = useMemo(() => items<Loan>(mineQuery.data).filter((loan) => typeof loan.id === "string"), [mineQuery.data]);
  const circulation = useMemo(() => items<Loan>(circulationQuery.data).filter((loan) => typeof loan.id === "string"), [circulationQuery.data]);
  const fines = useMemo(() => items<Fine>(finesQuery.data).filter((fine) => typeof fine.id === "string"), [finesQuery.data]);
  const borrowers = useMemo(() => items<Person>(peopleQuery.data).filter((person) => typeof person.id === "string"), [peopleQuery.data]);

  async function invalidate() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["library-books", user?.id] }),
      client.invalidateQueries({ queryKey: ["library-my-loans", user?.id] }),
      client.invalidateQueries({ queryKey: ["library-circulation", user?.id] }),
      client.invalidateQueries({ queryKey: ["library-fines", user?.id] }),
      client.invalidateQueries({ queryKey: ["my-work", user?.id] })
    ]);
  }
  function closeForm() {
    setForm(false); setEditing(null); setTitle(""); setAuthor(""); setCategory(""); setCopies("1"); setShelf("");
  }
  function beginCreate() {
    setEditing(null); setTitle(""); setAuthor(""); setCategory(""); setCopies("1"); setShelf(""); setForm(true);
  }
  function beginEdit(book: Book) {
    setEditing(book); setTitle(book.title); setAuthor(book.author); setCategory(book.category || "");
    setCopies(String(book.totalCopies ?? book.availableCopies ?? 1)); setShelf(book.shelfLocation || ""); setForm(true);
  }

  const saveBook = useMutation({
    mutationFn: async () => {
      if (!canManage) throw new Error("Your session does not include library.manage.");
      if (title.trim().length < 2 || title.trim().length > 250) throw new Error("Title must contain 2–250 characters.");
      if (author.trim().length < 2 || author.trim().length > 200) throw new Error("Author must contain 2–200 characters.");
      const totalCopies = Number(copies);
      if (!Number.isInteger(totalCopies) || totalCopies < (editing ? 0 : 1) || totalCopies > 10000) throw new Error("Enter a valid copy count.");
      const body = { title: title.trim(), author: author.trim(), category: category.trim() || undefined, totalCopies, shelfLocation: shelf.trim() || undefined };
      return editing
        ? apiRequest<Book>("/library/books/" + encodeURIComponent(editing.id), { method: "PATCH", body: JSON.stringify(body) })
        : apiRequest<Book>("/library/books", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: async () => { await invalidate(); closeForm(); }
  });
  const reserve = useMutation({
    mutationFn: (bookId: string) => apiRequest("/library/reservations", { method: "POST", body: JSON.stringify({ bookId }) }),
    onSuccess: async () => { await invalidate(); Alert.alert("Reservation placed", "ACADLYX accepted the reservation. Check My Loans for the updated status."); }
  });
  const issue = useMutation({
    mutationFn: async () => {
      if (!canManage) throw new Error("Your session does not include library.manage.");
      if (!selectedBookId || !selectedBorrowerId) throw new Error("Choose a catalogue book and an institution member.");
      return apiRequest("/library/loans", { method: "POST", body: JSON.stringify({ bookId: selectedBookId, borrowerId: selectedBorrowerId }) });
    },
    onSuccess: async () => { await invalidate(); setSelectedBookId(null); setSelectedBorrowerId(null); setBorrowerSearch(""); }
  });
  const renew = useMutation({
    mutationFn: (id: string) => apiRequest("/library/loans/" + encodeURIComponent(id) + "/renew", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: invalidate
  });
  const returnLoan = useMutation({
    mutationFn: ({ id, condition }: { id: string; condition: "RETURNED" | "DAMAGED" | "LOST" }) =>
      apiRequest("/library/loans/" + encodeURIComponent(id) + "/return", {
        method: "POST",
        body: JSON.stringify({ condition, ...(condition === "DAMAGED" ? { damageSeverity: "MODERATE" } : {}), note: "Recorded from ACADLYX mobile circulation desk" })
      }),
    onSuccess: invalidate
  });
  const error = saveBook.error || issue.error || reserve.error || renew.error || returnLoan.error;

  function returnPrompt(loan: Loan) {
    Alert.alert("Record book return", "Choose the actual condition so the existing backend can update inventory and calculate any applicable charges.", [
      { text: "Cancel", style: "cancel" },
      { text: "Returned", onPress: () => returnLoan.mutate({ id: loan.id, condition: "RETURNED" }) },
      { text: "Damaged", onPress: () => Alert.alert("Confirm damaged item", "This records a MODERATE damage severity for the backend's policy calculation.", [
        { text: "Cancel", style: "cancel" }, { text: "Record damage", style: "destructive", onPress: () => returnLoan.mutate({ id: loan.id, condition: "DAMAGED" }) }
      ]) },
      { text: "Lost", style: "destructive", onPress: () => Alert.alert("Confirm lost book", "The backend will process the loss and any charge under the existing library/finance policy.", [
        { text: "Cancel", style: "cancel" }, { text: "Record loss", style: "destructive", onPress: () => returnLoan.mutate({ id: loan.id, condition: "LOST" }) }
      ]) }
    ]);
  }

  const tabs: Array<{ id: Tab; label: string; visible: boolean }> = [
    { id: "CATALOGUE", label: "Catalogue", visible: true },
    { id: "MY_LOANS", label: "My Loans", visible: canBorrow },
    { id: "CIRCULATION", label: "Circulation", visible: canManage },
    { id: "FINES", label: "Fines", visible: canRead },
    { id: "MANAGE", label: "Manage", visible: canManage }
  ];
  const currentQuery = tab === "MY_LOANS" ? mineQuery : tab === "CIRCULATION" ? circulationQuery : tab === "FINES" ? finesQuery : booksQuery;

  return <View style={styles.root}>
    <View style={styles.header}>
      <Text style={styles.title}>Library</Text>
      <Text style={styles.subtitle}>Catalogue, circulation and fines are handled by the existing institution-scoped library service.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {tabs.filter((entry) => entry.visible).map((entry) => <Pressable key={entry.id} onPress={() => { setTab(entry.id); closeForm(); }} style={[styles.tab, tab === entry.id ? styles.tabSelected : null]}>
          <Text style={[styles.tabText, tab === entry.id ? styles.tabTextSelected : null]}>{entry.label}</Text>
        </Pressable>)}
      </ScrollView>
      {tab === "CATALOGUE" ? <>
        <TextInput value={search} onChangeText={setSearch} style={styles.input} placeholder="Search title, author or ISBN" placeholderTextColor={colors.textMuted} accessibilityLabel="Search library catalogue" />
        <Pressable onPress={() => setAvailableOnly((value) => !value)} style={[styles.filter, availableOnly ? styles.filterSelected : null]}>
          <Text style={[styles.filterText, availableOnly ? styles.filterTextSelected : null]}>{availableOnly ? "Showing available only · tap to clear" : "Filter to available copies"}</Text>
        </Pressable>
      </> : null}
    </View>

    {tab === "MANAGE" ? <ScrollView style={styles.manageScroll} contentContainerStyle={styles.manageContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>Circulation desk</Text>
      <Text style={styles.subtitle}>Choose an existing catalogue item and institution member. IDs are selected from API results, not typed manually.</Text>
      <Text style={styles.label}>Choose book</Text>
      {booksQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : books.map((book) => <Pressable key={book.id} onPress={() => setSelectedBookId(book.id)} style={[styles.choice, selectedBookId === book.id ? styles.choiceSelected : null]}>
        <Text style={styles.choiceTitle}>{book.title}</Text><Text style={styles.meta}>{book.author} · {String(book.availableCopies ?? 0)} available</Text>
      </Pressable>)}
      <Text style={styles.label}>Find borrower</Text>
      <TextInput value={borrowerSearch} onChangeText={setBorrowerSearch} style={styles.input} placeholder="Search students by name/admission" placeholderTextColor={colors.textMuted} />
      {peopleQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : peopleQuery.isError ? <Text style={styles.error}>Student list is unavailable. The backend must authorize borrower lookup.</Text> :
        borrowers.map((person) => <Pressable key={person.id} onPress={() => setSelectedBorrowerId(person.id)} style={[styles.choice, selectedBorrowerId === person.id ? styles.choiceSelected : null]}>
          <Text style={styles.choiceTitle}>{personLabel(person)}</Text>
          <Text style={styles.meta}>{person.admissionNumber || person.idNumber || person.email || "Institution member"}{selectedBorrowerId === person.id ? " · Selected" : ""}</Text>
        </Pressable>)}
      {issue.isError ? <Text style={styles.error}>{issue.error instanceof ApiError ? issue.error.message : issue.error instanceof Error ? issue.error.message : "Issue failed."}</Text> : null}
      <Pressable disabled={issue.isPending || !selectedBookId || !selectedBorrowerId} onPress={() => Alert.alert("Issue book", "Issue the selected physical copy to this institution member? The server checks availability, limits and duplicate loans transactionally.", [
        { text: "Cancel", style: "cancel" }, { text: "Issue", onPress: () => issue.mutate() }
      ])} style={[styles.primaryButton, (!selectedBookId || !selectedBorrowerId) ? styles.disabled : null]}>
        {issue.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Issue selected book</Text>}
      </Pressable>
      <View style={styles.divider} />
      <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Catalogue maintenance</Text><Pressable onPress={form ? closeForm : beginCreate}><Text style={styles.link}>{form ? "Close" : "Add book"}</Text></Pressable></View>
      {books.map((book) => <View key={book.id} style={styles.bookCard}>
        <Text style={styles.bookTitle}>{book.title}</Text><Text style={styles.meta}>{book.author} · {String(book.availableCopies ?? 0)} available</Text>
        <Pressable onPress={() => beginEdit(book)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Edit book</Text></Pressable>
      </View>)}
      {form ? <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>{editing ? "Edit book" : "Add book"}</Text>
        <Text style={styles.label}>Title</Text><TextInput value={title} onChangeText={setTitle} maxLength={250} style={styles.input} placeholder="Book title" placeholderTextColor={colors.textMuted} />
        <Text style={styles.label}>Author</Text><TextInput value={author} onChangeText={setAuthor} maxLength={200} style={styles.input} placeholder="Author" placeholderTextColor={colors.textMuted} />
        <Text style={styles.label}>Category (optional)</Text><TextInput value={category} onChangeText={setCategory} maxLength={80} style={styles.input} placeholder="Category" placeholderTextColor={colors.textMuted} />
        <Text style={styles.label}>Total copies</Text><TextInput value={copies} onChangeText={setCopies} keyboardType="number-pad" style={styles.input} placeholder="1" placeholderTextColor={colors.textMuted} />
        <Text style={styles.label}>Shelf location (optional)</Text><TextInput value={shelf} onChangeText={setShelf} maxLength={60} style={styles.input} placeholder="Shelf location" placeholderTextColor={colors.textMuted} />
        {saveBook.isError ? <Text style={styles.error}>{saveBook.error instanceof Error ? saveBook.error.message : "Book could not be saved."}</Text> : null}
        <Pressable disabled={saveBook.isPending} onPress={() => saveBook.mutate()} style={styles.primaryButton}>{saveBook.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{editing ? "Save changes" : "Create book"}</Text>}</Pressable>
      </View> : null}
    </ScrollView> : tab === "CIRCULATION" ? <FlatList data={circulation} keyExtractor={(loan) => loan.id} contentContainerStyle={styles.list}
      renderItem={({ item }) => <View style={styles.bookCard}>
        <Text style={styles.bookTitle}>{item.book?.title || "Library loan"}</Text>
        <Text style={styles.meta}>{item.borrower ? [item.borrower.firstName, item.borrower.lastName].filter(Boolean).join(" ") : ""} · {item.status}</Text>
        <Text style={styles.meta}>Due {dateLabel(item.dueDate)} · Balance {String(item.financialBalance ?? 0)}</Text>
        {item.status === "ISSUED" || item.status === "RESERVED" ? <View style={styles.actions}>
          {item.status === "ISSUED" ? <Pressable disabled={renew.isPending} onPress={() => renew.mutate(item.id)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Renew</Text></Pressable> : null}
          <Pressable disabled={returnLoan.isPending} onPress={() => returnPrompt(item)} style={styles.primaryButton}><Text style={styles.buttonText}>Record return / condition</Text></Pressable>
        </View> : null}
      </View>} ListEmptyComponent={<View style={styles.state}><Text style={styles.sectionTitle}>No circulation records</Text><Text style={styles.subtitle}>No loans were returned for this scope.</Text></View>} /> : tab === "MY_LOANS" ? <FlatList data={mine} keyExtractor={(loan) => loan.id} contentContainerStyle={styles.list}
      renderItem={({ item }) => <View style={styles.bookCard}>
        <Text style={styles.bookTitle}>{item.book?.title || "Library loan"}</Text><Text style={styles.meta}>{item.status} · Due {dateLabel(item.dueDate)}</Text>
        <Text style={styles.meta}>Financial balance: {String(item.financialBalance ?? 0)}</Text>
        {item.status === "RESERVED" ? <Text style={styles.info}>Reservation saved by the backend. Collection/issue depends on library circulation processing.</Text> : null}
      </View>} ListEmptyComponent={<View style={styles.state}><Text style={styles.sectionTitle}>No current loans</Text><Text style={styles.subtitle}>The backend returned no loans for your account.</Text></View>} /> : tab === "FINES" ? <FlatList data={fines} keyExtractor={(fine) => fine.id} contentContainerStyle={styles.list}
      renderItem={({ item }) => <View style={styles.bookCard}>
        <Text style={styles.bookTitle}>{item.issue?.book?.title || "Library fine"}</Text>
        <Text style={styles.meta}>{item.status || "Fine"} · Amount {String(item.amount ?? "—")}</Text>
        {item.reason ? <Text style={styles.subtitle}>{item.reason}</Text> : null}
      </View>} ListEmptyComponent={<View style={styles.state}><Text style={styles.sectionTitle}>No fines returned</Text><Text style={styles.subtitle}>The backend returned no fines in this scope.</Text></View>} /> :
      <FlatList data={books} keyExtractor={(book) => book.id} contentContainerStyle={styles.list}
        renderItem={({ item }) => <View style={styles.bookCard}>
          <View style={styles.bookTop}><Text style={styles.bookTitle}>{item.title}</Text><Text style={styles.available}>{String(item.availableCopies ?? 0)} available</Text></View>
          <Text style={styles.meta}>By {item.author}{item.category ? " · " + item.category : ""}</Text>
          {item.shelfLocation ? <Text style={styles.meta}>Shelf: {item.shelfLocation}</Text> : null}
          {item.isbn ? <Text style={styles.meta}>ISBN: {item.isbn}</Text> : null}
          {canBorrow ? <Pressable disabled={reserve.isPending || (item.availableCopies ?? 0) <= 0} onPress={() => Alert.alert("Reserve book", "Reserve an available copy for your own account?", [
            { text: "Cancel", style: "cancel" }, { text: "Reserve", onPress: () => reserve.mutate(item.id) }
          ])} style={[styles.primaryButton, (item.availableCopies ?? 0) <= 0 ? styles.disabled : null]}><Text style={styles.buttonText}>{reserve.isPending ? "Processing…" : "Reserve a copy"}</Text></Pressable> : null}
        </View>} ListEmptyComponent={<View style={styles.state}><Text style={styles.sectionTitle}>No catalogue results</Text><Text style={styles.subtitle}>No active catalogue entries matched this search.</Text></View>} />}

    {currentQuery.isLoading ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color={colors.primary} /></View> : null}
    {currentQuery.isError && tab !== "MANAGE" ? <View style={styles.errorBanner}><Text style={styles.error}>{currentQuery.error instanceof Error ? currentQuery.error.message : "Library data could not be loaded."}</Text><Pressable onPress={() => { void currentQuery.refetch(); }}><Text style={styles.link}>Retry</Text></Pressable></View> : null}
    {error ? <View style={styles.errorBanner}><Text style={styles.error}>{error instanceof ApiError ? error.message : error instanceof Error ? error.message : "The library action failed."}</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas }, header: { padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border, gap: 8 },
  title: { color: colors.text, fontWeight: "900", fontSize: 23 }, subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  tabs: { gap: 7, paddingVertical: 4 }, tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  tabSelected: { backgroundColor: colors.primary }, tabText: { color: colors.textMuted, fontSize: 11, fontWeight: "800" }, tabTextSelected: { color: colors.white },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  filter: { alignSelf: "flex-start", paddingHorizontal: 11, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  filterSelected: { backgroundColor: colors.primary }, filterText: { color: colors.textMuted, fontWeight: "700", fontSize: 10 }, filterTextSelected: { color: colors.white },
  list: { padding: spacing.lg, paddingBottom: 32 }, bookCard: { padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginBottom: 10, gap: 6 },
  bookTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }, bookTitle: { flex: 1, color: colors.text, fontWeight: "900", fontSize: 15 },
  available: { color: colors.primary, fontWeight: "800", fontSize: 11 }, meta: { color: colors.textMuted, fontSize: 11, lineHeight: 17 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.md, minHeight: 40, justifyContent: "center", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, marginTop: 7 },
  buttonText: { color: colors.white, fontSize: 11, fontWeight: "900" }, disabled: { opacity: 0.45 }, info: { color: colors.primary, fontSize: 11, lineHeight: 16, marginTop: 5 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "900" }, manageScroll: { flex: 1 }, manageContent: { padding: spacing.lg, paddingBottom: 32, gap: 8 },
  label: { color: colors.text, fontSize: 12, fontWeight: "800", marginTop: 8, marginBottom: 4 },
  choice: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 11, backgroundColor: colors.surface, marginBottom: 5 },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, choiceTitle: { color: colors.text, fontWeight: "800", fontSize: 13 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, link: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  secondaryButton: { alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingHorizontal: 11, paddingVertical: 8, marginTop: 6 },
  secondaryText: { color: colors.primary, fontSize: 11, fontWeight: "800" }, formCard: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, marginTop: 8 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 15 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 7 },
  state: { alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: 10 }, error: { color: colors.danger, fontSize: 12, lineHeight: 17 },
  errorBanner: { borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.dangerSoft, padding: 10 }, loading: { position: "absolute", top: 7, right: 12 },
});
