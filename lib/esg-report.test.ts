import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import {
  capMaxTokens,
  clientIp,
  demoDisabledError,
  MAX_OUTPUT_TOKENS,
  sameOriginError,
} from "./demo-guard";
import { ESG_BODY_MAX, ESG_LIMITS } from "./esg-limits";

delete process.env.ANTHROPIC_API_KEY;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const { POST } = await import("../app/api/esg-report/route");

const valid = {
  companyName: "Acme Corp",
  industry: "Manufacturing",
  employees: "500",
  revenue: "$50M",
  energyUsage: "10000",
  wasteGenerated: "200",
  communityInitiatives: "Local hiring programs",
  boardDiversity: "40% women, 3 independent directors",
  governancePolicies: "Anti-corruption and whistleblower policy",
};

let ipCounter = 0;
function nextIp() {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
}

async function call(body: string, headers: Record<string, string> = {}) {
  const req = new NextRequest("http://localhost:3000/api/esg-report", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": nextIp(), ...headers },
    body,
  });
  const res = await POST(req);
  return { status: res.status, body: await res.json(), retryAfter: res.headers.get("Retry-After") };
}

function local(extra: Record<string, string> = {}) {
  return { origin: "http://localhost:3000", ...extra };
}

describe("esg report guard", () => {
  test("caps model output and rejects non-finite token requests", () => {
    expect(MAX_OUTPUT_TOKENS).toBe(2048);
    expect(capMaxTokens(100_000)).toBe(2048);
    expect(capMaxTokens(2048)).toBe(2048);
    expect(capMaxTokens(100)).toBe(100);
    expect(capMaxTokens(1.9)).toBe(1);
    expect(capMaxTokens(0)).toBe(1);
    expect(capMaxTokens(Number.NaN)).toBe(2048);
    expect(capMaxTokens(Number.POSITIVE_INFINITY)).toBe(2048);
  });

  test("allows localhost and the deployment host, rejects foreign origins", async () => {
    const previous = process.env.VERCEL_URL;
    process.env.VERCEL_URL = "esg-demo.vercel.app";
    try {
      expect(sameOriginError(new NextRequest("http://localhost:3000/api/esg-report", { headers: { origin: "http://localhost:3000" } }))).toBeNull();
      expect(sameOriginError(new NextRequest("http://127.0.0.1:3000/api/esg-report", { headers: { origin: "http://127.0.0.1:3000" } }))).toBeNull();
      expect(sameOriginError(new NextRequest("http://[::1]:3000/api/esg-report", { headers: { origin: "http://[::1]:3000" } }))).toBeNull();
      expect(sameOriginError(new NextRequest("http://localhost:3000/api/esg-report", { headers: { referer: "http://localhost:3000/report" } }))).toBeNull();
      expect(sameOriginError(new NextRequest("http://localhost:3000/api/esg-report", { headers: { origin: "https://esg-demo.vercel.app" } }))).toBeNull();

      const hostReq = new NextRequest("https://reports.example/api/esg-report", {
        headers: { origin: "https://reports.example", host: "reports.example" },
      });
      expect(sameOriginError(hostReq)).toBeNull();

      const missing = sameOriginError(new NextRequest("http://localhost:3000/api/esg-report"));
      expect(missing?.status).toBe(403);

      const foreign = sameOriginError(new NextRequest("https://reports.example/api/esg-report", {
        headers: { origin: "https://evil.example", host: "reports.example" },
      }));
      expect(foreign?.status).toBe(403);

      const ftp = sameOriginError(new NextRequest("http://localhost:3000/api/esg-report", {
        headers: { origin: "ftp://localhost/secret" },
      }));
      expect(ftp?.status).toBe(403);

      const bad = sameOriginError(new NextRequest("http://localhost:3000/api/esg-report", {
        headers: { origin: "not a url" },
      }));
      expect(bad?.status).toBe(403);
    } finally {
      if (previous === undefined) delete process.env.VERCEL_URL;
      else process.env.VERCEL_URL = previous;
    }
  });

  test("uses the first forwarded address and ignores empty values", () => {
    const req = new NextRequest("http://localhost:3000/api/esg-report", {
      headers: { "x-forwarded-for": " 198.51.100.8 , 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("198.51.100.8");
    const long = new NextRequest("http://localhost:3000/api/esg-report", {
      headers: { "x-forwarded-for": "a".repeat(200) },
    });
    expect(clientIp(long)).toHaveLength(128);
  });

  test("kill switch returns 503 before validation or the model", async () => {
    const previous = process.env.DEMO_DISABLED;
    process.env.DEMO_DISABLED = "1";
    try {
      expect(demoDisabledError()?.status).toBe(503);
      const res = await call(JSON.stringify({ ...valid, max_tokens: 999999 }), {
        origin: "https://evil.example",
      });
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ error: "This demo is temporarily disabled" });
    } finally {
      if (previous === undefined) delete process.env.DEMO_DISABLED;
      else process.env.DEMO_DISABLED = previous;
    }
  });

  test("rejects invalid, unknown, and oversized input with 400", async () => {
    const invalid = await call("{", local());
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toBe("Invalid JSON body");

    const empty = await call("", local());
    expect(empty.status).toBe(400);

    const unknown = await call(JSON.stringify({ ...valid, max_tokens: 100000 }), local());
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toContain("max_tokens");

    const extra = await call(JSON.stringify({ ...valid, model: "claude-opus-4" }), local());
    expect(extra.status).toBe(400);

    const tooLong = await call(JSON.stringify({ ...valid, companyName: "A".repeat(ESG_LIMITS.companyName + 1) }), local());
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error).toContain("companyName");

    const missing = await call(JSON.stringify({ industry: "Tech" }), local());
    expect(missing.status).toBe(400);

    const blank = await call(JSON.stringify({ ...valid, companyName: "   " }), local());
    expect(blank.status).toBe(400);

    const numeric = await call(JSON.stringify({ ...valid, employees: 500 }), local());
    expect(numeric.status).toBe(400);

    const huge = await call("x".repeat(ESG_BODY_MAX + 1), local());
    expect(huge.status).toBe(400);
    expect(huge.body.error).toBe("Request body is too large");
  });

  test("foreign origin is 403 and a local valid request fails closed without the provider", async () => {
    const foreign = await call(JSON.stringify(valid), { origin: "https://evil.example" });
    expect(foreign.status).toBe(403);
    expect(foreign.body.error).toBe("Requests must come from this site");

    const bare = await call(JSON.stringify(valid));
    expect(bare.status).toBe(403);

    const ok = await call(JSON.stringify(valid), local());
    expect(ok.status).toBe(502);
    expect(ok.body).toEqual({ error: "The ESG report could not be completed" });
    expect(JSON.stringify(ok.body)).not.toMatch(/sk-|api[_-]?key|token/i);

    const partial = await call(JSON.stringify({ companyName: "Acme", industry: "Tech" }), local());
    expect(partial.status).toBe(502);
  });

  test("rate limits each IP to 5 per minute and 30 per day", async () => {
    const realNow = Date.now;
    let now = 1_700_000_000_000;
    Date.now = () => now;
    try {
      const ip = nextIp();
      const headers = { origin: "http://localhost:3000", "x-forwarded-for": ip };
      for (let batch = 0; batch < 6; batch += 1) {
        for (let n = 0; n < 5; n += 1) {
          const res = await call("{", headers);
          expect(res.status).toBe(400);
        }
        const blocked = await call("{", headers);
        expect(blocked.status).toBe(429);
        expect(blocked.retryAfter).toBe("60");
        expect(blocked.body.error).toBe("Too many requests. Please try again later.");
        now += 60_001;
      }
      const overDay = await call("{", headers);
      expect(overDay.status).toBe(429);

      const other = await call("{", { origin: "http://127.0.0.1:3000", "x-forwarded-for": nextIp() });
      expect(other.status).toBe(400);
    } finally {
      Date.now = realNow;
    }
  });

  test("does not log secrets", () => {
    const route = readFileSync(new URL("../app/api/esg-report/route.ts", import.meta.url), "utf8");
    const guard = readFileSync(new URL("./demo-guard.ts", import.meta.url), "utf8");
    const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
    for (const source of [route, guard, page]) {
      expect(source).not.toContain("console.");
    }
    expect(route).toContain("capMaxTokens(MAX_OUTPUT_TOKENS)");
    expect(route).not.toContain("max_tokens: 4096");
    expect(page).toContain("maxLength={ESG_LIMITS[key]}");
  });
});
