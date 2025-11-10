import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// This function is an adaptation of the user-provided script.

// === CONFIG ===
const LIST_ID = 259344;
const MONITOR_FIELD_NAME = "MONITOR";
const politePacingMs = 15;

// === HELPERS ===
function basicHeader(key) {
  // Correct v1 basic auth is key as username, empty password
  return "Basic " + btoa(`${key}:`);
}

async function getJson(url, headers) {
  const r = await fetch(url, { headers });
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${url} :: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// === MAIN ===
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Auth check to ensure only logged-in users can run this
    await base44.auth.me();

    const key = Deno.env.get("Affinity_API");
    if (!key) throw new Error("Missing AFFINITY_API (v1 key) in Secrets.");
    const H = { Authorization: basicHeader(key), Accept: "application/json" };
    
    console.log("[v1_simple] Starting test run...");

    // 1) Resolve MONITOR field id
    const fieldsResp = await getJson("https://api.affinity.co/fields", H);
    if (!Array.isArray(fieldsResp)) {
      throw new Error(`Unexpected /fields response (wanted array): ${JSON.stringify(fieldsResp).slice(0, 300)}`);
    }

    let monitorFieldId;
    for (const f of fieldsResp) {
      if (f && (f.name || "").toString().toUpperCase() === MONITOR_FIELD_NAME && f.list_id === LIST_ID) {
        monitorFieldId = f.id; break;
      }
    }
    if (!monitorFieldId) {
      for (const f of fieldsResp) {
        if (f && (f.name || "").toString().toUpperCase() === MONITOR_FIELD_NAME) {
          monitorFieldId = f.id; break;
        }
      }
    }
    if (!monitorFieldId) throw new Error(`Field "${MONITOR_FIELD_NAME}" not found on list ${LIST_ID}.`);
    console.log(`[v1_simple] Found MONITOR field ID: ${monitorFieldId}`);

    // 2) Collect organization IDs from the list
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
    console.log(`[v1_simple] Found ${orgIds.length} total organization entries.`);

    // 3) For each org: check MONITOR==true, then fetch details
    const out = [];
    for (const id of orgIds) {
      const fvUrl = new URL("https://api.affinity.co/field-values");
      fvUrl.searchParams.set("organization_id", String(id));
      const fvs = await getJson(fvUrl.toString(), H);
      const arr = Array.isArray(fvs) ? fvs : [];

      let isMonitorTrue = false;
      for (const v of arr) {
        if (v && v.field_id === monitorFieldId) {
          const val = v.value;
          // Handle boolean true, number 1, or string "true"
          if (val === true || val === 1 || (typeof val === "string" && val.toLowerCase() === "true")) {
            isMonitorTrue = true; break;
          }
        }
      }
      if (!isMonitorTrue) continue;

      const org = await getJson(`https://api.affinity.co/organizations/${id}`, H);
      const name = (org?.name ?? "Unknown").toString();
      let website = null;

      if (org?.website && typeof org.website === "string" && org.website.trim()) {
        website = org.website.trim();
      } else if (org?.domain && typeof org.domain === "string" && org.domain.trim()) {
        website = `https://${org.domain.trim()}`;
      }

      out.push({ company: name, website });
      await sleep(politePacingMs);
    }
    
    console.log(`[v1_simple] Test complete. Found ${out.length} monitored companies.`);
    return Response.json(out);

  } catch (error) {
    console.error('[getMonitorCompanies_v1_simple] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});