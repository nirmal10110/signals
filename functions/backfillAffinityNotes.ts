import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { format } from "npm:date-fns@3.6.0";

const TIER_1_TASK_TRIGGERS = new Set([
    'ceo_hiring', 'cfo_hiring', 'head_of_sales_hiring', 'head_of_delivery_hiring',
    'executive_hiring', 'board_member_hired', 'headcount_growth', 'financial_results',
    'funding_round', 'acquisition_announced', 'international_expansion', 
    'new_office_opened', 'culture_initiative', 'birthday_reminder', 'event_participation'
]);

async function pushAlertToAffinity(alert, affinityApiKey, organizationId) {
    const authHeader = 'Basic ' + btoa(':' + affinityApiKey);
    
    try {
        // Determine when the alert was sent (use created_date as fallback)
        const sentDate = alert.created_date;
        const detectedDate = alert.detected_date || alert.created_date;
        
        const noteContent = `
═══════════════════════════════════════
🔔 VOLPI LENS ALERT (HISTORICAL)
═══════════════════════════════════════

${alert.headline}

${alert.summary || ''}

📅 Detected: ${format(new Date(detectedDate), "MMMM d, yyyy")}
📤 Originally Sent: ${format(new Date(sentDate), "MMMM d, yyyy")}
🏷️ Type: ${alert.trigger_type.replace(/_/g, ' ').toUpperCase()}
⭐ Priority: ${alert.priority.toUpperCase()}
${alert.tier === 'tier_1' ? '🚨 TIER 1 - MUST FOLLOW UP' : ''}

${alert.source_url ? `🔗 Source: ${alert.source_url}` : ''}

${alert.actionable_insight ? `\n💡 Actionable Insight:\n${alert.actionable_insight}` : ''}

${alert.draft_email ? `\n📧 Suggested Outreach:\n${alert.draft_email}` : ''}

───────────────────────────────────────
Sent to: ${(alert.sent_to || []).join(', ')}
Backfilled from Volpi Lens Intelligence Platform
`.trim();

        const noteResponse = await fetch('https://api.affinity.co/notes', {
            method: 'POST',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify({ organization_ids: [organizationId], content: noteContent })
        });

        if (!noteResponse.ok) {
            const errorText = await noteResponse.text();
            return { success: false, reason: 'Note creation failed', error: errorText };
        }

        const noteData = await noteResponse.json();
        
        // Create task only for Tier 1 triggers that weren't already actioned
        if (TIER_1_TASK_TRIGGERS.has(alert.trigger_type) && alert.status !== 'actioned') {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 3);

            const taskResponse = await fetch('https://api.affinity.co/tasks', {
                method: 'POST',
                headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization_ids: [organizationId],
                    content: `[VOLPI LENS] Follow up: ${alert.headline}`,
                    due_date: dueDate.toISOString().split('T')[0]
                })
            });

            return { 
                success: true, 
                note_id: noteData.id, 
                task_created: taskResponse.ok 
            };
        }

        return { success: true, note_id: noteData.id, task_created: false };
    } catch (error) {
        return { success: false, reason: error.message };
    }
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        console.log('\n🔄 Starting Affinity backfill for historical alerts...\n');

        const affinityApiKey = Deno.env.get("Affinity_API");
        if (!affinityApiKey) {
            return Response.json({ 
                error: 'Affinity API key not set',
                details: 'Please set the Affinity_API secret in app settings'
            }, { status: 500 });
        }

        const authHeader = 'Basic ' + btoa(':' + affinityApiKey);

        // Get all alerts that have been sent (have sent_to populated)
        const allAlerts = await base44.asServiceRole.entities.Alert.list('-created_date');
        const sentAlerts = allAlerts.filter(alert => alert.sent_to && alert.sent_to.length > 0);

        console.log(`📊 Found ${sentAlerts.length} historical alerts that were sent`);

        if (sentAlerts.length === 0) {
            return Response.json({
                success: true,
                message: 'No sent alerts found to backfill',
                total_alerts: 0
            });
        }

        // Group alerts by company
        const alertsByCompany = {};
        for (const alert of sentAlerts) {
            if (!alertsByCompany[alert.company_id]) {
                alertsByCompany[alert.company_id] = [];
            }
            alertsByCompany[alert.company_id].push(alert);
        }

        console.log(`🏢 Processing ${Object.keys(alertsByCompany).length} companies\n`);

        const results = {
            total_alerts: sentAlerts.length,
            total_companies: Object.keys(alertsByCompany).length,
            notes_created: 0,
            tasks_created: 0,
            failures: 0,
            skipped: 0,
            details: []
        };

        // Cache for Affinity organization lookups
        const affinityOrgCache = {};

        for (const [companyId, companyAlerts] of Object.entries(alertsByCompany)) {
            try {
                // Get company details
                const companies = await base44.asServiceRole.entities.Company.filter({ id: companyId });
                if (!companies || companies.length === 0) {
                    console.log(`⚠️ Company ${companyId} not found in database, skipping ${companyAlerts.length} alerts`);
                    results.skipped += companyAlerts.length;
                    continue;
                }

                const company = companies[0];
                console.log(`\n📍 Processing ${company.name} (${companyAlerts.length} alerts)`);

                // Look up organization in Affinity (check cache first)
                let organizationId = affinityOrgCache[company.name];
                
                if (!organizationId) {
                    const searchResponse = await fetch(
                        `https://api.affinity.co/organizations?term=${encodeURIComponent(company.name)}`,
                        { headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' } }
                    );

                    if (!searchResponse.ok) {
                        console.log(`⚠️ Failed to search Affinity for ${company.name}, skipping`);
                        results.skipped += companyAlerts.length;
                        continue;
                    }

                    const searchData = await searchResponse.json();
                    
                    if (!searchData.organizations || searchData.organizations.length === 0) {
                        console.log(`⚠️ ${company.name} not found in Affinity, skipping`);
                        results.skipped += companyAlerts.length;
                        continue;
                    }

                    organizationId = searchData.organizations[0].id;
                    affinityOrgCache[company.name] = organizationId;
                }

                console.log(`   ✅ Found in Affinity (ID: ${organizationId})`);

                // Process each alert for this company
                for (const alert of companyAlerts) {
                    const result = await pushAlertToAffinity(alert, affinityApiKey, organizationId);
                    
                    if (result.success) {
                        results.notes_created++;
                        if (result.task_created) results.tasks_created++;
                        console.log(`   ✅ Backfilled: ${alert.headline.substring(0, 60)}...`);
                    } else {
                        results.failures++;
                        console.log(`   ❌ Failed: ${alert.headline.substring(0, 60)}... (${result.reason})`);
                    }

                    results.details.push({
                        company: company.name,
                        alert_headline: alert.headline,
                        sent_date: alert.created_date,
                        result: result.success ? 'success' : 'failed',
                        note_id: result.note_id,
                        task_created: result.task_created || false
                    });

                    // Rate limiting - small delay between requests
                    await new Promise(resolve => setTimeout(resolve, 200));
                }

            } catch (error) {
                console.error(`❌ Error processing company ${companyId}:`, error.message);
                results.failures += companyAlerts.length;
            }
        }

        console.log(`\n✅ Backfill complete!`);
        console.log(`   - Total alerts: ${results.total_alerts}`);
        console.log(`   - Notes created: ${results.notes_created}`);
        console.log(`   - Tasks created: ${results.tasks_created}`);
        console.log(`   - Failures: ${results.failures}`);
        console.log(`   - Skipped: ${results.skipped}`);

        return Response.json({
            success: true,
            ...results
        });

    } catch (error) {
        console.error('❌ Backfill error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});