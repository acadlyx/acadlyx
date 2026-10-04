  const rows = parseWorkbook(buffer).rows.map(normalizeRow);
  if (!rows.length) throw new AppError("The first sheet contains no data rows", 400);
  await assertTenantQuota(institutionId, "users"); await assertTenantQuota(institutionId, "students");
  const imported: Array<{ id: string; row: number; name: string; missingFields: string[] }> = [];
  const errors: Array<{ row: number; message: string }> = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    try {
      const admissionNumber = text(row.admissionnumber) || text(row.rollnumber) || syntheticAdmissionNumber(row);
      const suppliedEmail = text(row.email).toLowerCase();
      const email = suppliedEmail || syntheticEmail(admissionNumber);
      const suppliedId = text(row.idnumber || row.id || row.loginid).toUpperCase();
      const idNumber = suppliedId || syntheticIdNumber(admissionNumber);
      const firstName = text(row.firstname) || "Imported"; const lastName = text(row.lastname) || "Student";
      let enrollmentCreated = false;
      const result = await prisma.$transaction(async (tx) => {
        const roleId = await findRoleId(tx, institutionId);
        const existingProfile = await tx.studentProfile.findFirst({ where: { institutionId, admissionNumber }, select: { userId: true } });
        const existingEmail = suppliedEmail ? await tx.user.findUnique({ where: { email: suppliedEmail }, select: { id: true, institutionId: true } }) : null;
        if (existingEmail && existingEmail.institutionId !== institutionId) throw new AppError("The supplied email already belongs to another institution", 409);
        if (existingProfile && existingEmail && existingProfile.userId !== existingEmail.id) throw new AppError("Admission number and email refer to different users", 409);
        const existingUserId = existingProfile?.userId ?? existingEmail?.id;
        const existingUser = existingUserId ? await tx.user.findUnique({ where: { id: existingUserId }, select: { email: true, idNumber: true } }) : null;
        const finalEmail = existingUser?.email ?? email;
        const finalIdNumber = existingUser?.idNumber ?? idNumber;
        const user = existingUserId
          ? await tx.user.update({ where: { id: existingUserId }, data: { email: finalEmail, idNumber: finalIdNumber, firstName, lastName, phone: text(row.phone) || null } })
          : await tx.user.create({ data: { institutionId, email: finalEmail, idNumber: finalIdNumber, passwordHash: await hashPassword("Import-" + crypto.randomUUID() + "-9xA!"), firstName, lastName, phone: text(row.phone) || null, isActive: true } });
        await tx.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId } }, update: {}, create: { userId: user.id, roleId } });
        await tx.studentProfile.upsert({
          where: { userId: user.id },
          update: { admissionNumber, dateOfBirth: date(row.dateofbirth), gender: text(row.gender) || null, bloodGroup: text(row.bloodgroup) || null, nationality: text(row.nationality) || null, address: text(row.address) || null, city: text(row.city) || null, state: text(row.state) || null, postalCode: text(row.postalcode) || null, guardianName: text(row.guardianname) || null, guardianPhone: text(row.guardianphone) || null, guardianEmail: text(row.guardianemail) || null, admissionDate: date(row.admissiondate), status: text(row.status) || "ACTIVE" },
          create: { institutionId, userId: user.id, admissionNumber, dateOfBirth: date(row.dateofbirth), gender: text(row.gender) || null, bloodGroup: text(row.bloodgroup) || null, nationality: text(row.nationality) || null, address: text(row.address) || null, city: text(row.city) || null, state: text(row.state) || null, postalCode: text(row.postalcode) || null, guardianName: text(row.guardianname) || null, guardianPhone: text(row.guardianphone) || null, guardianEmail: text(row.guardianemail) || null, admissionDate: date(row.admissiondate), status: text(row.status) || "ACTIVE" },
        });
        const placement = await resolvePlacement(tx, institutionId, row);
        if (placement?.semesterId) {
          await tx.studentEnrollment.upsert({ where: { userId_academicYearId: { userId: user.id, academicYearId: placement.academicYearId } }, update: { programId: placement.programId, semesterId: placement.semesterId, sectionId: placement.sectionId, rollNumber: text(row.rollnumber) || null, status: text(row.status) || "ACTIVE" }, create: { institutionId, userId: user.id, programId: placement.programId, academicYearId: placement.academicYearId, semesterId: placement.semesterId, sectionId: placement.sectionId, rollNumber: text(row.rollnumber) || null, status: text(row.status) || "ACTIVE" } });
          enrollmentCreated = true;
        }
        return user;
      });
      imported.push({ id: result.id, row: index + 2, name: (firstName + " " + lastName).trim(), missingFields: getMissingFields(row, result.email, result.idNumber, enrollmentCreated) });
    } catch (error) {
      errors.push({ row: index + 2, message: error instanceof Error ? error.message : "Unknown import error" });
    }
  }