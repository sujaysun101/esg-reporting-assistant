"use client";
import { useState } from "react";

interface ESGReport {
  overallScore: number;
  eScore: number;
  sScore: number;
  gScore: number;
  executiveSummary: string;
  environmental: { rating: string; highlights: string[]; gaps: string[]; recommendations: string[] };
  social: { rating: string; highlights: string[]; gaps: string[]; recommendations: string[] };
  governance: { rating: string; highlights: string[]; gaps: string[]; recommendations: string[] };
  reportingFrameworks: string[];
  nextSteps: string[];
}

const ScoreCircle = ({ score, label, color }: { score: number; label: string; color: string }) => (
  <div className="text-center">
    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-2 ${color} text-white font-bold text-xl`}>
      {score}
    </div>
    <div className="text-sm text-gray-600">{label}</div>
  </div>
);

const RatingBadge = ({ rating }: { rating: string }) => {
  const colors: Record<string, string> = { A: "bg-green-100 text-green-800", B: "bg-blue-100 text-blue-800", C: "bg-yellow-100 text-yellow-800", D: "bg-orange-100 text-orange-800", F: "bg-red-100 text-red-800" };
  return <span className={`px-3 py-1 rounded-full text-sm font-semibold ${colors[rating] || "bg-gray-100"}`}>{rating}</span>;
};

const Section = ({ data, title }: { data: ESGReport["environmental"]; title: string }) => (
  <div className="bg-white rounded-2xl shadow p-6">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      <RatingBadge rating={data.rating} />
    </div>
    {data.highlights.length > 0 && (
      <div className="mb-4">
        <div className="text-xs font-semibold text-green-600 uppercase mb-2">Highlights</div>
        {data.highlights.map((h, i) => <div key={i} className="text-sm text-gray-700 mb-1">&#x2713; {h}</div>)}
      </div>
    )}
    {data.gaps.length > 0 && (
      <div className="mb-4">
        <div className="text-xs font-semibold text-red-600 uppercase mb-2">Gaps</div>
        {data.gaps.map((g, i) => <div key={i} className="text-sm text-gray-700 mb-1">&#x2717; {g}</div>)}
      </div>
    )}
    {data.recommendations.length > 0 && (
      <div>
        <div className="text-xs font-semibold text-blue-600 uppercase mb-2">Recommendations</div>
        {data.recommendations.map((r, i) => <div key={i} className="text-sm text-gray-700 mb-1">&#x2192; {r}</div>)}
      </div>
    )}
  </div>
);

export default function ESGAssistant() {
  const [form, setForm] = useState({ companyName: "", industry: "", employees: "", revenue: "", energyUsage: "", wasteGenerated: "", communityInitiatives: "", boardDiversity: "", governancePolicies: "" });
  const [report, setReport] = useState<ESGReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/esg-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const inputs = [
    { key: "companyName", label: "Company Name *", placeholder: "Acme Corp", required: true },
    { key: "industry", label: "Industry *", placeholder: "Manufacturing, Tech, Retail...", required: true },
    { key: "employees", label: "Number of Employees", placeholder: "500" },
    { key: "revenue", label: "Annual Revenue", placeholder: "$50M" },
    { key: "energyUsage", label: "Energy Usage (MWh/year)", placeholder: "10000" },
    { key: "wasteGenerated", label: "Waste Generated (tons/year)", placeholder: "200" },
    { key: "communityInitiatives", label: "Community Initiatives", placeholder: "Local hiring programs, charity..." },
    { key: "boardDiversity", label: "Board Diversity", placeholder: "40% women, 3 independent directors..." },
    { key: "governancePolicies", label: "Governance Policies", placeholder: "Anti-corruption, whistleblower policy..." },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-emerald-900 mb-3">ESG Reporting Assistant</h1>
          <p className="text-emerald-600 text-lg">AI-powered ESG analysis and sustainability reporting</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {inputs.map(({ key, label, placeholder, required }) => (
              <div key={key} className={key === "communityInitiatives" || key === "governancePolicies" ? "md:col-span-2" : ""}>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
                <input
                  type="text"
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                  required={required}
                  className="w-full border border-gray-300 rounded-xl p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            ))}
          </div>
          <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-xl transition-colors">
            {loading ? "Generating ESG Report..." : "Generate ESG Report"}
          </button>
        </form>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">{error}</div>}
        {report && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-emerald-900 mb-6">ESG Score Overview</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                <ScoreCircle score={report.overallScore} label="Overall" color="bg-emerald-600" />
                <ScoreCircle score={report.eScore} label="Environmental" color="bg-green-500" />
                <ScoreCircle score={report.sScore} label="Social" color="bg-blue-500" />
                <ScoreCircle score={report.gScore} label="Governance" color="bg-purple-500" />
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm font-semibold text-gray-500 mb-2">Executive Summary</div>
                <p className="text-gray-700">{report.executiveSummary}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Section data={report.environmental} title="Environmental" />
              <Section data={report.social} title="Social" />
              <Section data={report.governance} title="Governance" />
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="font-bold text-gray-900 mb-3">Applicable Reporting Frameworks</h3>
              <div className="flex flex-wrap gap-2 mb-6">
                {report.reportingFrameworks.map((f, i) => <span key={i} className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-medium">{f}</span>)}
              </div>
              <h3 className="font-bold text-gray-900 mb-3">Recommended Next Steps</h3>
              {report.nextSteps.map((step, i) => <div key={i} className="text-sm text-gray-700 mb-2">{i + 1}. {step}</div>)}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
