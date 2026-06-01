// Supabase Edge Function: sales-research
//
// Environment variables required:
// - openai_api_key (or OPENAI_API_KEY via CLI)
// - supabase_url (or SUPABASE_URL)
// - supabase_anon_key (or SUPABASE_ANON_KEY)
// Optional:
// - openai_model (or OPENAI_MODEL, defaults to gpt-5-mini)
//
// Deploy:
//   supabase functions deploy sales-research
//   supabase secrets set openai_api_key=... openai_model=gpt-5-mini

type DiscoveryFilters = {
  industry?: string;
  location?: string;
  size?: string;
  type?: string;
};

type ResearchLeadInput = {
  company?: string;
  website?: string;
  industry?: string;
  location?: string;
  size?: string;
  type?: string;
  signals?: string;
};

type RequestBody = {
  mode: "discover" | "research";
  filters?: DiscoveryFilters;
  lead?: ResearchLeadInput;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const stages = [
  "New Lead",
  "Researching",
  "Ready To Contact",
  "Contacted",
  "Follow Up Required",
  "Replied",
  "Meeting Scheduled",
  "Proposal Sent",
  "Won",
  "Lost",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    await assertAuthenticated(req);

    const body = await req.json() as RequestBody;
    if (body.mode !== "discover" && body.mode !== "research") {
      return json({ error: "mode must be discover or research" }, 400);
    }

    const openaiKey = getEnv("openai_api_key", "OPENAI_API_KEY");
    if (!openaiKey) {
      return json({ error: "openai_api_key is not configured" }, 500);
    }

    const prompt = body.mode === "discover"
      ? discoveryPrompt(body.filters || {})
      : researchPrompt(body.lead || {});

    const { response, raw } = await callOpenAi(openaiKey, prompt);
    if (!response.ok) {
      console.error("sales-research OpenAI request failed", safeDetail(raw));
      return json({ error: "OpenAI request failed", detail: safeDetail(raw) }, 502);
    }

    const parsedResponse = JSON.parse(raw);
    const outputText = extractOutputText(parsedResponse);
    if (!outputText) {
      return json({ error: "No structured output returned" }, 502);
    }

    const result = JSON.parse(outputText);
    result.leads = (result.leads || []).slice(0, 15).map(normaliseLead);
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("sales-research failed", message);
    return json({ error: message }, 500);
  }
});

async function callOpenAi(openaiKey: string, prompt: string) {
  const first = await fetchOpenAi(openaiKey, prompt, "web_search");
  if (first.response.ok || !shouldRetryWithPreview(first.raw)) return first;
  return await fetchOpenAi(openaiKey, prompt, "web_search_preview");
}

async function fetchOpenAi(openaiKey: string, prompt: string, toolType: "web_search" | "web_search_preview") {
  const tool = toolType === "web_search"
    ? { type: "web_search", external_web_access: true }
    : { type: "web_search_preview" };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getEnv("openai_model", "OPENAI_MODEL") || "gpt-5-mini",
      tools: [tool],
      tool_choice: "auto",
      input: [
        {
          role: "system",
          content: [
            "You are n.abl's internal sales research agent.",
            "Use only public web information. Do not use LinkedIn scraping, authenticated pages, bypasses, personal enrichment, or non-public data.",
            "Prefer company websites, search result snippets, public business directories, Companies House/public registries, public news and public social/company profiles.",
            "Return concise CRM-ready records for UK SME sales prospecting.",
            "If evidence is weak, reduce confidence and say so. Do not invent emails or named people.",
          ].join(" "),
        },
        { role: "user", content: prompt },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "sales_intelligence_result",
          strict: true,
          schema: resultSchema(),
        },
      },
    }),
  });

  return { response, raw: await response.text() };
}

function shouldRetryWithPreview(raw: string) {
  const detail = safeDetail(raw).toLowerCase();
  return detail.includes("web_search") && (
    detail.includes("unsupported") ||
    detail.includes("unknown") ||
    detail.includes("invalid") ||
    detail.includes("not supported")
  );
}

async function assertAuthenticated(req: Request) {
  const supabaseUrl = getEnv("supabase_url", "SUPABASE_URL");
  const anonKey = getEnv("supabase_anon_key", "SUPABASE_ANON_KEY");
  const auth = req.headers.get("Authorization") || "";
  if (!supabaseUrl || !anonKey) throw new Error("Supabase env vars are not configured");
  if (!auth.startsWith("Bearer ")) throw new Error("Missing Supabase session");

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      "Authorization": auth,
      "apikey": anonKey,
    },
  });
  if (!userRes.ok) throw new Error("Invalid Supabase session");
}

function getEnv(lowerName: string, upperName: string) {
  return Deno.env.get(lowerName) || Deno.env.get(upperName);
}

function discoveryPrompt(filters: DiscoveryFilters) {
  return [
    "Find up to 15 realistic sales prospects for n.abl using refined public web searches. Prefer 10 to 15 when the filters are broad enough.",
    "n.abl sells practical innovation, automation and optimisation inside the tools businesses already use.",
    "Target businesses: UK SMEs already using or likely using Microsoft 365, Power Platform, Salesforce, reporting tools, spreadsheets, operations systems or CRM.",
    `Filters: industry=${filters.industry || "any"}; location=${filters.location || "UK"}; company_size=${filters.size || "any"}; business_type=${filters.type || "any"}.`,
    "For each prospect, derive score, recommendation reason, company research, public contact routes, pain points, service opportunities and outreach angle.",
    "Search intelligently: combine location + industry + operational terms, then refine using signals like reporting, multi-site, account services, onboarding, booking, stock, supplier, CRM, dashboards, manual process, contact page.",
  ].join("\n");
}

function researchPrompt(lead: ResearchLeadInput) {
  return [
    "Research this specific company using public web data and produce one CRM-ready lead record.",
    `Company: ${lead.company || "unknown"}`,
    `Website: ${lead.website || "unknown"}`,
    `Known industry: ${lead.industry || "unknown"}`,
    `Known location: ${lead.location || "unknown"}`,
    `Known size: ${lead.size || "unknown"}`,
    `Business type: ${lead.type || "unknown"}`,
    `Researcher notes/public signals already found: ${lead.signals || "none"}`,
    "Verify public signals where possible. Produce a practical n.abl sales angle. Do not invent personal contact data.",
  ].join("\n");
}

function resultSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["leads", "query_summary", "compliance_notes"],
    properties: {
      query_summary: { type: "string" },
      compliance_notes: { type: "string" },
      leads: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "company",
            "website",
            "industry",
            "location",
            "estimated_size",
            "business_type",
            "lead_score",
            "recommendation_reason",
            "company_overview",
            "recent_public_activity",
            "potential_pain_points",
            "service_opportunities",
            "suggested_outreach_angle",
            "public_contact_info",
            "contacts",
            "source_urls",
            "confidence",
            "gdpr_notes",
          ],
          properties: {
            company: { type: "string" },
            website: { type: "string" },
            industry: { type: "string" },
            location: { type: "string" },
            estimated_size: { type: "string" },
            business_type: { type: "string" },
            lead_score: { type: "integer" },
            recommendation_reason: { type: "string" },
            company_overview: { type: "string" },
            recent_public_activity: { type: "string" },
            potential_pain_points: { type: "string" },
            service_opportunities: { type: "string" },
            suggested_outreach_angle: { type: "string" },
            public_contact_info: { type: "string" },
            contacts: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "role", "email", "phone", "source", "confidence"],
                properties: {
                  name: { type: "string" },
                  role: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  source: { type: "string" },
                  confidence: { type: "integer" },
                },
              },
            },
            source_urls: {
              type: "array",
              items: { type: "string" },
            },
            confidence: { type: "integer" },
            gdpr_notes: { type: "string" },
          },
        },
      },
    },
  };
}

function normaliseLead(lead: Record<string, unknown>) {
  return {
    ...lead,
    lead_score: clampInt(lead.lead_score, 1, 100, 50),
    confidence: clampInt(lead.confidence, 1, 100, 50),
    contacts: Array.isArray(lead.contacts) ? lead.contacts.map((contact) => ({
      ...(contact as Record<string, unknown>),
      confidence: clampInt((contact as Record<string, unknown>).confidence, 1, 100, 50),
    })) : [],
    source_urls: Array.isArray(lead.source_urls) ? lead.source_urls : [],
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function extractOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = payload.output;
  if (!Array.isArray(output)) return "";
  const chunks: string[] = [];
  for (const item of output) {
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const p = part as Record<string, unknown>;
      if (typeof p.text === "string") chunks.push(p.text);
      if (typeof p.output_text === "string") chunks.push(p.output_text);
    }
  }
  return chunks.join("");
}

function safeDetail(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return parsed.error?.message || "OpenAI error";
  } catch (_) {
    return raw.slice(0, 500);
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
