import { authedFetch } from "./auth";
import { buildQuery, Envelope, PagedEnvelope } from "./httpShared";

/** Typed client for assets, facilities and maintenance. */

export interface OperationsSummary {
  assets: { total: number; inUse: number; underRepair: number; bookValue: number };
  facilities: { active: number };
  maintenance: { open: number; urgent: number; resolvedThisMonth: number };
}

export interface Asset {
  id: string;
  name: string;
  assetTag: string;
  serialNumber: string | null;
  status: string;
  condition: string;
  quantity: number;
  unitCost: number | null;
  location: string | null;
  categoryName: string | null;
  departmentName: string | null;
  assignedToName: string | null;
}

export interface Facility {
  id: string;
  name: string;
  code: string;
  facilityType: string;
  capacity: number | null;
  location: string | null;
  isActive: boolean;
  openRequests: number;
}

export interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  facilityName: string | null;
  assetName: string | null;
  raisedByName: string;
  assignedToName: string | null;
}

export async function getOperationsSummary(): Promise<OperationsSummary> {
  const res = await authedFetch<Envelope<OperationsSummary>>(
    "/operations/summary"
  );
  return res.data;
}

export async function listAssetCategories() {
  const res = await authedFetch<
    Envelope<Array<{ id: string; name: string; code: string; assetCount: number }>>
  >("/operations/asset-categories");
  return res.data;
}

export async function createAssetCategory(body: {
  name: string;
  code: string;
}) {
  const res = await authedFetch<Envelope<Array<Record<string, unknown>>>>(
    "/operations/asset-categories",
    { method: "POST", body: JSON.stringify(body) }
  );
  return res.data;
}

export async function listAssets(params: {
  page?: number;
  search?: string;
  status?: string;
  assetCategoryId?: string;
}): Promise<{ items: Asset[]; total: number }> {
  const res = await authedFetch<PagedEnvelope<Asset>>(
    `/operations/assets${buildQuery(params)}`
  );
  return { items: res.data, total: res.meta.total };
}

export async function createAsset(body: Record<string, unknown>) {
  const res = await authedFetch<Envelope<Asset>>("/operations/assets", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function updateAsset(id: string, body: Record<string, unknown>) {
  const res = await authedFetch<Envelope<Asset>>(`/operations/assets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function listFacilities(params: {
  search?: string;
  includeInactive?: boolean;
}): Promise<Facility[]> {
  const res = await authedFetch<Envelope<Facility[]>>(
    `/operations/facilities${buildQuery(params)}`
  );
  return res.data;
}

export async function createFacility(body: Record<string, unknown>) {
  const res = await authedFetch<Envelope<Facility>>("/operations/facilities", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function updateFacility(
  id: string,
  body: Record<string, unknown>
) {
  const res = await authedFetch<Envelope<Facility>>(
    `/operations/facilities/${id}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
  return res.data;
}

export async function listMaintenance(params: {
  page?: number;
  status?: string;
  priority?: string;
  mine?: boolean;
}): Promise<{ items: MaintenanceRequest[]; total: number }> {
  const res = await authedFetch<PagedEnvelope<MaintenanceRequest>>(
    `/operations/maintenance${buildQuery(params)}`
  );
  return { items: res.data, total: res.meta.total };
}

export async function createMaintenance(body: Record<string, unknown>) {
  const res = await authedFetch<Envelope<MaintenanceRequest>>(
    "/operations/maintenance",
    { method: "POST", body: JSON.stringify(body) }
  );
  return res.data;
}

export async function updateMaintenance(
  id: string,
  body: Record<string, unknown>
) {
  const res = await authedFetch<Envelope<MaintenanceRequest>>(
    `/operations/maintenance/${id}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );
  return res.data;
}
