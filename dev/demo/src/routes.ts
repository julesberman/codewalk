import type { RequestContext } from "./auth";
import { recordAuditEvent, readAuditLog } from "./audit";
import {
  assertProjectAccess,
  requireAdminAccess,
  requireIncidentWriteAccess,
  runAuthenticated,
  type ResponseShape,
} from "./middleware";
import {
  createProject,
  findProjectById,
  listProjectsForOrg,
  openIncident,
  type ProjectRecord,
} from "./projects";

interface DemoScenario {
  description: string;
  request: RequestContext;
}

type RouteHandler = (context: RequestContext) => ResponseShape;

const demoScenarios: Record<string, DemoScenario> = {
  listProjects: {
    description: "Reader requests the project list.",
    request: {
      requestId: "req-100",
      method: "GET",
      path: "/api/projects",
      headers: {
        authorization: "Bearer demo-reader-token",
      },
    },
  },
  createProject: {
    description: "Admin creates a new project for a beta launch.",
    request: {
      requestId: "req-101",
      method: "POST",
      path: "/api/projects",
      headers: {
        authorization: "Bearer demo-admin-token",
      },
      body: {
        name: "Warehouse Sync",
        slug: "warehouse-sync",
        tier: "enterprise",
      },
    },
  },
  openIncident: {
    description: "Ops opens an incident on a degraded service.",
    request: {
      requestId: "req-102",
      method: "POST",
      path: "/api/projects/proj_100/incidents",
      headers: {
        authorization: "Bearer demo-ops-token",
      },
      params: {
        projectId: "proj_100",
      },
      body: {
        summary: "Database failover exceeded the error budget.",
        severity: "high",
      },
    },
  },
};

export function runExample(): string {
  return runScenario("createProject");
}

export function runScenario(name: keyof typeof demoScenarios): string {
  const scenario = demoScenarios[name];
  const response = routeRequest(scenario.request);
  return `${scenario.description} -> ${formatResponse(response)}`;
}

export function routeRequest(context: RequestContext): ResponseShape {
  const normalizedPath = normalizePath(context.path);
  const matchers: Array<[(ctx: RequestContext) => boolean, RouteHandler]> = [
    [(ctx) => ctx.method === "GET" && normalizePath(ctx.path) === "/api/projects", handleListProjects],
    [(ctx) => ctx.method === "POST" && normalizePath(ctx.path) === "/api/projects", handleCreateProject],
    [
      (ctx) =>
        ctx.method === "GET" &&
        /^\/api\/projects\/[^/]+$/.test(normalizePath(ctx.path)),
      handleProjectDetail,
    ],
    [
      (ctx) =>
        ctx.method === "POST" &&
        /^\/api\/projects\/[^/]+\/incidents$/.test(normalizePath(ctx.path)),
      handleOpenIncident,
    ],
  ];

  for (const [matches, handler] of matchers) {
    if (matches({ ...context, path: normalizedPath })) {
      return handler(buildRouteContext(context, normalizedPath));
    }
  }

  return {
    status: 404,
    body: `No demo route matched ${context.method} ${normalizedPath}`,
  };
}

function handleListProjects(context: RequestContext): ResponseShape {
  return runAuthenticated(context, (authenticated) => {
    const projects = listProjectsForOrg(authenticated.user.orgId);
    const lines = projects.map(
      (project) =>
        `${project.id} ${project.name} [${project.environment}] incidents=${project.activeIncidentCount}`,
    );

    return {
      status: 200,
      body: lines.join("\n"),
    };
  });
}

function handleProjectDetail(context: RequestContext): ResponseShape {
  return runAuthenticated(context, (authenticated) => {
    const projectId = authenticated.params?.projectId;

    if (!projectId) {
      return {
        status: 400,
        body: "Project id is required.",
      };
    }

    assertProjectAccess(authenticated.user, projectId);

    const project = findProjectById(projectId);
    if (!project) {
      return {
        status: 404,
        body: "Project not found.",
      };
    }

    return {
      status: 200,
      body: formatProject(project),
    };
  });
}

function handleCreateProject(context: RequestContext): ResponseShape {
  return runAuthenticated(context, (authenticated) => {
    requireAdminAccess(authenticated.user);

    const projectName = readRequiredString(authenticated.body, "name");
    const slug = readRequiredString(authenticated.body, "slug");
    const tier = readOptionalTier(authenticated.body?.tier);

    const project = createProject({
      name: projectName,
      slug,
      tier,
      ownerId: authenticated.user.id,
      orgId: authenticated.user.orgId,
    });

    recordAuditEvent(context, authenticated.user, {
      action: "project.created",
      resourceType: "project",
      resourceId: project.id,
      metadata: {
        slug: project.slug,
      },
    });

    return {
      status: 201,
      body: `Created ${project.name} (${project.id})`,
    };
  });
}

function handleOpenIncident(context: RequestContext): ResponseShape {
  return runAuthenticated(context, (authenticated) => {
    requireIncidentWriteAccess(authenticated.user);

    const projectId = authenticated.params?.projectId;
    if (!projectId) {
      return {
        status: 400,
        body: "Project id is required.",
      };
    }

    assertProjectAccess(authenticated.user, projectId);

    const summary = readRequiredString(authenticated.body, "summary");
    const severity = readOptionalSeverity(authenticated.body?.severity);
    const incident = openIncident({
      projectId,
      summary,
      severity,
      createdBy: authenticated.user.id,
    });

    recordAuditEvent(context, authenticated.user, {
      action: "incident.opened",
      resourceType: "incident",
      resourceId: incident.id,
      metadata: {
        projectId,
        severity: incident.severity,
      },
    });

    return {
      status: 201,
      body: `Opened ${incident.id} for ${projectId} (${incident.severity})`,
    };
  });
}

function buildRouteContext(
  context: RequestContext,
  normalizedPath: string,
): RequestContext {
  const params = extractParams(normalizedPath);
  return {
    ...context,
    path: normalizedPath,
    params: {
      ...params,
      ...context.params,
    },
  };
}

function extractParams(path: string): Record<string, string> {
  const projectIncidentMatch = path.match(/^\/api\/projects\/([^/]+)\/incidents$/);
  if (projectIncidentMatch) {
    return { projectId: projectIncidentMatch[1] };
  }

  const projectMatch = path.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch) {
    return { projectId: projectMatch[1] };
  }

  return {};
}

function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
}

function readRequiredString(
  body: Record<string, unknown> | undefined,
  key: string,
): string {
  const value = body?.[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Body field "${key}" must be a non-empty string.`);
  }

  return value.trim();
}

function readOptionalTier(value: unknown): ProjectRecord["tier"] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "free" || value === "team" || value === "enterprise") {
    return value;
  }

  throw new Error("Tier must be one of free, team, or enterprise.");
}

function readOptionalSeverity(
  value: unknown,
): "low" | "medium" | "high" | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }

  throw new Error("Severity must be one of low, medium, or high.");
}

function formatProject(project: ProjectRecord): string {
  return [
    `${project.name} (${project.id})`,
    `tier=${project.tier}`,
    `environment=${project.environment}`,
    `status=${project.status}`,
  ].join("\n");
}

function formatResponse(response: ResponseShape): string {
  const auditCount = readAuditLog().length;
  return `status=${response.status} body="${response.body}" auditEvents=${auditCount}`;
}
