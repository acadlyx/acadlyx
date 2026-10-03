-- ACADLYX hot-path indexes
-- Login resolves a roll number through an ACTIVE student enrollment.
-- Keep the tenant boundary in the leading columns so the index remains
-- useful for multi-tenant workloads and avoids scanning enrollment history.
CREATE INDEX "student_enrollments_institutionId_rollNumber_status_idx"
ON "student_enrollments"("institutionId", "rollNumber", "status");

-- Common dashboard/user directory filtering combines tenant, active state,
-- and soft-deletion state. This complements the existing institution index.
CREATE INDEX "users_institutionId_isActive_deletedAt_id_idx"
ON "users"("institutionId", "isActive", "deletedAt", "id");

-- Fast tenant-scoped notification feeds ordered by recency/read state.
CREATE INDEX "notifications_institutionId_userId_readAt_createdAt_idx"
ON "notifications"("institutionId", "userId", "readAt", "createdAt" DESC);
