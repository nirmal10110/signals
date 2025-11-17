import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { format } from "npm:date-fns@3.6.0";

function isValidVolpiEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return email.toLowerCase().endsWith('@volpicapital.com');
}

async function pushAlertToAffinity(alert, ownerEmail) {
    const affinityApiKey = Deno.env.get("Affinity_API");
    if (!affinityApiKey) {
        console.log('⚠️ Affinity API key not set, skipping CRM push');
        return;
    }

    try {
        // Find the organization in Affinity by company name
        const searchResponse = await fetch(
            `https://api.affinity.co/organizations?term=${encodeURIComponent(alert.company_name)}`,
            {
                headers: {
                    'Authorization': `Bearer ${affinityApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!searchResponse.ok) {
            console.log(`⚠️ Failed to search Affinity for ${alert.company_name}`);
            return;
        }

        const searchData = await searchResponse.json();
        
        if (!searchData.organizations || searchData.organizations.length === 0) {
            console.log(`⚠️ Company ${alert.company_name} not found in Affinity`);
            return;
        }

        const organizationId = searchData.organizations[0].id;
        console.log(`✅ Found ${alert.company_name} in Affinity (ID: ${organizationId})`);

        // Create note content
        const noteContent = `
🔔 Volpi Lens Alert: ${alert.headline}

${alert.summary || ''}

📅 Detected: ${format(new Date(alert.detected_date || alert.created_date), "MMM d, yyyy")}
🔗 Source: ${alert.source_url || 'N/A'}

${alert.actionable_insight ? `💡 Actionable Insight: ${alert.actionable_insight}` : ''}

Alert sent to: ${ownerEmail}
`.trim();

        // Add note to organization
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

        if (noteResponse.ok) {
            console.log(`✅ Added note to Affinity for ${alert.company_name}`);
        } else {
            console.log(`⚠️ Failed to add note to Affinity for ${alert.company_name}`);
        }

        // If Tier 1, create a task
        if (alert.tier === 'tier_1') {
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
                        content: `Follow up on: ${alert.headline}`,
                        due_date: dueDate.toISOString().split('T')[0]
                    })
                }
            );

            if (taskResponse.ok) {
                console.log(`✅ Created Tier 1 task in Affinity for ${alert.company_name}`);
            } else {
                console.log(`⚠️ Failed to create task in Affinity for ${alert.company_name}`);
            }
        }

    } catch (error) {
        console.error(`❌ Error pushing alert to Affinity for ${alert.company_name}:`, error.message);
    }
}

function generateDigestHTML(ownerName, date, alerts, volpiContent) {
    const sortedAlerts = [...alerts].sort((a, b) => {
        if (a.tier === 'tier_1' && b.tier !== 'tier_1') return -1;
        if (a.tier !== 'tier_1' && b.tier === 'tier_1') return 1;
        const dateA = new Date(a.detected_date || a.created_date);
        const dateB = new Date(b.detected_date || b.created_date);
        return dateB.getTime() - dateA.getTime();
    });

    const alertRows = sortedAlerts.map(alert => {
        const tierBadge = alert.tier === 'tier_1' 
            ? '<span style="display: inline-block; background: #dc2626; color: white; padding: 8px 14px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.3);">TIER 1 - MUST FOLLOW UP</span>' 
            : '';
        
        const priorityColors = {
            high: 'background: #dc2626; color: white; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.3);',
            medium: 'background: #f59e0b; color: white; box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);',
            low: 'background: #3b82f6; color: white; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);'
        };

        const priorityBadge = `<span style="display: inline-block; ${priorityColors[alert.priority]} padding: 8px 14px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-left: 8px;">${alert.priority}</span>`;

        const triggerLabel = alert.trigger_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const triggerBadge = `<span style="display: inline-block; background: #10b981; color: white; padding: 8px 14px; border-radius: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; margin-left: 8px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);">${triggerLabel}</span>`;

        const relevantContent = (alert.volpi_content || [])
            .map(url => volpiContent.find(c => c.url === url))
            .filter(Boolean);

        const publishedDate = format(new Date(alert.detected_date || alert.created_date), "d MMM yyyy");
        const detectedDate = format(new Date(alert.created_date), "d MMM yyyy");

        return `
        <div style="background: #ffffff; border: 2px solid #e5e7eb; border-radius: 12px; padding: 32px; margin-bottom: 28px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
            <div style="margin-bottom: 18px;">
                ${tierBadge}${priorityBadge}${triggerBadge}
            </div>
            
            <h3 style="margin: 0 0 14px 0; font-size: 24px; font-weight: 700; color: #059669; line-height: 1.3;">${alert.company_name}</h3>
            <p style="margin: 0 0 18px 0; font-size: 17px; color: #1f2937; line-height: 1.6; font-weight: 500;">${alert.headline}</p>
            
            ${alert.summary ? `<p style="margin: 0 0 18px 0; font-size: 15px; color: #4b5563; line-height: 1.7;">${alert.summary}</p>` : ''}
            
            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 22px; font-size: 14px; color: #6b7280; padding: 16px; background: #f9fafb; border-radius: 8px;">
                <div>
                    <span style="font-weight: 700; color: #1f2937;">📅 Published:</span> <span style="color: #374151;">${publishedDate}</span>
                    ${alert.date_evidence ? ` <span style="font-size: 12px; color: #9ca3af;">(${alert.date_evidence})</span>` : ''}
                </div>
                <div>
                    <span style="font-weight: 700; color: #1f2937;">🔍 Detected:</span> <span style="color: #374151;">${detectedDate}</span>
                    ${alert.source_url ? ` · <a href="${alert.source_url}" style="color: #059669; text-decoration: none; font-weight: 600;">View Source →</a>` : ''}
                </div>
            </div>
            
            ${alert.actionable_insight ? `
            <div style="margin-bottom: 22px; padding: 22px; background: #ecfdf5; border-left: 4px solid #059669; border-radius: 8px; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.1);">
                <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 0.5px;">💡 Actionable Insight</p>
                <p style="margin: 0; font-size: 15px; color: #065f46; line-height: 1.7; font-weight: 500;">${alert.actionable_insight}</p>
            </div>
            ` : ''}
            
            ${alert.draft_email ? `
            <div style="padding: 22px; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">
                <p style="margin: 0 0 14px 0; font-size: 13px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">📧 Suggested Outreach</p>
                <pre style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #334155; white-space: pre-wrap; line-height: 1.8;">${alert.draft_email}</pre>
            </div>
            ` : ''}
            
            ${relevantContent.length > 0 ? `
            <div style="padding: 22px; background: #faf5ff; border: 2px solid #e9d5ff; border-radius: 8px; margin-top: 22px; box-shadow: 0 2px 4px rgba(168, 85, 247, 0.1);">
                <p style="margin: 0 0 14px 0; font-size: 13px; font-weight: 700; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.5px;">📚 Relevant Collateral</p>
                <ul style="margin: 0; padding: 0; list-style: none;">
                    ${relevantContent.map(c => `<li style="margin-bottom: 10px;"><a href="${c.url}" style="color: #7c3aed; text-decoration: none; font-size: 15px; font-weight: 600;">→ ${c.title}</a></li>`).join('')}
                </ul>
            </div>
            ` : ''}
        </div>
        `;
    }).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; }
            @media only screen and (max-width: 600px) {
                .container { width: 100% !important; padding: 16px !important; }
                .logo { max-width: 120px !important; }
            }
        </style>
    </head>
    <body style="background-color: #f3f4f6; padding: 20px;">
        <div class="container" style="max-width: 700px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; padding: 44px 36px; text-align: center;">
                <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f5e8c214c862c9e823b068/21277dc16_volpi.png" alt="Volpi Capital" class="logo" style="max-width: 200px; height: auto; margin-bottom: 24px;" />
                <h1 style="margin: 0 0 10px 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Volpi Lens Intelligence Digest</h1>
                <p style="margin: 0; font-size: 18px; color: #d1fae5; font-weight: 500;">${date}</p>
            </div>
            
            <div style="padding: 44px 36px;">
                <p style="margin: 0 0 28px 0; font-size: 18px; color: #1f2937; line-height: 1.6;">Hi <strong style="color: #059669;">${ownerName}</strong>,</p>
                <p style="margin: 0 0 36px 0; font-size: 16px; color: #4b5563; line-height: 1.7;">Here are your latest intelligence alerts from Volpi Lens:</p>
                
                ${alertRows}
            </div>
            
            <div style="background: #ecfdf5; padding: 36px; text-align: center; border-top: 3px solid #10b981;">
                <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f5e8c214c862c9e823b068/21277dc16_volpi.png" alt="Volpi Capital" style="max-width: 160px; height: auto; margin-bottom: 18px; opacity: 0.9;" />
                <p style="margin: 0 0 10px 0; font-size: 16px; color: #047857; font-weight: 700;">Volpi Capital</p>
                <p style="margin: 0; font-size: 13px; color: #065f46;">Private Equity Intelligence Platform</p>
                <p style="margin: 14px 0 0 0;"><a href="https://volpicapital.com" style="color: #059669; text-decoration: none; font-size: 14px; font-weight: 600;">volpicapital.com</a></p>
            </div>
        </div>
    </body>
    </html>
    `;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const allPotentialAlerts = await base44.asServiceRole.entities.Alert.filter({
            status: 'new',
            created_date: { $gte: thirtyDaysAgo.toISOString() }
        });

        if (allPotentialAlerts.length === 0) {
            return Response.json({
                success: true,
                message: 'No new alerts to send from the last 30 days',
                digests_sent: 0
            });
        }

        const companyIds = [...new Set(allPotentialAlerts.map(a => a.company_id))];
        const companies = await base44.asServiceRole.entities.Company.filter({
            id: { $in: companyIds }
        });

        const volpiContent = await base44.asServiceRole.entities.VolpiContent.list();

        const today = new Date();
        const isWeeklySendDay = today.getDay() === 1;

        const alertsByOwner = {};
        const ownersSkippedWeekly = new Set();
        
        console.log(`\n📊 Processing ${allPotentialAlerts.length} potential alerts...`);
        
        for (const alert of allPotentialAlerts) {
            const company = companies.find(c => c.id === alert.company_id);
            if (!company) {
                console.log(`⚠️ Alert ${alert.id}: Company not found (${alert.company_id})`);
                continue;
            }

            const owners = company.relationship_owners || [];
            console.log(`\n📍 Alert for ${company.name}: ${owners.length} owner(s) - "${alert.headline}"`);
            
            for (const owner of owners) {
                if (!owner.email) {
                    console.log(`  ⚠️ Owner missing email: ${owner.name || 'unknown'}`);
                    continue;
                }
                
                if (!isValidVolpiEmail(owner.email)) {
                    console.log(`  ⚠️ Skipping non-Volpi email: ${owner.email}`);
                    continue;
                }

                const digestFrequency = owner.digest_frequency || 'daily';
                
                if (digestFrequency === 'weekly' && !isWeeklySendDay) {
                    console.log(`  ⏭️ Skipping ${owner.email} - weekly digest not due today`);
                    ownersSkippedWeekly.add(owner.email);
                    continue;
                }
                
                if (alert.sent_to && alert.sent_to.includes(owner.email)) {
                    console.log(`  ⏭️ Already sent to ${owner.email}`);
                    continue;
                }

                if (alert.discarded_for && alert.discarded_for.includes(owner.email)) {
                    console.log(`  ⏭️ Discarded for ${owner.email}`);
                    continue;
                }
                
                console.log(`  ✓ Queuing for ${owner.email} (${digestFrequency})`);
                
                if (!alertsByOwner[owner.email]) {
                    alertsByOwner[owner.email] = {
                        name: owner.name || owner.email.split('@')[0],
                        alertsByCompany: {},
                        digestFrequency: digestFrequency
                    };
                }
                
                if (!alertsByOwner[owner.email].alertsByCompany[company.id]) {
                    alertsByOwner[owner.email].alertsByCompany[company.id] = [];
                }
                
                alertsByOwner[owner.email].alertsByCompany[company.id].push(alert);
            }
        }

        console.log(`\n📧 Preparing to send digests to ${Object.keys(alertsByOwner).length} owner(s)`);

        const results = [];
        const dateStr = format(new Date(), 'do MMMM yyyy');

        for (const [ownerEmail, data] of Object.entries(alertsByOwner)) {
            try {
                if (!isValidVolpiEmail(ownerEmail)) {
                    console.log(`⚠️ Blocked attempt to send to non-Volpi email: ${ownerEmail} (final check)`);
                    results.push({
                        owner: ownerEmail,
                        status: 'blocked',
                        reason: 'Non-Volpi email address'
                    });
                    continue;
                }

                const allAlertsForOwner = [];
                const seenAlertIds = new Set();
                
                for (const [companyId, companyAlerts] of Object.entries(data.alertsByCompany)) {
                    const sortedAlerts = companyAlerts.sort((a, b) => {
                        if (a.tier === 'tier_1' && b.tier !== 'tier_1') return -1;
                        if (a.tier !== 'tier_1' && b.tier === 'tier_1') return 1;
                        return new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
                    });
                    
                    const limitedAlerts = sortedAlerts.slice(0, 2);
                    
                    for (const alert of limitedAlerts) {
                        if (!seenAlertIds.has(alert.id)) {
                            seenAlertIds.add(alert.id);
                            allAlertsForOwner.push(alert);
                        }
                    }
                }

                if (allAlertsForOwner.length === 0) {
                    console.log(`ℹ️ No new, unsent alerts found for ${ownerEmail} after deduplication and filtering.`);
                    continue;
                }

                console.log(`\n📨 Sending to ${ownerEmail}: ${allAlertsForOwner.length} alert(s)`);

                const htmlBody = generateDigestHTML(
                    data.name,
                    dateStr,
                    allAlertsForOwner,
                    volpiContent
                );

                const digestType = data.digestFrequency === 'weekly' ? 'Weekly' : 'Daily';
                const subjectLine = `Your ${digestType} Volpi Lens Digest — ${dateStr}`;

                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: ownerEmail,
                    subject: subjectLine,
                    body: htmlBody,
                    from_name: 'Volpi Capital'
                });

                // Push alerts to Affinity CRM
                for (const alert of allAlertsForOwner) {
                    await pushAlertToAffinity(alert, ownerEmail);
                }

                for (const alert of allAlertsForOwner) {
                    const currentSentTo = alert.sent_to || [];
                    const updatedSentTo = [...new Set([...currentSentTo, ownerEmail])];

                    await base44.asServiceRole.entities.Alert.update(alert.id, {
                        sent_to: updatedSentTo
                    });
                }

                results.push({
                    owner: ownerEmail,
                    alerts_sent: allAlertsForOwner.length,
                    status: 'sent'
                });

                console.log(`✅ Sent ${digestType} digest to ${ownerEmail} with ${allAlertsForOwner.length} alerts and pushed to Affinity`);

            } catch (error) {
                console.error(`❌ Failed to send digest to ${ownerEmail}:`, error.message);
                results.push({
                    owner: ownerEmail,
                    status: 'failed',
                    error: error.message
                });
            }
        }

        console.log(`\n✅ Digest sending complete!`);
        console.log(`   - Sent: ${results.filter(r => r.status === 'sent').length}`);
        console.log(`   - Blocked: ${results.filter(r => r.status === 'blocked').length}`);
        console.log(`   - Failed: ${results.filter(r => r.status === 'failed').length}`);
        console.log(`   - Skipped (weekly): ${ownersSkippedWeekly.size}`);

        return Response.json({
            success: true,
            digests_sent: results.filter(r => r.status === 'sent').length,
            blocked_emails: results.filter(r => r.status === 'blocked').length,
            skipped_weekly_users: ownersSkippedWeekly.size,
            total_alerts_processed_for_owners: allPotentialAlerts.length,
            is_weekly_send_day: isWeeklySendDay,
            results
        });

    } catch (error) {
        console.error('❌ Daily digest error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});