import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "..");

describe("localization files", () => {
  it("keeps zh-cn package manifest translations in sync with default keys", () => {
    expect(jsonKeys("package.nls.zh-cn.json")).toEqual(jsonKeys("package.nls.json"));
  });

  it("keeps zh-cn runtime translations in sync with default keys", () => {
    expect(jsonKeys("l10n/bundle.l10n.zh-cn.json")).toEqual(jsonKeys("l10n/bundle.l10n.json"));
  });
});

function jsonKeys(relativePath: string): string[] {
  const filePath = path.join(repoRoot, relativePath);
  return Object.keys(JSON.parse(readFileSync(filePath, "utf8"))).sort();
}
