import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { format } from "npm:date-fns@3.6.0";

// Tier 1 triggers that should create follow-up tasks in Affinity
const TIER_1_TASK_TRIGGERS = new Set([
    'ceo_hiring',
    'cfo_hiring',
    'head_of_sales_hiring',
    'head_of_delivery_hiring',
    'executive_hiring',
    'board_member_hired',
    'headcount_growth',
    'financial_results',
    'funding_round',
    'acquisition_announced',
    'international_expansion',
    'new_office_opened',
    'culture_initiative',
    'birthday_reminder',
    'event_participation'
]);

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        const { company_name } = await req.json();
        
        if (!company_name) {
            return Response.json({ error: 'company_name required (e.g., "Ongoing Warehouse")' }, { status: 400 });
        }

        console.log(`\n🧪 Testing Affinity integration for: ${company_name}`);

        // Get Affinity API key
        const affinityApiKey = Deno.env.get("Affinity_API");
        if (!affinityApiKey) {
            return Response.json({ 
                error: 'Affinity API key not set',
                details: 'Please set the Affinity_API secret in app settings'
            }, { status: 500 });
        }

        // Find the company in our database
        const companies = await base44.asServiceRole.entities.Company.list();
        const company = companies.find(c => 
            c.name.toLowerCase().includes(company_name.toLowerCase())
        );

        if (!company) {
            return Response.json({ 
                error: `Company "${company_name}" not found in database`,
                available_companies: companies.map(c => c.name).slice(0, 10)
            }, { status: 404 });
        }

        console.log(`✅ Found company in database: ${company.name}`);

        // Get recent alerts for this company
        const alerts = await base44.asServiceRole.entities.Alert.filter({
            company_id: company.id,
            status: 'new'
        }, '-created_date', 5);

        if (alerts.length === 0) {
            return Response.json({ 
                error: `No new alerts found for ${company.name}`,
                company_id: company.id
            }, { status: 404 });
        }

        console.log(`📊 Found ${alerts.length} alert(s) for ${company.name}`);

        // Search for organization in Affinity
        const searchResponse = await fetch(
            `https://api.affinity.co/organizations?term=${encodeURIComponent(company.name)}`,
            {
                headers: {
                    'Authorization': `Bearer ${affinityApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!searchResponse.ok) {
            const errorText = await searchResponse.text();
            return Response.json({ 
                error: 'Failed to search Affinity',
                status: searchResponse.status,
                details: errorText
            }, { status: 500 });
        }

        const searchData = await searchResponse.json();
        
        if (!searchData.organizations || searchData.organizations.length === 0) {
            return Response.json({ 
                error: `Company "${company.name}" not found in Affinity`,
                searched_term: company.name
            }, { status: 404 });
        }

        const organizationId = searchData.organizations[0].id;
        console.log(`✅ Found in Affinity - Organization ID: ${organizationId}`);

        // Test with the first alert
        const testAlert = alerts[0];
        const isTier1 = TIER_1_TASK_TRIGGERS.has(testAlert.trigger_type);

        console.log(`\n📝 Testing with alert:`);
        console.log(`   - Company: ${testAlert.company_name}`);
        console.log(`   - Headline: ${testAlert.headline}`);
        console.log(`   - Trigger: ${testAlert.trigger_type}`);
        console.log(`   - Tier: ${testAlert.tier}`);
        console.log(`   - Should create task: ${isTier1 ? 'YES (Tier 1)' : 'NO (Tier 2)'}`);

        // Create note content with clear VOLPI LENS header
        const noteContent = `
═══════════════════════════
🔔 VOLPI LENS ALERT
═══════════════════════════

${testAlert.headline}

${testAlert.summary || ''}

📅 Detected: ${format(new Date(testAlert.detected_date || testAlert.created_date), "MMMM d, yyyy")}
🏷️ Type: ${testAlert.trigger_type.replace(/_/g, ' ').toUpperCase()}
⭐ Priority: ${testAlert.priority.toUpperCase()}
${testAlert.tier === 'tier_1' ? '🚨 TIER 1 - MUST FOLLOW UP' : ''}

${testAlert.source_url ? `🔗 Source: ${testAlert.source_url}` : ''}

${testAlert.actionable_insight ? `\n💡 Actionable Insight:\n${testAlert.actionable_insight}` : ''}

${testAlert.draft_email ? `\n📧 Suggested Outreach:\n${testAlert.draft_email}` : ''}

─────────────────────────
Generated by Volpi Lens Intelligence Platform
`.trim();

        // Add note to Affinity
        console.log(`\n📝 Creating note in Affinity...`);
        const noteResponse = await fetch(
            'https://api.affinity.co/notes',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${affinityApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    organization_ids: [organizationId],
                    content: noteContent
                })
            }
        );

        let noteResult = { success: false };
        if (noteResponse.ok) {
            const noteData = await noteResponse.json();
            noteResult = { 
                success: true, 
                note_id: noteData.id,
                message: 'Note created successfully in Affinity'
            };
            console.log(`✅ Note created - ID: ${noteData.id}`);
        } else {
            const errorText = await noteResponse.text();
            noteResult = { 
                success: false, 
                error: errorText,
                status: noteResponse.status
            };
            console.log(`❌ Failed to create note: ${errorText}`);
        }

        // Create task if Tier 1
        let taskResult = { skipped: true, reason: 'Not a Tier 1 trigger' };
        
        if (isTier1) {
            console.log(`\n✅ Creating Tier 1 task in Affinity...`);
            
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 3); // Due in 3 days

            const taskResponse = await fetch(
                'https://api.affinity.co/tasks',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${affinityApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        organization_ids: [organizationId],
                        content: `Follow up on: ${testAlert.headline}`,
                        due_date: dueDate.toISOString().split('T')[0]
                    })
                }
            );

            if (taskResponse.ok) {
                const taskData = await taskResponse.json();
                taskResult = { 
                    success: true, 
                    task_id: taskData.id,
                    due_date: dueDate.toISOString().split('T')[0],
                    message: 'Task created successfully in Affinity'
                };
                console.log(`✅ Task created - ID: ${taskData.id}, Due: ${dueDate.toISOString().split('T')[0]}`);
            } else {
                const errorText = await taskResponse.text();
                taskResult = { 
                    success: false, 
                    error: errorText,
                    status: taskResponse.status
                };
                console.log(`❌ Failed to create task: ${errorText}`);
            }
        } else {
            console.log(`ℹ️ Skipping task creation - Not a Tier 1 trigger`);
        }

        return Response.json({
            success: true,
            test_summary: {
                company_name: company.name,
                affinity_organization_id: organizationId,
                test_alert: {
                    headline: testAlert.headline,
                    trigger_type: testAlert.trigger_type,
                    tier: testAlert.tier,
                    is_tier_1_trigger: isTier1
                },
                results: {
                    note: noteResult,
                    task: taskResult
                }
            },
            next_steps: noteResult.success 
                ? 'Check Affinity CRM to see the note (and task if Tier 1)' 
                : 'Review error details above'
        });

    } catch (error) {
        console.error('❌ Test error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});