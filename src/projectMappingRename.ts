export interface ProjectMappingRenameRequest {
  projectFilePath: string;
  projectTreePath: readonly string[];
  newName: string;
}

export interface ProjectMappingRenamePlan {
  projectFilePath: string;
  currentName: string;
  newName: string;
  updatedContent: string;
}

export interface ProjectMappingRenameResult {
  ok: true;
  plan: ProjectMappingRenamePlan;
}

export type ProjectMappingRenameFailureReason =
  | "invalidJson"
  | "invalidName"
  | "mappingNotFound"
  | "rootMapping"
  | "targetExists"
  | "unchangedName";

export interface ProjectMappingRenameFailure {
  ok: false;
  reason: ProjectMappingRenameFailureReason;
  message: string;
}

interface ProjectDocument {
  tree?: unknown;
}

export function planProjectMappingRename(
  projectContent: string,
  request: ProjectMappingRenameRequest,
): ProjectMappingRenameResult | ProjectMappingRenameFailure {
  const normalizedName = request.newName.trim();
  if (!isValidMappingName(normalizedName)) {
    return {
      ok: false,
      reason: "invalidName",
      message: "Project mapping names cannot be empty or contain path separators.",
    };
  }

  if (request.projectTreePath.length === 0) {
    return {
      ok: false,
      reason: "rootMapping",
      message: "The project root mapping cannot be renamed here.",
    };
  }

  let document: ProjectDocument;
  try {
    document = JSON.parse(projectContent) as ProjectDocument;
  } catch (error) {
    return {
      ok: false,
      reason: "invalidJson",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (!isRecord(document.tree)) {
    return {
      ok: false,
      reason: "mappingNotFound",
      message: "Project file is missing a valid tree object.",
    };
  }

  const currentName = request.projectTreePath[request.projectTreePath.length - 1];
  if (normalizedName === currentName) {
    return {
      ok: false,
      reason: "unchangedName",
      message: "Project mapping name is unchanged.",
    };
  }

  const parentPath = request.projectTreePath.slice(0, -1);
  const parent = getProjectTreeParent(document.tree, parentPath);
  if (!parent || !Object.prototype.hasOwnProperty.call(parent, currentName)) {
    return {
      ok: false,
      reason: "mappingNotFound",
      message: "Project mapping was not found in the project file.",
    };
  }

  if (Object.prototype.hasOwnProperty.call(parent, normalizedName)) {
    return {
      ok: false,
      reason: "targetExists",
      message: "A project mapping with that name already exists.",
    };
  }

  renameObjectKey(parent, currentName, normalizedName);

  return {
    ok: true,
    plan: {
      projectFilePath: request.projectFilePath,
      currentName,
      newName: normalizedName,
      updatedContent: `${JSON.stringify(document, null, 2)}\n`,
    },
  };
}

function getProjectTreeParent(tree: Record<string, unknown>, parentPath: readonly string[]): Record<string, unknown> | undefined {
  let current: Record<string, unknown> = tree;
  for (const segment of parentPath) {
    const child = current[segment];
    if (!isRecord(child)) {
      return undefined;
    }

    current = child;
  }

  return current;
}

function renameObjectKey(target: Record<string, unknown>, currentName: string, newName: string): void {
  const entries = Object.entries(target).map(([key, value]) => [key === currentName ? newName : key, value] as const);
  for (const key of Object.keys(target)) {
    delete target[key];
  }

  for (const [key, value] of entries) {
    target[key] = value;
  }
}

function isValidMappingName(name: string): boolean {
  return name.length > 0 && !name.includes("/") && !name.includes("\\");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
