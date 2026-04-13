import type { AuthUser, RequestContext } from "./auth";

export interface AuditEvent {
  actorId: string;
  action: string;
  resourceType: "project" | "incident";
  resourceId: string;
  requestId: string;
  metadata?: Record<string, unknown>;
}

const auditLog: AuditEvent[] = [];

export function recordAuditEvent(
  context: RequestContext,
  user: AuthUser,
  event: Omit<AuditEvent, "actorId" | "requestId">,
): AuditEvent {
  const entry: AuditEvent = {
    actorId: user.id,
    requestId: context.requestId,
    ...event,
  };

  auditLog.push(entry);
  return entry;
}

export function readAuditLog(): AuditEvent[] {
  return [...auditLog];
}
