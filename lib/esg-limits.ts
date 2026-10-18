/** Character caps for POST /api/esg-report. The form uses the same values. */
export const ESG_LIMITS = {
  companyName: 200,
  industry: 200,
  employees: 80,
  revenue: 80,
  energyUsage: 80,
  wasteGenerated: 80,
  communityInitiatives: 2_000,
  boardDiversity: 1_000,
  governancePolicies: 2_000,
} as const;

export type EsgField = keyof typeof ESG_LIMITS;

/** Raw JSON body cap: every field at its max, plus key and punctuation overhead. */
export const ESG_BODY_MAX = Object.values(ESG_LIMITS).reduce((sum, max) => sum + max, 0) + 1_000;
