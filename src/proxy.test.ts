import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "anon-key";

const authState = {
  user: null as null | { id: string },
};

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: authState.user } })),
    },
  })),
}));

import { proxy } from "./proxy";

describe("proxy auth enforcement", () => {
  beforeEach(() => {
    authState.user = null;
  });

  it("returns 401 for unauthenticated API routes", async () => {
    const req = new NextRequest("http://localhost:3000/api/leads");
    const res = await proxy(req);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("redirects unauthenticated app routes to login with next", async () => {
    const req = new NextRequest("http://localhost:3000/leasing/inbox?leadId=abc");
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Fleasing%2Finbox%3FleadId%3Dabc",
    );
  });

  it("allows authenticated requests", async () => {
    authState.user = { id: "user_123" };
    const req = new NextRequest("http://localhost:3000/leasing");
    const res = await proxy(req);

    expect(res.status).toBe(200);
  });
});
