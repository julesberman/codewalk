export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  params?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
  user?: AuthUser;
}

export interface AuthUser {
  id: string;
  name: string;
  orgId: string;
  roles: string[];
  scopes: string[];
}

const VALID_TOKENS: Record<string, AuthUser> = {
  "demo-admin-token": {
    id: "user-1",
    name: "Avery Admin",
    orgId: "org-acme",
    roles: ["admin", "incident-manager"],
    scopes: ["projects:read", "projects:write", "incidents:write"],
  },
  "demo-ops-token": {
    id: "user-2",
    name: "Omar Ops",
    orgId: "org-acme",
    roles: ["incident-manager"],
    scopes: ["projects:read", "incidents:write"],
  },
  "demo-reader-token": {
    id: "user-3",
    name: "Riley Reader",
    orgId: "org-acme",
    roles: ["reader"],
    scopes: ["projects:read"],
  },
};

export function validateToken(context: RequestContext): AuthUser {
  const rawHeader =
    context.headers.authorization ?? context.headers.Authorization;

  if (!rawHeader) {
    throw new Error("Missing Authorization header.");
  }

  const token = rawHeader.replace(/^Bearer\s+/i, "").trim();
  const user = VALID_TOKENS[token];

  if (!user) {
    throw new Error("Token was not recognized.");
  }

  return user;
}

export function requireRole(user: AuthUser, role: string): void {
  if (!user.roles.includes(role)) {
    throw new Error(`Missing required role: ${role}`);
  }
}

export function requireScope(user: AuthUser, scope: string): void {
  if (!user.scopes.includes(scope)) {
    throw new Error(`Missing required scope: ${scope}`);
  }
}
