import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const LIST_ID = 323480; // Changed to new list ID

// Field names in Affinity
const FIELD_NAMES = {
  VOLPI_OWNER: "VOLPI OWNER",
  LINKEDIN_URL: "LINKEDIN URL",
  LAST_INVESTMENT_DATE: "LAST INVESTMENT DATE",
};

function basicHeader(key) {
  const credentials = `:${key}`;
  const encoded = btoa(credentials);
  return `Basic ${encoded}`;
}

async function getJson(url, headers) {
  const r = await fetch(url, { headers });
  const text = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${url} :: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}

function toUc(s) {
  return (s ?? "").toString().trim().toUpperCase();
}

// Extract field value from Affinity field-values response
function extractFieldValue(v) {
  if (v == null) return null;

  // Direct boolean/number/string
  if (typeof v.value === "boolean" || typeof v.value === "number" || typeof v.value === "string") {
    return v.value;
  }

  // Typed props
  if (typeof v.value_text === "string") return v.value_text;
  if (typeof v.value_url === "string") return v.value_url;
  if (typeof v.value_date === "string") return v.value_date;
  if (typeof v.date === "string") return v.date;

  // Person/org reference
  if (typeof v.person_id === "number") return { person_id: v.person_id };
  if (typeof v.organization_id === "number") return { organization_id: v.organization_id };

  // Fallback to JSON
  return (typeof v.value === "object" && v.value !== null) ? JSON.stringify(v.value) : null;
}

async function getCompaniesFromList(key) {
  const H = { Authorization: basicHeader(key), Accept: "application/json" };

  // 1) Load fields and map the IDs we need
  const fieldsResp = await getJson("https://api.affinity.co/fields", H);
  if (!Array.isArray(fieldsResp)) {
    throw new Error(`Unexpected /fields response (wanted array): ${JSON.stringify(fieldsResp).slice(0, 300)}`);
  }

  const ids = {
    volpiOwner: undefined,
    linkedin: undefined,
    lastInvDate: undefined
  };

  // Prefer list-specific matches, fall back to global by name
  function pickFieldId(targetName) {
    const T = toUc(targetName);
    // pass 1: exact name + this list_id
    for (const f of fieldsResp) {
      if (toUc(f?.name) === T && f?.list_id === LIST_ID) return f.id;
    }
    // pass 2: any field with that name
    for (const f of fieldsResp) {
      if (toUc(f?.name) === T) return f.id;
    }
    return undefined;
  }

  ids.volpiOwner = pickFieldId(FIELD_NAMES.VOLPI_OWNER);
  ids.linkedin = pickFieldId(FIELD_NAMES.LINKEDIN_URL);
  ids.lastInvDate = pickFieldId(FIELD_NAMES.LAST_INVESTMENT_DATE);

  if (ids.volpiOwner) console.log(`✓ Found VOLPI OWNER field (ID: ${ids.volpiOwner})`);
  if (ids.linkedin) console.log(`✓ Found LINKEDIN URL field (ID: ${ids.linkedin})`);
  if (ids.lastInvDate) console.log(`✓ Found LAST INVESTMENT DATE field (ID: ${ids.lastInvDate})`);

  // 2) Collect organization IDs from the list (paginate)
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

  console.log(`✓ Found ${orgIds.length} organizations in list`);

  // 3) For each org, pull other fields + org profile
  const out = [];

  for (const id of orgIds) {
    // Get field values
    const fvUrl = new URL("https://api.affinity.co/field-values");
    fvUrl.searchParams.set("organization_id", String(id));
    const fvs = await getJson(fvUrl.toString(), H);
    const arr = Array.isArray(fvs) ? fvs : [];

    // Extract extra fields
    let volpiOwner = null;
    let volpiOwnerEmail = null;
    let linkedInUrl = null;
    let lastInvestmentDate = null;

    for (const v of arr) {
      // VOLPI OWNER FIELD - it's a person ID, need to fetch person details
      if (ids.volpiOwner && v?.field_id === ids.volpiOwner) {
        const val = extractFieldValue(v);

        if (typeof val === "number") {
          // It's a person ID - fetch the person details
          try {
            const person = await getJson(`https://api.affinity.co/persons/${val}`, H);
            const firstName = person?.first_name || "";
            const lastName = person?.last_name || "";
            volpiOwner = [firstName, lastName].filter(Boolean).join(" ");

            // Get primary email
            if (person?.emails && Array.isArray(person.emails) && person.emails.length > 0) {
              volpiOwnerEmail = person.emails[0];
            }
          } catch (err) {
            console.error(`Failed to fetch person ${val}:`, err.message);
          }
        } else if (typeof val === "string" && val.trim()) {
          // It's direct text (fallback)
          volpiOwner = val.trim();
          // Try to extract email if it's in the string
          const emailMatch = val.match(/[\w.-]+@[\w.-]+\.\w+/);
          if (emailMatch) {
            volpiOwnerEmail = emailMatch[0];
          }
        }
      }

      // LinkedIn URL
      if (ids.linkedin && v?.field_id === ids.linkedin && linkedInUrl == null) {
        const val = extractFieldValue(v);
        linkedInUrl = (typeof val === "string" && val.includes("linkedin")) ? val : (typeof val === "string" ? val : null);
      }

      // Last Investment Date
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

    // Get organization profile for website
    const org = await getJson(`https://api.affinity.co/organizations/${id}`, H);
    const name = (org?.name ?? "").toString();
    let website = null;

    if (org?.website && typeof org.website === "string" && org.website.trim()) {
      website = org.website.trim();
    } else if (org?.domain && typeof org.domain === "string" && org.domain.trim()) {
      website = `https://${org.domain.trim()}`;
    }

    out.push({
      company: name,
      website,
      affinity_id: id,
      volpiOwner,
      volpiOwnerEmail,
      linkedInUrl,
      lastInvestmentDate
    });

    await new Promise(r => setTimeout(r, 15));
  }

  return out;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const key = Deno.env.get("Affinity_API")?.trim();
        if (!key) {
            return Response.json({
                error: 'Missing Affinity_API secret — set your v1 API key in Base44.'
            }, { status: 500 });
        }

        console.log(`Fetching all companies from Affinity list ${LIST_ID}...`);
        const companies = await getCompaniesFromList(key);
        console.log(`✓ Found ${companies.length} companies on the list.`);

        // Get all existing companies with affinity_id to track what should be deactivated
        const allExistingCompanies = await base44.asServiceRole.entities.Company.list();
        const affinityCompaniesInDb = allExistingCompanies.filter(c => c.affinity_id);

        // Track which Affinity IDs are currently on the list
        const activeAffinityIds = new Set(companies.map(c => c.affinity_id.toString()));

        let syncedCount = 0;
        let updatedCount = 0;
        let deactivatedCount = 0;

        // Sync companies from the list
        for (const { company, website, affinity_id, volpiOwner, volpiOwnerEmail, linkedInUrl, lastInvestmentDate } of companies) {
            try {
                // Build relationship_owners array
                const relationshipOwners = [];
                if (volpiOwner && volpiOwnerEmail) {
                    relationshipOwners.push({
                        name: volpiOwner,
                        email: volpiOwnerEmail
                    });
                }

                const companyData = {
                    name: company,
                    affinity_id: affinity_id.toString(),
                    website: website ? website.replace(/^https?:\/\//, '') : '',
                    linkedin_url: linkedInUrl || '',
                    investment_date: lastInvestmentDate || '',
                    monitoring_active: true, // Always active since it's on the list
                    tier: 'tier_1',
                    relationship_owners: relationshipOwners,
                    notes: `Synced from Affinity list ${LIST_ID} on ${new Date().toISOString().split('T')[0]}${volpiOwner ? `\nVolpi Owner: ${volpiOwner}${volpiOwnerEmail ? ` (${volpiOwnerEmail})` : ''}` : ''}`
                };

                // Check if exists
                const existing = await base44.asServiceRole.entities.Company.filter({
                    affinity_id: affinity_id.toString()
                });

                if (existing.length > 0) {
                    await base44.asServiceRole.entities.Company.update(existing[0].id, companyData);
                    updatedCount++;
                } else {
                    await base44.asServiceRole.entities.Company.create(companyData);
                    syncedCount++;
                }

            } catch (error) {
                console.error(`Error syncing ${company}:`, error.message);
            }
        }

        // Deactivate companies that are no longer on the Affinity list
        for (const dbCompany of affinityCompaniesInDb) {
            if (!activeAffinityIds.has(dbCompany.affinity_id)) {
                try {
                    await base44.asServiceRole.entities.Company.update(dbCompany.id, {
                        monitoring_active: false,
                        notes: (dbCompany.notes || '') + `\n\nDeactivated on ${new Date().toISOString().split('T')[0]} - no longer on Affinity list ${LIST_ID}`
                    });
                    deactivatedCount++;
                    console.log(`✓ Deactivated: ${dbCompany.name} (no longer on list)`);
                } catch (error) {
                    console.error(`Error deactivating ${dbCompany.name}:`, error.message);
                }
            }
        }

        return Response.json({
            success: true,
            synced: syncedCount,
            updated: updatedCount,
            deactivated: deactivatedCount,
            total: companies.length,
            message: `Synced ${syncedCount + updatedCount} companies, deactivated ${deactivatedCount} from Affinity list ${LIST_ID}`
        });

    } catch (error) {
        console.error('Sync error:', error);
        return Response.json({
            error: error.message
        }, { status: 500 });
    }
});