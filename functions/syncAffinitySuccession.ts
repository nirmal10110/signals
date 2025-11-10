import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

const SUCCESSION_LIST_ID = 323947;

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
  if (typeof v.person_id === "number") return { person_id: v.person_id };
  if (typeof v.organization_id === "number") return { organization_id: v.organization_id };
  return (typeof v.value === "object" && v.value !== null) ? JSON.stringify(v.value) : null;
}

async function getSuccessionProspectsFromList(key) {
  const H = { Authorization: basicHeader(key), Accept: "application/json" };

  // Load fields and map the IDs we need
  const fieldsResp = await getJson("https://api.affinity.co/fields", H);
  if (!Array.isArray(fieldsResp)) {
    throw new Error(`Unexpected /fields response: ${JSON.stringify(fieldsResp).slice(0, 300)}`);
  }

  const ids = {
    linkedinProfile: undefined,
    volpiOwner: undefined
  };

  function pickFieldId(targetName) {
    const T = toUc(targetName);
    for (const f of fieldsResp) {
      if (toUc(f?.name) === T && f?.list_id === SUCCESSION_LIST_ID) return f.id;
    }
    for (const f of fieldsResp) {
      if (toUc(f?.name) === T) return f.id;
    }
    return undefined;
  }

  ids.linkedinProfile = pickFieldId("LINKEDIN PROFILE (FOUNDERS/CEOS)");
  ids.volpiOwner = pickFieldId("VOLPI OWNER");

  if (ids.linkedinProfile) console.log(`✓ Found LinkedIn Profile field (ID: ${ids.linkedinProfile})`);
  if (ids.volpiOwner) console.log(`✓ Found Volpi Owner field (ID: ${ids.volpiOwner})`);

  // Collect ALL organization IDs from the succession list (with proper pagination)
  const orgIds = [];
  let pageToken = null;
  let pageCount = 0;

  console.log('Starting pagination to fetch all organizations...');

  while (true) {
    const u = new URL(`https://api.affinity.co/lists/${SUCCESSION_LIST_ID}/list-entries`);
    u.searchParams.set("page_size", "500"); // Increased from 200
    if (pageToken) u.searchParams.set("page_token", pageToken);

    const page = await getJson(u.toString(), H);
    const entries = Array.isArray(page?.list_entries) ? page.list_entries : [];
    
    pageCount++;
    console.log(`Page ${pageCount}: Found ${entries.length} entries`);
    
    for (const le of entries) {
      if (le && (le.entity_type === 1 || typeof le.entity_type === "undefined")) {
        if (typeof le.entity_id === "number") orgIds.push(le.entity_id);
      }
    }
    
    pageToken = page?.page_token;
    
    // Important: Check if there are more pages
    if (!pageToken || entries.length === 0) {
      console.log('✓ Pagination complete');
      break;
    }
    
    // Rate limit between pages
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`✓ Found ${orgIds.length} total organizations in succession list`);

  const out = [];

  // Process organizations
  for (let i = 0; i < orgIds.length; i++) {
    const id = orgIds[i];
    
    if (i % 50 === 0) {
      console.log(`Processing organization ${i + 1}/${orgIds.length}...`);
    }

    try {
      const fvUrl = new URL("https://api.affinity.co/field-values");
      fvUrl.searchParams.set("organization_id", String(id));
      const fvs = await getJson(fvUrl.toString(), H);
      const arr = Array.isArray(fvs) ? fvs : [];

      let linkedinUrl = null;
      let volpiOwner = null;
      let volpiOwnerEmail = null;

      for (const v of arr) {
        // LinkedIn Profile field
        if (ids.linkedinProfile && v?.field_id === ids.linkedinProfile && linkedinUrl == null) {
          const val = extractFieldValue(v);
          if (typeof val === "string" && val.includes("linkedin")) {
            linkedinUrl = val.trim();
          }
        }

        // Volpi Owner field
        if (ids.volpiOwner && v?.field_id === ids.volpiOwner) {
          const val = extractFieldValue(v);

          if (typeof val === "number") {
            try {
              const person = await getJson(`https://api.affinity.co/persons/${val}`, H);
              const firstName = person?.first_name || "";
              const lastName = person?.last_name || "";
              volpiOwner = [firstName, lastName].filter(Boolean).join(" ");

              if (person?.emails && Array.isArray(person.emails) && person.emails.length > 0) {
                volpiOwnerEmail = person.emails[0];
              }
              
              await new Promise(r => setTimeout(r, 300));
            } catch (err) {
              console.error(`Failed to fetch person ${val}:`, err.message);
            }
          } else if (typeof val === "string" && val.trim()) {
            volpiOwner = val.trim();
            const emailMatch = val.match(/[\w.-]+@[\w.-]+\.\w+/);
            if (emailMatch) {
              volpiOwnerEmail = emailMatch[0];
            }
          }
        }
      }

      // Get organization name
      const org = await getJson(`https://api.affinity.co/organizations/${id}`, H);
      const name = (org?.name ?? "").toString();

      // Only include if we have a LinkedIn URL
      if (linkedinUrl) {
        out.push({
          company: name,
          affinity_id: id,
          linkedinUrl,
          volpiOwner,
          volpiOwnerEmail
        });
      }

      // Rate limiting: 400ms between organizations
      await new Promise(r => setTimeout(r, 400));
      
    } catch (err) {
      console.error(`Error processing org ${id}:`, err.message);
    }
  }

  console.log(`✓ Collected ${out.length} prospects with LinkedIn profiles`);
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
                error: 'Missing Affinity_API secret'
            }, { status: 500 });
        }

        console.log(`Fetching succession prospects from Affinity list ${SUCCESSION_LIST_ID}...`);
        const prospects = await getSuccessionProspectsFromList(key);
        console.log(`✓ Found ${prospects.length} prospects with LinkedIn profiles.`);

        let syncedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        // Process in batches to avoid overwhelming the database
        for (let i = 0; i < prospects.length; i++) {
            const { company, affinity_id, linkedinUrl, volpiOwner, volpiOwnerEmail } = prospects[i];
            
            if (i % 50 === 0) {
                console.log(`Syncing ${i + 1}/${prospects.length} to database...`);
            }
            
            try {
                const relationshipOwners = [];
                if (volpiOwner && volpiOwnerEmail) {
                    relationshipOwners.push({
                        name: volpiOwner,
                        email: volpiOwnerEmail
                    });
                }

                const checkData = {
                    company_name: company,
                    affinity_id: affinity_id.toString(),
                    linkedin_url: linkedinUrl,
                    relationship_owners: relationshipOwners,
                    active: true,
                    notes: `Synced from Affinity succession list ${SUCCESSION_LIST_ID} on ${new Date().toISOString().split('T')[0]}`
                };

                const existing = await base44.asServiceRole.entities.SuccessionCheck.filter({
                    affinity_id: affinity_id.toString()
                });

                if (existing.length > 0) {
                    await base44.asServiceRole.entities.SuccessionCheck.update(existing[0].id, checkData);
                    updatedCount++;
                } else {
                    await base44.asServiceRole.entities.SuccessionCheck.create(checkData);
                    syncedCount++;
                }

                // CRITICAL: Slower rate limiting to avoid Base44 429 errors (1 second between creates)
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error(`Error syncing ${company}:`, error.message);
                skippedCount++;
                
                // If rate limited, wait longer
                if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
                    console.log('Rate limited - waiting 5 seconds...');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
        }

        return Response.json({
            success: true,
            synced: syncedCount,
            updated: updatedCount,
            skipped: skippedCount,
            total: prospects.length,
            message: `Synced ${syncedCount + updatedCount} succession prospects from Affinity list ${SUCCESSION_LIST_ID} (${skippedCount} skipped)`
        });

    } catch (error) {
        console.error('Sync error:', error);
        return Response.json({
            error: error.message
        }, { status: 500 });
    }
});