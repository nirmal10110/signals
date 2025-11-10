
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// === CONFIG ===
const LIST_ID = 259344; // "All Deals"
const VOLPI_EMAIL_DOMAIN = '@volpicapital.com';
const ORG_ENTITY_TYPE_V1 = 1; // v1: 1 = organization

// === HELPERS ===
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getAffinityV1(url, apiKey) {
  const res = await fetch(url, {
    headers: {
      // v1 uses Basic auth with "KEY:" (key as username, empty password)
      Authorization: 'Basic ' + btoa(`${apiKey}:`),
      Accept: 'application/json'
    }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Affinity v1 error ${res.status} ${url} :: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function listFields(listId, apiKey) {
  return getAffinityV1(`https://api.affinity.co/lists/${listId}/fields`, apiKey);
}

async function listEntriesPaged(listId, apiKey) {
  let pageToken = null;
  const entries = [];
  do {
    const u = new URL(`https://api.affinity.co/lists/${listId}/list-entries`);
    u.searchParams.set('page_size', '200');
    if (pageToken) u.searchParams.set('page_token', pageToken);
    const page = await getAffinityV1(u.toString(), apiKey);
    const batch = page.list_entries || [];
    const orgOnly = batch.filter(e => e.entity_type === ORG_ENTITY_TYPE_V1);
    entries.push(...orgOnly);
    pageToken = page.page_token || null;
    console.log(`[v1 Sync] list-entries fetched=${batch.length}, org total=${entries.length}, next=${!!pageToken}`);
    await sleep(25);
  } while (pageToken);
  return entries;
}

async function getOrgFieldValues(orgId, apiKey) {
  const url = new URL('https://api.affinity.co/field-values');
  url.searchParams.set('organization_id', String(orgId));
  return getAffinityV1(url.toString(), apiKey);
}

async function getOrganization(orgId, apiKey) {
  return getAffinityV1(`https://api.affinity.co/organizations/${orgId}`, apiKey);
}

async function getPerson(personId, apiKey) {
  return getAffinityV1(`https://api.affinity.co/persons/${personId}`, apiKey);
}

const pickVolpiEmails = (person) => {
  const emails = (person.emails || []).map(e => (e.email || '').toLowerCase()).filter(Boolean);
  return emails.filter(e => e.endsWith(VOLPI_EMAIL_DOMAIN));
};

// === MAIN ===
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const API_KEY = Deno.env.get('Affinity_API')?.trim();
    if (!API_KEY) throw new Error('Missing Affinity_API secret.');

    console.log('[v1 Sync] Starting sync (Monitor dropdown = "Active")…');

    // 1) Fields (list-specific)
    const fields = await listFields(LIST_ID, API_KEY);
    const want = [
      'MONITOR',
      'VOLPI OWNER',
      'LINKEDIN URL',
      'LINKEDIN PROFILE (FOUNDERS/CEOS)',
      'LAST INVESTMENT DATE'
    ];
    const fieldMap = {};
    for (const f of fields) {
      const key = (f.name || '').trim().toUpperCase();
      if (want.includes(key)) fieldMap[key] = f.id;
    }
    console.log('[v1 Sync] Field IDs:', fieldMap);
    if (!fieldMap['MONITOR']) throw new Error('Could not find "Monitor" field on this list.');

    // 2) Org entries
    const entries = await listEntriesPaged(LIST_ID, API_KEY);
    console.log(`[v1 Sync] Organization entries: ${entries.length}`);

    // 3) Filter MONITOR = "Active" (dropdown/single/multi/text-safe)
    const monitoredOrgIds = [];
    for (const e of entries) {
      const fvs = await getOrgFieldValues(e.entity_id, API_KEY);
      const mon = fvs.find(v => v.field_id === fieldMap['MONITOR']);
      const val = mon?.value;
      let isActive = false;

      if (Array.isArray(val)) {
        isActive = val.some(v => (v?.label || v?.name || '').toLowerCase() === 'active');
      } else if (typeof val === 'object' && val) {
        isActive = ((val.label || val.name || '').toLowerCase() === 'active');
      } else if (typeof val === 'string') {
        isActive = val.trim().toLowerCase() === 'active';
      }

      if (isActive) monitoredOrgIds.push(e.entity_id);
      await sleep(15);
    }
    console.log(`[v1 Sync] MONITOR="Active" org count: ${monitoredOrgIds.length}`);
    if (monitoredOrgIds.length === 0) {
      return Response.json({ success: true, message: 'No MONITOR="Active" orgs.' });
    }

    // 4) Enrich + build payload
    const personCache = new Map();
    const getPersonCached = async (id) => {
      if (personCache.has(id)) return personCache.get(id);
      const p = await getPerson(id, API_KEY);
      personCache.set(id, p);
      await sleep(20);
      return p;
    };

    const companiesToSync = [];
    for (const orgId of monitoredOrgIds) {
      const org = await getOrganization(orgId, API_KEY);
      const fvs = await getOrgFieldValues(orgId, API_KEY);
      const fvMap = new Map(fvs.map(v => [v.field_id, v.value]));

      const linkedinCompany = (fvMap.get(fieldMap['LINKEDIN URL']) || '').toString().trim();
      const linkedinFounder = (fvMap.get(fieldMap['LINKEDIN PROFILE (FOUNDERS/CEOS)']) || '').toString().trim();
      const lastInvestment = fvMap.get(fieldMap['LAST INVESTMENT DATE']) ? String(fvMap.get(fieldMap['LAST INVESTMENT DATE'])) : '';

      // Volpi Owners -> only @volpicapital.com
      const ownerVal = fvMap.get(fieldMap['VOLPI OWNER']);
      let relationshipOwners = [];
      if (ownerVal) {
        const personIds = Array.isArray(ownerVal)
          ? ownerVal.map(x => x.person_id).filter(Boolean)
          : [ownerVal.person_id].filter(Boolean);

        for (const pid of personIds) {
          try {
            const p = await getPersonCached(pid);
            const emails = pickVolpiEmails(p);
            for (const em of emails) {
              relationshipOwners.push({ name: `${p.first_name || ''} ${p.last_name || ''}`.trim(), email: em });
            }
          } catch (err) {
            console.warn('[v1 Sync] Could not fetch person', pid, err);
          }
        }
      }

      companiesToSync.push({
        name: org.name,
        affinity_id: String(org.id),
        website: (org.domain || '').replace(/^https?:\/\//, ''),
        linkedin_url: linkedinCompany || linkedinFounder,
        founder_ceo_linkedin: linkedinFounder || '',
        investment_date: lastInvestment,
        monitoring_active: true,
        tier: 'tier_1',
        relationship_owners,
        notes: `Synced from Affinity (v1) on ${new Date().toISOString().slice(0, 10)}`
      });

      await sleep(15);
    }

    // 5) Upsert & deactivate
    console.log(`[v1 Sync] Syncing ${companiesToSync.length} companies to Base44…`);
    const existing = await base44.asServiceRole.entities.Company.list();
    const byId = new Map(existing.map(c => [c.affinity_id, c]));
    const activeIds = new Set(companiesToSync.map(c => c.affinity_id));

    let created = 0, updated = 0, deactivated = 0;
    for (const co of companiesToSync) {
      const ex = byId.get(co.affinity_id);
      if (ex) {
        await base44.asServiceRole.entities.Company.update(ex.id, co);
        updated++;
      } else {
        await base44.asServiceRole.entities.Company.create(co);
        created++;
      }
    }

    for (const ex of existing) {
      if (ex.affinity_id && !activeIds.has(ex.affinity_id) && ex.monitoring_active) {
        await base44.asServiceRole.entities.Company.update(ex.id, { monitoring_active: false });
        deactivated++;
      }
    }

    const msg = `Sync complete. Created: ${created}, Updated: ${updated}, Deactivated: ${deactivated}.`;
    console.log('[v1 Sync]', msg);
    return Response.json({ success: true, message: msg, synced: created, updated, deactivated });

  } catch (err) {
    console.error('[v1 Sync] Critical error:', err);
    return Response.json({ error: err.message || String(err) }, { status: 500 });
  }
});
