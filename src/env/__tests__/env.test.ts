// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

describe("env architecture regression", () => {
  it("client env module does not contain server-only variable names", () => {
    const filePath = path.resolve(process.cwd(), "src/env/client.ts");
    const source = readFileSync(filePath, "utf8");
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;

    expect(transpiled).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(transpiled).not.toMatch(/POSTGRES_PRISMA_URL/);
    expect(transpiled).not.toMatch(/POSTGRES_URL_NON_POOLING/);
  });

  it("server env fails fast when required vars are missing", async () => {
    const prevPrisma = process.env.POSTGRES_PRISMA_URL;
    const prevDirect = process.env.POSTGRES_URL_NON_POOLING;

    delete process.env.POSTGRES_PRISMA_URL;
    delete process.env.POSTGRES_URL_NON_POOLING;

    vi.resetModules();

    await expect(import("../server")).rejects.toThrow(/Invalid environment variables/);

    if (prevPrisma === undefined) {
      delete process.env.POSTGRES_PRISMA_URL;
    } else {
      process.env.POSTGRES_PRISMA_URL = prevPrisma;
    }

    if (prevDirect === undefined) {
      delete process.env.POSTGRES_URL_NON_POOLING;
    } else {
      process.env.POSTGRES_URL_NON_POOLING = prevDirect;
    }
  });
});
