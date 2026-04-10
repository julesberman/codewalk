import {
  requireRole,
  requireScope,
  validateToken,
  type AuthUser,
  type RequestContext,
} from "./auth";
import { findProjectById } from "./projects";

export interface ResponseShape {
  status: number;
  body: string;
}

export function attachUser(context: RequestContext): RequestContext {
  const user = validateToken(context);
  return {
    ...context,
    user,
  };
}

export function assertProjectAccess(user: AuthUser, projectId: string): void {
  const project = findProjectById(projectId);

  if (!project) {
    throw new Error(`Unknown project: ${projectId}`);
  }

  if (project.orgId !== user.orgId) {
    throw new Error("Project does not belong to this organization.");
  }
}

export function runAuthenticated(
  context: RequestContext,
  handler: (authenticated: RequestContext & { user: AuthUser }) => ResponseShape,
): ResponseShape {
  try {
    const authenticated = attachUser(context);

    if (!authenticated.user) {
      return {
        status: 401,
        body: "Unauthorized",
      };
    }

    return handler(authenticated as RequestContext & { user: AuthUser });
  } catch (error) {
    return {
      status: 403,
      body: error instanceof Error ? error.message : "Request failed.",
    };
  }
}

export function requireAdminAccess(user: AuthUser): void {
  requireRole(user, "admin");
  requireScope(user, "projects:write");
}

export function requireIncidentWriteAccess(user: AuthUser): void {
  requireRole(user, "incident-manager");
  requireScope(user, "incidents:write");
}
