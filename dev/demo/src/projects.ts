export interface ProjectRecord {
  id: string;
  name: string;
  slug: string;
  orgId: string;
  tier: "free" | "team" | "enterprise";
  ownerId: string;
  environment: "production" | "staging";
  status: "healthy" | "degraded" | "critical";
  activeIncidentCount: number;
}

export interface IncidentRecord {
  id: string;
  projectId: string;
  severity: "low" | "medium" | "high";
  summary: string;
  createdBy: string;
  status: "open" | "resolved";
}

const projects: ProjectRecord[] = [
  {
    id: "proj_100",
    name: "Checkout API",
    slug: "checkout-api",
    orgId: "org-acme",
    tier: "enterprise",
    ownerId: "user-1",
    environment: "production",
    status: "degraded",
    activeIncidentCount: 1,
  },
  {
    id: "proj_200",
    name: "Customer Portal",
    slug: "customer-portal",
    orgId: "org-acme",
    tier: "team",
    ownerId: "user-2",
    environment: "staging",
    status: "healthy",
    activeIncidentCount: 0,
  },
];

const incidents: IncidentRecord[] = [
  {
    id: "inc_900",
    projectId: "proj_100",
    severity: "medium",
    summary: "Elevated payment latency",
    createdBy: "user-2",
    status: "open",
  },
];

export function listProjectsForOrg(orgId: string): ProjectRecord[] {
  return projects.filter((project) => project.orgId === orgId);
}

export function findProjectById(projectId: string): ProjectRecord | undefined {
  return projects.find((project) => project.id === projectId);
}

export function createProject(input: {
  name: string;
  slug: string;
  ownerId: string;
  orgId: string;
  tier?: ProjectRecord["tier"];
}): ProjectRecord {
  const project: ProjectRecord = {
    id: `proj_${projects.length + 100}`,
    name: input.name,
    slug: input.slug,
    orgId: input.orgId,
    tier: input.tier ?? "team",
    ownerId: input.ownerId,
    environment: "staging",
    status: "healthy",
    activeIncidentCount: 0,
  };

  projects.push(project);
  return project;
}

export function openIncident(input: {
  projectId: string;
  summary: string;
  severity?: IncidentRecord["severity"];
  createdBy: string;
}): IncidentRecord {
  const incident: IncidentRecord = {
    id: `inc_${incidents.length + 901}`,
    projectId: input.projectId,
    summary: input.summary,
    severity: input.severity ?? "medium",
    createdBy: input.createdBy,
    status: "open",
  };

  incidents.push(incident);

  const project = findProjectById(input.projectId);
  if (project) {
    project.activeIncidentCount += 1;
    project.status = incident.severity === "high" ? "critical" : "degraded";
  }

  return incident;
}
