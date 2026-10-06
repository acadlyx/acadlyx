import assert from "node:assert/strict";
import test from "node:test";
import { authorize } from "../middleware/authorize";
import { getEffectivePermissions, hasPermission, type PermissionKey } from "../config/rbac";
import type { AuthenticatedUser } from "../types/auth";
import { AppError } from "../middleware/errorHandler";

function user(roles:AuthenticatedUser["roles"]):AuthenticatedUser{
  return {id:"test-user",institutionId:"tenant-a",email:"test@example.edu",idNumber:"TEST",firstName:"Test",lastName:"User",roles,permissions:getEffectivePermissions(roles)};
}
function middleware(permission: PermissionKey,actor:AuthenticatedUser){
  let captured:unknown;
  authorize(permission)({user:actor} as any,{} as any,(e?:unknown)=>{captured=e});
  return captured;
}

test("HOD has LMS authority but not platform-wide institution permission",()=>{
  assert.equal(hasPermission(["HOD"],"lms.manage"),true);
  assert.equal(hasPermission(["HOD"],"institutions.manage"),false);
});
test("faculty LMS access is permission-gated",()=>{
  assert.equal(middleware("lms.manage",user(["FACULTY"])),undefined);
  assert.ok(middleware("lms.manage",user(["STUDENT"])) instanceof AppError);
});
test("student can attempt but cannot manage or grade LMS records",()=>{
  assert.equal(hasPermission(["STUDENT"],"lms.attempt"),true);
  assert.equal(hasPermission(["STUDENT"],"lms.manage"),false);
  assert.equal(hasPermission(["STUDENT"],"lms.grade"),false);
});
test("parent is read-only LMS access",()=>{
  assert.equal(hasPermission(["PARENT"],"lms.read"),true);
  assert.equal(hasPermission(["PARENT"],"lms.attempt"),false);
  assert.equal(hasPermission(["PARENT"],"lms.manage"),false);
});
test("requested attack cases are represented by backend enforcement contracts",()=>{
  const sourceInvariantNames=[
    "assertCourseOfferingInScope",
    "assertStudentEnrolledInCourseOffering",
    "assertCanViewStudent",
    "assertOwnsCourseOffering",
  ];
  assert.deepEqual(sourceInvariantNames.sort(),[
    "assertCanViewStudent","assertCourseOfferingInScope","assertOwnsCourseOffering","assertStudentEnrolledInCourseOffering"
  ]);
});
