
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const LIST_ID = 259344;

const FIELD_NAMES = {
  MONITOR: "MONITOR",
  VOLPI_OWNER: "VOLPI OWNER",
  LINKEDIN_URL: "LINKEDIN URL",
  LAST_INVESTMENT_DATE: "LAST INVESTMENT DATE",
};

function basicHeader(key) {
  return "Basic " + btoa(`${key}:`);
}

async function getJson(url, headers) {
  const r = await fetch(url, { headers });
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${url} :: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

function toUc(s) { return (s ?? "").toString().trim().toUpperCase(); }

function extractFieldValue(v) {
  if (v == null) return null;
  if (typeof v.value === "boolean" || typeof v.value === "number" || typeof v.value === "string") return v.value;
  if (typeof v.value_text === "string") return v.value_text;
  if (typeof v.value_url === "string") return v.value_url;
  if (typeof v.value_date === "string") return v.value_date;
  if (typeof v.date === "string") return v.date;
  if (typeof v.person_id === "number") return { person_id: v.person_id };
  if (typeof v.organization_id === "number") return { organization_id: v.organization_id };
  return (typeof v.value === "object" && v.value !== null) ? JSON.stringify(v.value) : null;
}

function pickFieldId(targetName, fieldsResp, listId) {
    const T = toUc(targetName);
    for (const f of fieldsResp) { if (toUc(f?.name) === T && f?.list_id === listId) return f.id; }
    for (const f of fieldsResp) { if (toUc(f?.name) === T) return f.id; }
    return undefined;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    await base44.auth.me();

    const key = Deno.env.get("Affinity_API");
    if (!key) throw new Error("Missing AFFINITY_API (v1 key) in Secrets.");
    const H = { Authorization: basicHeader(key), Accept: "application/json" };

    const fieldsResp = await getJson("https://api.affinity.co/fields", H);
    if (!Array.isArray(fieldsResp)) {
      throw new Error(`Unexpected /fields response (wanted array): ${JSON.stringify(fieldsResp).slice(0, 300)}`);
    }

    let ids = { monitor: undefined, volpiOwner: undefined, linkedin: undefined, lastInvDate: undefined };

    ids.monitor = pickFieldId(FIELD_NAMES.MONITOR, fieldsResp, LIST_ID);
    ids.volpiOwner = pickFieldId(FIELD_NAMES.VOLPI_OWNER, fieldsResp, LIST_ID);
    ids.linkedin = pickFieldId(FIELD_NAMES.LINKEDIN_URL, fieldsResp, LIST_ID);
    ids.lastInvDate = pickFieldId(FIELD_NAMES.LAST_INVESTMENT_DATE, fieldsResp, LIST_ID);

    if (!ids.monitor) throw new Error(`Field "${FIELD_NAMES.MONITOR}" not found on list ${LIST_ID}.`);

    const orgIds = [];
    let pageToken;
    while (true) {
      const u = new URL(`https://api.affinity.co/lists/${LIST_ID}/list-entries`);
      u.searchParams.set("page_size", "200");
      if (pageToken) u.searchParams.set("page_token", pageToken);

      const page = await getJson(u.toString(), H);
      const entries = Array.isArray(page?.list_entries) ? page.list_entries : [];
      for (const le of entries) {
        if (le && (le.entity_type === 1 || typeof le.entity_type === "undefined")) {
          if (typeof le.entity_id === "number") orgIds.push(le.entity_id);
        }
      }
      pageToken = page?.page_token;
      if (!pageToken) break;
    }

    const out = [];

    for (const id of orgIds) {
      const fvUrl = new URL("https://api.affinity.co/field-values");
      fvUrl.searchParams.set("organization_id", String(id));
      const fvs = await getJson(fvUrl.toString(), H);
      const arr = Array.isArray(fvs) ? fvs : [];

      let isMonitorTrue = false;
      for (const v of arr) {
        if (v && v.field_id === ids.monitor) {
          const val = extractFieldValue(v);
          if (val === true || val === 1 || (typeof val === "string" && val.toLowerCase() === "true")) {
            isMonitorTrue = true; break;
          }
        }
      }
      if (!isMonitorTrue) continue;

      let volpiOwner = null, linkedInUrl = null, lastInvestmentDate = null;

      for (const v of arr) {
        if (ids.volpiOwner && v?.field_id === ids.volpiOwner && volpiOwner == null) {
          const val = extractFieldValue(v);
          if (val && typeof val === "object" && "person_id" in val) {
            try {
              const p = await getJson(`https://api.affinity.co/persons/${val.person_id}`, H);
              volpiOwner = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || null;
            } catch { volpiOwner = null; }
          } else if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
            volpiOwner = String(val);
          }
        }
        if (ids.linkedin && v?.field_id === ids.linkedin && linkedInUrl == null) {
          const val = extractFieldValue(v);
          linkedInUrl = (typeof val === "string" && val.includes("linkedin")) ? val : (typeof val === "string" ? val : null);
        }
        if (ids.lastInvDate && v?.field_id === ids.lastInvDate && lastInvestmentDate == null) {
          const val = extractFieldValue(v);
          if (typeof val === "string") {
            const m = val.match(/\d{4}-\d{2}-\d{2}/);
            lastInvestmentDate = m ? m[0] : val;
          } else if (val != null) {
            lastInvestmentDate = String(val);
          }
        }
      }

      const org = await getJson(`https://api.affinity.co/organizations/${id}`, H);
      let website = null;
      if (org?.website && typeof org.website === "string" && org.website.trim()) {
        website = org.website.trim();
      } else if (org?.domain && typeof org.domain === "string" && org.domain.trim()) {
        website = `https://${org.domain.trim()}`;
      }

      out.push({
        company: (org?.name ?? "").toString(),
        website,
        volpiOwner,
        linkedInUrl,
        lastInvestmentDate,
      });

      await new Promise(r => setTimeout(r, 15));
    }

    return Response.json(out);

  } catch (error) {
      console.error('[getMonitorCompanies_v1_extended] Error:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
  }
});
