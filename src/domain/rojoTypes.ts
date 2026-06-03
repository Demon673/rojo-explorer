export type RojoFsEntryType = "file" | "directory";

export interface RojoFsEntry {
  name: string;
  type: RojoFsEntryType;
}

export interface RojoFileSystem {
  readFile(filePath: string): Promise<string>;
  readDirectory(directoryPath: string): Promise<RojoFsEntry[]>;
  stat(filePath: string): Promise<RojoFsEntryType | undefined>;
}

export type RojoDiagnosticSeverity = "error" | "warning" | "info";

export type RojoDiagnosticCode =
  | "invalidJson"
  | "missingTree"
  | "pathNotFound"
  | "unsupportedPathType"
  | "duplicateInitScript"
  | "invalidMetaJson"
  | "unsupportedMetaClassName"
  | "unsupportedMetaProperties"
  | "orphanMetaFile";

export interface RojoDiagnostic {
  code: RojoDiagnosticCode;
  severity: RojoDiagnosticSeverity;
  message: string;
  fsPath?: string;
  studioPath?: string;
}

export type RojoSourceKind =
  | "project"
  | "projectTree"
  | "directory"
  | "script"
  | "initScript"
  | "model"
  | "jsonModel"
  | "jsonModule"
  | "tomlModule"
  | "text"
  | "csv"
  | "projectInclusion";

export interface RojoSourceRef {
  fsPath: string;
  kind: RojoSourceKind;
  exists: boolean;
}

export interface RojoProjectConfig {
  name: string;
  projectFilePath: string;
  projectRootPath: string;
  globIgnorePaths: string[];
  emitLegacyScripts: boolean;
}

export interface RojoProjectModel {
  config: RojoProjectConfig;
  root: RojoInstanceNode;
  diagnostics: RojoDiagnostic[];
}

export type RojoClassNameSource = "project" | "service" | "filesystem" | "meta" | "fallback";

export interface RojoInstanceNode {
  name: string;
  className: string;
  classNameSource: RojoClassNameSource;
  studioPath: string[];
  source?: RojoSourceRef;
  properties?: Record<string, unknown>;
  ignoreUnknownInstances?: boolean;
  children: RojoInstanceNode[];
  diagnostics: RojoDiagnostic[];
}

export interface RojoBuildOptions {
  includeLuau?: boolean;
}
