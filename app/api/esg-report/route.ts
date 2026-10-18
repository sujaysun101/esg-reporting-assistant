import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@anthropic-ai/sdk/resources/messages/messages";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { capMaxTokens, formatZodError, guardDemoRequest, MAX_OUTPUT_TOKENS } from "@/lib/demo-guard";
import { ESG_BODY_MAX, ESG_LIMITS } from "@/lib/esg-limits";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

const bodySchema = z
  .object({
    companyName: z.string().trim().min(1).max(ESG_LIMITS.companyName),
    industry: z.string().trim().min(1).max(ESG_LIMITS.industry),
    employees: optionalText(ESG_LIMITS.employees),
    revenue: optionalText(ESG_LIMITS.revenue),
    energyUsage: optionalText(ESG_LIMITS.energyUsage),
    wasteGenerated: optionalText(ESG_LIMITS.wasteGenerated),
    communityInitiatives: optionalText(ESG_LIMITS.communityInitiatives),
    boardDiversity: optionalText(ESG_LIMITS.boardDiversity),
    governancePolicies: optionalText(ESG_LIMITS.governancePolicies),
  })
  .strict();

export async function POST(req: NextRequest) {
  const blocked = await guardDemoRequest(req);
  if (blocked) return blocked;

  let json: unknown;
  try {
    const raw = await req.text();
    if (raw.length > ESG_BODY_MAX) {
      return NextResponse.json({ error: "Request body is too large" }, { status: 400 });
    }
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const {
    companyName,
    industry,
    employees,
    revenue,
    energyUsage,
    wasteGenerated,
    communityInitiatives,
    boardDiversity,
    governancePolicies,
  } = parsed.data;

  let message: Message;
  try {
    message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: capMaxTokens(MAX_OUTPUT_TOKENS),
      messages: [
        {
          role: "user",
          content: `You are an expert ESG analyst. Generate a comprehensive ESG report and analysis for the following company:

Company: ${companyName}
Industry: ${industry}
Employees: ${employees || "Not provided"}
Annual Revenue: ${revenue || "Not provided"}
Energy Usage (MWh/year): ${energyUsage || "Not provided"}
Waste Generated (tons/year): ${wasteGenerated || "Not provided"}
Community Initiatives: ${communityInitiatives || "Not provided"}
Board Diversity: ${boardDiversity || "Not provided"}
Governance Policies: ${governancePolicies || "Not provided"}

Return a JSON object with:
{
  "overallScore": number (0-100),
  "eScore": number (0-100),
  "sScore": number (0-100),
  "gScore": number (0-100),
  "executiveSummary": "string",
  "environmental": {
    "rating": "A|B|C|D|F",
    "highlights": ["string"],
    "gaps": ["string"],
    "recommendations": ["string"]
  },
  "social": {
    "rating": "A|B|C|D|F",
    "highlights": ["string"],
    "gaps": ["string"],
    "recommendations": ["string"]
  },
  "governance": {
    "rating": "A|B|C|D|F",
    "highlights": ["string"],
    "gaps": ["string"],
    "recommendations": ["string"]
  },
  "reportingFrameworks": ["GRI|SASB|TCFD|CDP|UN SDGs"],
  "nextSteps": ["string"]
}`,
        },
      ],
    });
  } catch {
    // Do not log this error. Provider failures can echo request metadata.
    return NextResponse.json({ error: "The ESG report could not be completed" }, { status: 502 });
  }

  const content = message.content[0];
  if (!content || content.type !== "text") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }
  try {
    const text = content.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return NextResponse.json(JSON.parse(jsonMatch[0]));
    return NextResponse.json({ error: "Parse error" }, { status: 500 });
  } catch {
    return NextResponse.json({ error: "Failed to parse" }, { status: 500 });
  }
}
