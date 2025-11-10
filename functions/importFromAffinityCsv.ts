
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { parse } from 'npm:csv-parse@5.5.6/sync';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const formData = await req.formData();
        const file = formData.get('file');

        if (!file) {
            return Response.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const fileContent = await file.text();

        // Parse the CSV content
        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });

        const companiesToSync = records.map(record => {
            // Find relevant fields, case-insensitively
            const nameKey = Object.keys(record).find(k => k.toLowerCase() === 'organization name' || k.toLowerCase() === 'name');
            const websiteKey = Object.keys(record).find(k => k.toLowerCase() === 'domain' || k.toLowerCase() === 'website');
            const ownerKey = Object.keys(record).find(k => k.toLowerCase() === 'volpi owner');

            const owners = (record[ownerKey] || '').split(';').map(name => name.trim()).filter(Boolean);
            
            // This is a placeholder for generating emails from names, which is not reliable.
            // Best to rely on the manual bulk-edit feature for owner emails.
            const relationshipOwners = owners.map(name => ({ name, email: '' }));
            
            return {
                name: record[nameKey] || 'Unknown Name',
                website: record[websiteKey] || '',
                relationship_owners: relationshipOwners,
                monitoring_active: true,
                tier: 'tier_1',
            };
        }).filter(c => c.website); // Only sync companies with a website

        if (companiesToSync.length === 0) {
            return Response.json({ created: 0, updated: 0, message: "No companies with websites found in the CSV." });
        }
        
        const allExistingCompanies = await base44.asServiceRole.entities.Company.list();
        const existingMap = new Map(allExistingCompanies.map(c => [c.website, c]));
        
        let createdCount = 0;
        let updatedCount = 0;

        for (const companyData of companiesToSync) {
            const existing = existingMap.get(companyData.website);
            if (existing) {
                // Keep existing owners unless new ones are specified
                const updateData = { ...companyData };
                if (companyData.relationship_owners.length === 0) {
                    delete updateData.relationship_owners;
                }
                await base44.asServiceRole.entities.Company.update(existing.id, updateData);
                updatedCount++;
            } else {
                await base44.asServiceRole.entities.Company.create(companyData);
                createdCount++;
            }
        }
        
        return Response.json({ 
            created: createdCount, 
            updated: updatedCount, 
            message: `Successfully synced ${createdCount + updatedCount} companies.` 
        });

    } catch (error) {
        console.error('[CSV Import] Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});
