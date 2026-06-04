import * as path from "node:path";
import { minimatch } from "minimatch";

import {
  formatStudioPath,
  projectRootFromFile,
  relativeRojoPath,
  resolveRojoPath,
  toRojoPath,
} from "./pathUtils";
import {
  getMetaTargetName,
  inferFileRule,
  isDefaultProjectFile,
  isInitMetaFile,
  isMetaFile,
  knownServiceClassNames,
} from "./rojoSyncRules";
import {
  RojoBuildOptions,
  RojoClassNameSource,
  RojoDiagnostic,
  RojoFileSystem,
  RojoFsEntry,
  RojoInstanceNode,
  RojoProjectConfig,
  RojoProjectModel,
  RojoSourceRef,
} from "./rojoTypes";

interface ProjectDocument {
  name?: unknown;
  tree?: unknown;
  globIgnorePaths?: unknown;
  emitLegacyScripts?: unknown;
}

interface BuildContext {
  fs: RojoFileSystem;
  config: RojoProjectConfig;
  diagnostics: RojoDiagnostic[];
  options: Required<RojoBuildOptions>;
}

interface MetaData {
  className?: unknown;
  properties?: unknown;
  ignoreUnknownInstances?: unknown;
}

interface DirectoryAnalysis {
  className: string;
  classNameSource: RojoClassNameSource;
  source: RojoSourceRef;
  properties?: Record<string, unknown>;
  ignoreUnknownInstances?: boolean;
  children: RojoInstanceNode[];
  diagnostics: RojoDiagnostic[];
}

const defaultOptions: Required<RojoBuildOptions> = {
  includeLuau: true,
};

export async function buildRojoProjectModel(
  projectFilePath: string,
  fs: RojoFileSystem,
  options: RojoBuildOptions = {},
): Promise<RojoProjectModel> {
  const normalizedProjectPath = path.normalize(projectFilePath);
  const projectRootPath = projectRootFromFile(normalizedProjectPath);
  const diagnostics: RojoDiagnostic[] = [];
  let document: ProjectDocument;
  try {
    document = await readJsonFile<ProjectDocument>(fs, normalizedProjectPath);
  } catch (error) {
    const projectName = path.basename(projectRootPath);
    const config: RojoProjectConfig = {
      name: projectName,
      projectFilePath: normalizedProjectPath,
      projectRootPath,
      globIgnorePaths: [],
      emitLegacyScripts: true,
    };
    const root = createFallbackRoot(projectName, normalizedProjectPath);
    const message = error instanceof Error ? error.message : String(error);
    const diagnostic = createDiagnostic("invalidJson", "error", message, normalizedProjectPath, root.studioPath);
    root.diagnostics.push(diagnostic);
    diagnostics.push(diagnostic);
    return { config, root, diagnostics };
  }
  const projectName = getProjectName(document, projectRootPath, normalizedProjectPath);
  const config: RojoProjectConfig = {
    name: projectName,
    projectFilePath: normalizedProjectPath,
    projectRootPath,
    globIgnorePaths: asStringArray(document.globIgnorePaths),
    emitLegacyScripts: typeof document.emitLegacyScripts === "boolean" ? document.emitLegacyScripts : true,
  };
  const context: BuildContext = {
    fs,
    config,
    diagnostics,
    options: { ...defaultOptions, ...options },
  };

  if (!isRecord(document.tree)) {
    const root = createFallbackRoot(projectName, normalizedProjectPath);
    const diagnostic = createDiagnostic(
      "missingTree",
      "error",
      "Rojo project file is missing a valid tree object.",
      normalizedProjectPath,
      root.studioPath,
    );
    root.diagnostics.push(diagnostic);
    diagnostics.push(diagnostic);
    return { config, root, diagnostics };
  }

  const root = await buildInstanceFromDescription(projectName, document.tree, context, getRootStudioPath(projectName, document.tree), true, []);
  root.source = {
    fsPath: normalizedProjectPath,
    kind: "project",
    exists: true,
    entryType: "file",
  };

  return { config, root, diagnostics };
}

export function formatNodeStudioPath(node: RojoInstanceNode): string {
  return formatStudioPath(node.studioPath);
}

async function buildInstanceFromDescription(
  name: string,
  value: Record<string, unknown>,
  context: BuildContext,
  studioPath: string[],
  isRoot: boolean,
  projectTreePath: string[],
): Promise<RojoInstanceNode> {
  const projectClassName = typeof value.$className === "string" ? value.$className : undefined;
  const mappedPath = typeof value.$path === "string" ? resolveRojoPath(context.config.projectRootPath, value.$path) : undefined;
  const projectProperties = asProperties(value.$properties);
  const projectIgnoreUnknown = typeof value.$ignoreUnknownInstances === "boolean" ? value.$ignoreUnknownInstances : undefined;
  const mappedEntryType = mappedPath ? await context.fs.stat(mappedPath) : undefined;
  let source: RojoSourceRef | undefined = mappedPath
    ? { fsPath: mappedPath, kind: "projectTree", exists: mappedEntryType !== undefined, entryType: mappedEntryType }
    : undefined;
  const diagnostics: RojoDiagnostic[] = [];
  let className = projectClassName ?? inferServiceClassName(name) ?? (isRoot ? "DataModel" : "Folder");
  let classNameSource: RojoClassNameSource = projectClassName ? "project" : inferServiceClassName(name) ? "service" : "fallback";
  let children: RojoInstanceNode[] = [];
  let properties = projectProperties;
  let ignoreUnknownInstances = projectIgnoreUnknown;

  if (mappedPath) {
    if (!mappedEntryType) {
      const diagnostic = createDiagnostic(
        "pathNotFound",
        "warning",
        `Mapped path does not exist: ${relativeRojoPath(context.config.projectRootPath, mappedPath)}`,
        mappedPath,
        studioPath,
      );
      diagnostics.push(diagnostic);
      context.diagnostics.push(diagnostic);
    } else if (mappedEntryType === "directory") {
      const analysis = await analyzeDirectoryAsInstance(name, mappedPath, context, studioPath);
      if (!projectClassName) {
        className = analysis.className;
        classNameSource = analysis.classNameSource;
      }
      properties = mergeProperties(analysis.properties, projectProperties);
      ignoreUnknownInstances = projectIgnoreUnknown ?? analysis.ignoreUnknownInstances;
      children = analysis.children;
      diagnostics.push(...analysis.diagnostics);
      if (!source) {
        source = analysis.source;
      }
    } else {
      const rule = inferFileRule(path.basename(mappedPath), "file");
      if (rule) {
        if (!projectClassName) {
          className = rule.className;
          classNameSource = "filesystem";
        }
      } else {
        const diagnostic = createDiagnostic(
          "unsupportedPathType",
          "warning",
          `Mapped file is not a supported Rojo resource: ${relativeRojoPath(context.config.projectRootPath, mappedPath)}`,
          mappedPath,
          studioPath,
        );
        diagnostics.push(diagnostic);
        context.diagnostics.push(diagnostic);
      }
    }
  }

  const explicitChildren = await Promise.all(
    Object.entries(value)
      .filter(([key]) => !key.startsWith("$"))
      .map(([childName, childValue]) =>
        buildInstanceFromDescription(
          childName,
          isRecord(childValue) ? childValue : {},
          context,
          [...studioPath, childName],
          false,
          [...projectTreePath, childName],
        ),
      ),
  );

  return {
    name,
    className,
    classNameSource,
    studioPath,
    projectFilePath: context.config.projectFilePath,
    projectTreePath,
    source,
    properties,
    ignoreUnknownInstances,
    children: sortNodes([...children, ...explicitChildren]),
    diagnostics,
  };
}

async function analyzeDirectoryAsInstance(
  name: string,
  directoryPath: string,
  context: BuildContext,
  studioPath: string[],
): Promise<DirectoryAnalysis> {
  const defaultProjectPath = path.join(directoryPath, "default.project.json");
  if (await context.fs.stat(defaultProjectPath)) {
    const included = await buildIncludedProjectNode(name, defaultProjectPath, context, studioPath);
    return {
      className: included.className,
      classNameSource: included.classNameSource,
      source: {
        fsPath: defaultProjectPath,
        kind: "projectInclusion",
        exists: true,
        entryType: "file",
      },
      properties: included.properties,
      ignoreUnknownInstances: included.ignoreUnknownInstances,
      children: included.children,
      diagnostics: included.diagnostics,
    };
  }

  const entries = (await context.fs.readDirectory(directoryPath)).filter((entry) =>
    shouldIncludeEntry(context, path.join(directoryPath, entry.name)),
  );
  const diagnostics: RojoDiagnostic[] = [];
  const initScripts = entries
    .filter((entry) => entry.type === "file")
    .map((entry) => ({ entry, rule: inferFileRule(entry.name, entry.type) }))
    .filter((entry): entry is { entry: RojoFsEntry; rule: NonNullable<ReturnType<typeof inferFileRule>> } =>
      Boolean(entry.rule?.isInitScript),
    )
    .sort((left, right) => left.entry.name.localeCompare(right.entry.name));
  const initScript = initScripts[0];

  if (initScripts.length > 1) {
    const diagnostic = createDiagnostic(
      "duplicateInitScript",
      "error",
      `Only one init script can be present in ${relativeRojoPath(context.config.projectRootPath, directoryPath)}.`,
      directoryPath,
      studioPath,
    );
    diagnostics.push(diagnostic);
    context.diagnostics.push(diagnostic);
  }

  const initMeta = await readMetaIfPresent(context, path.join(directoryPath, "init.meta.json"), studioPath, diagnostics);
  let className = "Folder";
  let classNameSource: RojoClassNameSource = "filesystem";
  let source: RojoSourceRef = {
    fsPath: directoryPath,
    kind: "directory",
    exists: true,
    entryType: "directory",
  };

  if (initScript) {
    className = initScript.rule.className;
    classNameSource = "filesystem";
    source = {
      fsPath: path.join(directoryPath, initScript.entry.name),
      kind: "initScript",
      exists: true,
      entryType: "file",
    };
  }

  if (typeof initMeta?.className === "string") {
    className = initMeta.className;
    classNameSource = "meta";
  }

  const children = await buildDirectoryChildren(directoryPath, entries, context, studioPath, diagnostics);
  return {
    className,
    classNameSource,
    source,
    properties: asProperties(initMeta?.properties),
    ignoreUnknownInstances:
      typeof initMeta?.ignoreUnknownInstances === "boolean" ? initMeta.ignoreUnknownInstances : undefined,
    children,
    diagnostics,
  };
}

async function buildIncludedProjectNode(
  name: string,
  projectFilePath: string,
  parentContext: BuildContext,
  studioPath: string[],
): Promise<RojoInstanceNode> {
  const included = await buildRojoProjectModel(projectFilePath, parentContext.fs, parentContext.options);
  parentContext.diagnostics.push(...included.diagnostics);
  return {
    ...included.root,
    name,
    studioPath,
    source: {
      fsPath: projectFilePath,
      kind: "projectInclusion",
      exists: true,
      entryType: "file",
    },
    children: updateChildStudioPaths(included.root.children, studioPath),
  };
}

async function buildDirectoryChildren(
  directoryPath: string,
  entries: RojoFsEntry[],
  context: BuildContext,
  parentStudioPath: string[],
  parentDiagnostics: RojoDiagnostic[],
): Promise<RojoInstanceNode[]> {
  const children: RojoInstanceNode[] = [];
  const metaByTarget = new Map<string, { fsPath: string; data: MetaData }>();

  for (const entry of entries) {
    if (entry.type === "file" && isMetaFile(entry.name) && !isInitMetaFile(entry.name)) {
      const targetName = getMetaTargetName(entry.name);
      if (targetName) {
        const metaPath = path.join(directoryPath, entry.name);
        const metaDiagnostics: RojoDiagnostic[] = [];
        const data = await readMetaIfPresent(context, metaPath, parentStudioPath, metaDiagnostics);
        parentDiagnostics.push(...metaDiagnostics);
        if (data) {
          metaByTarget.set(targetName.toLowerCase(), { fsPath: metaPath, data });
        }
      }
    }
  }

  for (const entry of entries.sort(compareEntries)) {
    const entryPath = path.join(directoryPath, entry.name);
    const rule = inferFileRule(entry.name, entry.type);
    if (!rule || rule.isInitScript || isMetaFile(entry.name) || isDefaultProjectFile(entry.name)) {
      continue;
    }

    let child: RojoInstanceNode;
    if (entry.type === "directory") {
      const childStudioPath = [...parentStudioPath, entry.name];
      const analysis = await analyzeDirectoryAsInstance(entry.name, entryPath, context, childStudioPath);
      child = {
        name: entry.name,
        className: analysis.className,
        classNameSource: analysis.classNameSource,
        studioPath: childStudioPath,
        source: analysis.source,
        properties: analysis.properties,
        ignoreUnknownInstances: analysis.ignoreUnknownInstances,
        children: analysis.children,
        diagnostics: analysis.diagnostics,
      };
    } else {
      child = {
        name: rule.name,
        className: rule.className,
        classNameSource: "filesystem",
        studioPath: [...parentStudioPath, rule.name],
        source: {
          fsPath: entryPath,
          kind: rule.sourceKind,
          exists: true,
          entryType: "file",
        },
        children: [],
        diagnostics: [],
      };
    }

    applySiblingMeta(child, metaByTarget.get(child.name.toLowerCase()), context, rule?.isModelLike === true);
    children.push(child);
  }

  for (const [targetName, meta] of metaByTarget) {
    const hasTarget = children.some((child) => child.name.toLowerCase() === targetName);
    if (!hasTarget) {
      const diagnostic = createDiagnostic(
        "orphanMetaFile",
        "warning",
        `Meta file has no matching Rojo resource: ${relativeRojoPath(context.config.projectRootPath, meta.fsPath)}`,
        meta.fsPath,
        parentStudioPath,
      );
      parentDiagnostics.push(diagnostic);
      context.diagnostics.push(diagnostic);
    }
  }

  return sortNodes(children);
}

function applySiblingMeta(
  node: RojoInstanceNode,
  meta: { fsPath: string; data: MetaData } | undefined,
  context: BuildContext,
  isModelLike: boolean,
): void {
  if (!meta) {
    return;
  }

  if (typeof meta.data.className === "string") {
    const diagnostic = createDiagnostic(
      "unsupportedMetaClassName",
      "warning",
      "Only init.meta.json can change className.",
      meta.fsPath,
      node.studioPath,
    );
    node.diagnostics.push(diagnostic);
    context.diagnostics.push(diagnostic);
  }

  if (isModelLike && isRecord(meta.data.properties)) {
    const diagnostic = createDiagnostic(
      "unsupportedMetaProperties",
      "warning",
      "Meta properties are not applied to .rbxm, .rbxmx, or .model.json resources.",
      meta.fsPath,
      node.studioPath,
    );
    node.diagnostics.push(diagnostic);
    context.diagnostics.push(diagnostic);
  } else {
    node.properties = mergeProperties(node.properties, asProperties(meta.data.properties));
  }

  if (typeof meta.data.ignoreUnknownInstances === "boolean") {
    node.ignoreUnknownInstances = meta.data.ignoreUnknownInstances;
  }
}

async function readMetaIfPresent(
  context: BuildContext,
  metaPath: string,
  studioPath: string[],
  diagnostics: RojoDiagnostic[],
): Promise<MetaData | undefined> {
  if (!(await context.fs.stat(metaPath))) {
    return undefined;
  }

  try {
    const data = await readJsonFile<MetaData>(context.fs, metaPath);
    return isRecord(data) ? data : undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const diagnostic = createDiagnostic("invalidMetaJson", "error", `Invalid meta JSON: ${message}`, metaPath, studioPath);
    diagnostics.push(diagnostic);
    context.diagnostics.push(diagnostic);
    return undefined;
  }
}

async function readJsonFile<T>(fs: RojoFileSystem, filePath: string): Promise<T> {
  const content = await fs.readFile(filePath);
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${filePath}: ${message}`);
  }
}

function shouldIncludeEntry(context: BuildContext, filePath: string): boolean {
  if (context.config.globIgnorePaths.length === 0) {
    return true;
  }

  const relativePath = relativeRojoPath(context.config.projectRootPath, filePath);
  return !context.config.globIgnorePaths.some((glob) => minimatch(relativePath, glob, { dot: true }));
}

function getRootStudioPath(projectName: string, tree: Record<string, unknown>): string[] {
  return tree.$className === "DataModel" ? ["game"] : [projectName];
}

function getProjectName(document: ProjectDocument, projectRootPath: string, projectFilePath: string): string {
  if (typeof document.name === "string" && document.name.length > 0) {
    return document.name;
  }

  if (path.basename(projectFilePath).toLowerCase() === "default.project.json") {
    return path.basename(projectRootPath);
  }

  return path.basename(projectFilePath, ".project.json");
}

function inferServiceClassName(name: string): string | undefined {
  return knownServiceClassNames.has(name) ? name : undefined;
}

function createFallbackRoot(projectName: string, projectFilePath: string): RojoInstanceNode {
  return {
    name: projectName,
    className: "DataModel",
    classNameSource: "fallback",
    studioPath: ["game"],
    projectFilePath,
    projectTreePath: [],
    source: {
      fsPath: projectFilePath,
      kind: "project",
      exists: true,
      entryType: "file",
    },
    children: [],
    diagnostics: [],
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asProperties(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function mergeProperties(
  base: Record<string, unknown> | undefined,
  override: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!base && !override) {
    return undefined;
  }

  return {
    ...(base ?? {}),
    ...(override ?? {}),
  };
}

function createDiagnostic(
  code: RojoDiagnostic["code"],
  severity: RojoDiagnostic["severity"],
  message: string,
  fsPath: string,
  studioPath: string[],
): RojoDiagnostic {
  return {
    code,
    severity,
    message,
    fsPath,
    studioPath: formatStudioPath(studioPath),
  };
}

function updateChildStudioPaths(nodes: RojoInstanceNode[], parentPath: string[]): RojoInstanceNode[] {
  return nodes.map((node) => {
    const studioPath = [...parentPath, node.name];
    return {
      ...node,
      studioPath,
      children: updateChildStudioPaths(node.children, studioPath),
    };
  });
}

function sortNodes(nodes: RojoInstanceNode[]): RojoInstanceNode[] {
  return nodes.sort((left, right) => left.name.localeCompare(right.name));
}

function compareEntries(left: RojoFsEntry, right: RojoFsEntry): number {
  if (left.type !== right.type) {
    return left.type === "directory" ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
