import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const LIST_ID = 323480;

// Field names in Affinity
const FIELD_NAMES = {
  VOLPI_OWNER: "VOLPI OWNER",
  LINKEDIN_URL: "LINKEDIN URL",
  CEO_FOUNDER_LINKEDIN: "LinkedIn Profile (Founders/CEOs)",
  LAST_INVESTMENT_DATE: "LAST INVESTMENT DATE",
  EMPLOYEE_GROWTH_YOY: "Employees: Growth YoY (%)",
  RECENT_LEADERSHIP_HIRES: "Employee Hires: Last 3 Months (Leadership)",
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

function extractFieldValue(v) {
  if (v == null) return null;
  if (typeof v.value === "boolean" || typeof v.value === "number" || typeof v.value === "string") {
    return v.value;
  }
  if (typeof v.value_text === "string") return v.value_text;
  if (typeof v.value_url === "string") return v.value_url;
  if (typeof v.value_date === "string") return v.value_date;
  if (typeof v.date === "string") return v.date;

  // Modified: Directly return person_id/organization_id as number if present
  if (typeof v.person_id === "number") return v.person_id;
  if (typeof v.organization_id === "number") return v.organization_id;

  // Handle v.value being an array (e.g., for multi-select person fields)
  if (Array.isArray(v.value)) {
      const ids = [];
      for (const item of v.value) {
          if (typeof item === 'number') { // direct ID in array
              ids.push(item);
          } else if (typeof item === 'object' && item !== null && typeof item.person_id === 'number') {
              ids.push(item.person_id);
          }
      }
      if (ids.length > 0) return ids; // Return array of IDs
  }

  // Fallback for any other object value (should be rare after the above checks)
  return (typeof v.value === "object" && v.value !== null) ? JSON.stringify(v.value) : null;
}

async function getCompaniesFromList(key) {
  const H = { Authorization: basicHeader(key), Accept: "application/json" };

  const fieldsResp = await getJson("https://api.affinity.co/fields", H);
  if (!Array.isArray(fieldsResp)) {
    throw new Error(`Unexpected /fields response (wanted array): ${JSON.stringify(fieldsResp).slice(0, 300)}`);
  }

  const ids = {
    volpiOwner: undefined,
    linkedin: undefined,
    ceoFounderLinkedIn: undefined,
    lastInvDate: undefined,
    employeeGrowthYoy: undefined,
    recentLeadershipHires: undefined
  };

  function pickFieldId(targetName) {
    const T = toUc(targetName);
    for (const f of fieldsResp) {
      if (toUc(f?.name) === T && f?.list_id === LIST_ID) return f.id;
    }
    for (const f of fieldsResp) {
      if (toUc(f?.name) === T) return f.id;
    }
    return undefined;
  }

  ids.volpiOwner = pickFieldId(FIELD_NAMES.VOLPI_OWNER);
  ids.linkedin = pickFieldId(FIELD_NAMES.LINKEDIN_URL);
  ids.ceoFounderLinkedIn = pickFieldId(FIELD_NAMES.CEO_FOUNDER_LINKEDIN);
  ids.lastInvDate = pickFieldId(FIELD_NAMES.LAST_INVESTMENT_DATE);
  ids.employeeGrowthYoy = pickFieldId(FIELD_NAMES.EMPLOYEE_GROWTH_YOY);
  ids.recentLeadershipHires = pickFieldId(FIELD_NAMES.RECENT_LEADERSHIP_HIRES);

  if (ids.volpiOwner) console.log(`✓ Found VOLPI OWNER field (ID: ${ids.volpiOwner})`);
  if (ids.linkedin) console.log(`✓ Found LINKEDIN URL field (ID: ${ids.linkedin})`);
  if (ids.ceoFounderLinkedIn) console.log(`✓ Found LinkedIn Profile (Founders/CEOs) field (ID: ${ids.ceoFounderLinkedIn})`);
  if (ids.lastInvDate) console.log(`✓ Found LAST INVESTMENT DATE field (ID: ${ids.lastInvDate})`);
  if (ids.employeeGrowthYoy) console.log(`✓ Found Employees: Growth YoY (%) field (ID: ${ids.employeeGrowthYoy})`);
  if (ids.recentLeadershipHires) console.log(`✓ Found Employee Hires: Last 3 Months (Leadership) field (ID: ${ids.recentLeadershipHires})`);

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
    
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`✓ Found ${orgIds.length} organizations in list`);

  const out = [];

  for (const id of orgIds) {
    const fvUrl = new URL("https://api.affinity.co/field-values");
    fvUrl.searchParams.set("organization_id", String(id));
    const fvs = await getJson(fvUrl.toString(), H);
    const arr = Array.isArray(fvs) ? fvs : [];
    
    await new Promise(r => setTimeout(r, 300));

    let volpiOwners = []; // Array to handle multiple owners
    let linkedInUrl = null;
    let ceoFounderLinkedInUrl = null;
    let lastInvestmentDate = null;
    let employeeGrowthYoy = null;
    let recentLeadershipHires = null;

    for (const v of arr) {
      // VOLPI OWNER FIELD - can be multiple person IDs
      if (ids.volpiOwner && v?.field_id === ids.volpiOwner) {
        const val = extractFieldValue(v);

        const processAndAddOwner = async (personId) => {
          try {
            const person = await getJson(`https://api.affinity.co/persons/${personId}`, H);
            const firstName = person?.first_name || "";
            const lastName = person?.last_name || "";
            const fullName = [firstName, lastName].filter(Boolean).join(" ");
            const email = person?.emails && Array.isArray(person.emails) && person.emails.length > 0 
              ? person.emails[0] 
              : null;

            if (fullName && email) {
              // Only add if not already present by email to prevent duplicates
              if (!volpiOwners.some(o => o.email === email)) {
                volpiOwners.push({ name: fullName, email: email, digest_frequency: 'daily' });
                console.log(`  ✓ Added Volpi owner: ${fullName} (${email})`);
              }
            }
            
            await new Promise(r => setTimeout(r, 300));
          } catch (err) {
            console.error(`Failed to fetch person ${personId}:`, err.message);
          }
        };

        // Handle array of person IDs (multi-select)
        if (Array.isArray(val)) {
          console.log(`  Found ${val.length} Volpi owners for this company`);
          for (const personId of val) {
            if (typeof personId === "number") {
              await processAndAddOwner(personId);
            }
          }
        }
        // Handle single person ID
        else if (typeof val === "number") {
          await processAndAddOwner(val);
        }
        // Handle direct text (fallback - split by comma if multiple)
        else if (typeof val === "string" && val.trim()) {
          const ownerStrings = val.split(/[,;]/).map(s => s.trim()).filter(Boolean);
          for (const ownerStr of ownerStrings) {
            const emailMatch = ownerStr.match(/[\w.-]+@[\w.-]+\.\w+/);
            if (emailMatch) {
              const email = emailMatch[0];
              let name = ownerStr.replace(email, '').trim();
              if (!name) {
                // Try to derive name from email if not present before email
                name = email.split('@')[0].replace(/[._]/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
              }
              // Only add if not already present by email
              if (!volpiOwners.some(o => o.email === email)) {
                  volpiOwners.push({ name: name, email: email, digest_frequency: 'daily' });
                  console.log(`  ✓ Added Volpi owner from text: ${name} (${email})`);
              }
            }
          }
        }
      }

      if (ids.linkedin && v?.field_id === ids.linkedin && linkedInUrl == null) {
        const val = extractFieldValue(v);
        linkedInUrl = (typeof val === "string" && val.includes("linkedin")) ? val : (typeof val === "string" ? val : null);
      }

      if (ids.ceoFounderLinkedIn && v?.field_id === ids.ceoFounderLinkedIn && ceoFounderLinkedInUrl == null) {
        const val = extractFieldValue(v);
        ceoFounderLinkedInUrl = (typeof val === "string" && val.includes("linkedin")) ? val : (typeof val === "string" ? val : null);
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

      if (ids.employeeGrowthYoy && v?.field_id === ids.employeeGrowthYoy && employeeGrowthYoy == null) {
        const val = extractFieldValue(v);
        if (val != null) {
          employeeGrowthYoy = String(val);
        }
      }

      if (ids.recentLeadershipHires && v?.field_id === ids.recentLeadershipHires && recentLeadershipHires == null) {
        const val = extractFieldValue(v);
        if (val != null) {
          recentLeadershipHires = String(val);
        }
      }
    }

    const org = await getJson(`https://api.affinity.co/organizations/${id}`, H);
    const name = (org?.name ?? "").toString();
    let website = null;

    if (org?.website && typeof org.website === "string" && org.website.trim()) {
      website = org.website.trim();
    } else if (org?.domain && typeof org.domain === "string" && org.domain.trim()) {
      website = `https://${org.domain.trim()}`;
    }

    console.log(`✓ Company: ${name} - ${volpiOwners.length} owner(s): ${volpiOwners.map(o => o.email).join(', ')}`);

    out.push({
      company: name,
      website,
      affinity_id: id,
      volpiOwners, // Array of {name, email, digest_frequency} objects
      linkedInUrl,
      ceoFounderLinkedInUrl,
      lastInvestmentDate,
      employeeGrowthYoy,
      recentLeadershipHires
    });

    await new Promise(r => setTimeout(r, 300));
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

        const allExistingCompanies = await base44.asServiceRole.entities.Company.list();
        const affinityCompaniesInDb = allExistingCompanies.filter(c => c.affinity_id);

        const activeAffinityIds = new Set(companies.map(c => c.affinity_id.toString()));

        let syncedCount = 0;
        let updatedCount = 0;
        let deletedCount = 0;

        for (const { company, website, affinity_id, volpiOwners, linkedInUrl, ceoFounderLinkedInUrl, lastInvestmentDate, employeeGrowthYoy, recentLeadershipHires } of companies) {
            try {
                const companyData = {
                    name: company,
                    affinity_id: affinity_id.toString(),
                    website: website ? website.replace(/^https?:\/\//, '') : '',
                    linkedin_url: linkedInUrl || '',
                    ceo_founder_linkedin_url: ceoFounderLinkedInUrl || '',
                    investment_date: lastInvestmentDate || '',
                    employee_growth_yoy: employeeGrowthYoy || '',
                    recent_leadership_hires: recentLeadershipHires || '',
                    monitoring_active: true,
                    tier: 'tier_1',
                    relationship_owners: volpiOwners, // Array of {name, email, digest_frequency} objects
                    notes: `Synced from Affinity list ${LIST_ID} on ${new Date().toISOString().split('T')[0]}${volpiOwners.length > 0 ? `\nVolpi Owners (${volpiOwners.length}): ${volpiOwners.map(o => `${o.name}${o.email ? ` (${o.email})` : ''}`).join(', ')}` : ''}`
                };

                const existing = await base44.asServiceRole.entities.Company.filter({
                    affinity_id: affinity_id.toString()
                });

                if (existing.length > 0) {
                    await base44.asServiceRole.entities.Company.update(existing[0].id, companyData);
                    updatedCount++;
                    console.log(`✓ Updated: ${company} with ${volpiOwners.length} owner(s)`);
                } else {
                    await base44.asServiceRole.entities.Company.create(companyData);
                    syncedCount++;
                    console.log(`✓ Created: ${company} with ${volpiOwners.length} owner(s)`);
                }

                // Rate limiting: 500ms between each company operation
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error(`Error syncing ${company}:`, error.message);
            }
        }

        // Delete companies that are no longer on the Affinity list
        for (const dbCompany of affinityCompaniesInDb) {
            if (!activeAffinityIds.has(dbCompany.affinity_id)) {
                try {
                    // First, delete all alerts associated with this company
                    const companyAlerts = await base44.asServiceRole.entities.Alert.filter({
                        company_id: dbCompany.id
                    });
                    
                    for (const alert of companyAlerts) {
                        await base44.asServiceRole.entities.Alert.delete(alert.id);
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                    
                    // Then delete the company itself
                    await base44.asServiceRole.entities.Company.delete(dbCompany.id);
                    deletedCount++;
                    console.log(`✓ Deleted: ${dbCompany.name} (no longer on Affinity list) + ${companyAlerts.length} alerts`);
                    
                    // Rate limiting: 500ms between each deletion
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (error) {
                    console.error(`Error deleting ${dbCompany.name}:`, error.message);
                    // Continue with next company even if one fails
                }
            }
        }

        return Response.json({
            success: true,
            synced: syncedCount,
            updated: updatedCount,
            deleted: deletedCount,
            total: companies.length,
            message: `Synced ${syncedCount + updatedCount} companies, deleted ${deletedCount} from Base44 (no longer on Affinity list ${LIST_ID})`
        });

    } catch (error) {
        console.error('Sync error:', error);
        return Response.json({
            error: error.message
        }, { status: 500 });
    }
});