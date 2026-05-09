import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { companyName, industry, employees, revenue, energyUsage, wasteGenerated, communityInitiatives, boardDiversity, governancePolicies } = await req.json();

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are an expert ESG analyst. Generate a comprehensive ESG report and analysis for the following company:

Company: ${companyName}
Industry: ${industry}
Employees: ${employees}
Annual Revenue: ${revenue}
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

  const content = message.content[0];
  if (content.type !== "text") return NextResponse.json({ error: "No response" }, { status: 500 });
  try {
    const text = content.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return NextResponse.json(JSON.parse(jsonMatch[0]));
    return NextResponse.json({ error: "Parse error" }, { status: 500 });
  } catch {
    return NextResponse.json({ error: "Failed to parse" }, { status: 500 });
  }
}
