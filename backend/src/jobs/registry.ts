import { JobType } from "./types";
import { AppError } from "../middleware/errorHandler";

export interface JobContext {
  jobId: string;
  workerId: string;
  institutionId: string | null;
  createdById: string | null;
  payload: Record<string, unknown>;
  heartbeat(): Promise<void>;
  progress(processed: number, failed: number, total: number): Promise<boolean>;
  isCancellationRequested(): Promise<boolean>;
}
export type JobHandler = (ctx: JobContext) => Promise<Record<string, unknown> | undefined>;
const handlers = new Map<JobType, JobHandler>();
export function registerJobHandler(type: JobType, handler: JobHandler) {
  if (handlers.has(type)) throw new Error(`Duplicate job handler registration: ${type}`);
  handlers.set(type, handler);
}
export function getJobHandler(type: JobType) {
  const handler = handlers.get(type);
  if (!handler) throw new AppError(`No worker handler is registered for job type ${type}`, 500);
  return handler;
}
