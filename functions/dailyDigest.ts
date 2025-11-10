
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { format } from "npm:date-fns@3.6.0";

function isValidVolpiEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return email.toLowerCase().endsWith('@volpicapital.com');
}

function generateDigestHTML(ownerName, date, alerts, volpiContent) {
    // Sort alerts: TIER 1 first, then TIER 2, then by date within each tier
    const sortedAlerts = [...alerts].sort((a, b) => {
        // Tier 1 alerts go first
        if (a.tier === 'tier_1' && b.tier !== 'tier_1') return -1;
        if (a.tier !== 'tier_1' && b.tier === 'tier_1') return 1;
        
        // Within same tier, sort by detected date (newest first)
        const dateA = new Date(a.detected_date || a.created_date);
        const dateB = new Date(b.detected_date || b.created_date);
        return dateB.getTime() - dateA.getTime();
    });

    const alertRows = sortedAlerts.map(alert => {
        const tierBadge = alert.tier === 'tier_1' 
            ? '<span style="display: inline-block; background: #dc2626; color: white; padding: 6px 12px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">TIER 1</span>' 
            : '';
        
        const priorityColors = {
            high: 'background: #dc2626; color: white;',
            medium: 'background: #f59e0b; color: white;',
            low: 'background: #3b82f6; color: white;'
        };

        const priorityBadge = `<span style="display: inline-block; ${priorityColors[alert.priority]} padding: 6px 12px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-left: 6px;">${alert.priority}</span>`;

        const triggerLabel = alert.trigger_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const triggerBadge = `<span style="display: inline-block; background: #1a4d2e; color: white; padding: 6px 12px; border-radius: 4px; font-size: 10px; font-weight: 600; letter-spacing: 0.5px; margin-left: 6px;">${triggerLabel}</span>`;

        const relevantContent = (alert.volpi_content || [])
            .map(url => volpiContent.find(c => c.url === url))
            .filter(Boolean);

        const publishedDate = format(new Date(alert.detected_date || alert.created_date), "d MMM yyyy");
        const detectedDate = format(new Date(alert.created_date), "d MMM yyyy");

        // Feedback links
        const feedbackSection = `
        <div style="margin-top: 20px; padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; text-align: center;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280; font-weight: 600;">Was this alert helpful?</p>
            <div style="display: flex; justify-content: center; gap: 12px;">
                <a href="https://app.base44.com/feedback?alert_id=${alert.id}&feedback=helpful" style="display: inline-block; padding: 8px 16px; background: #10b981; color: white; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: 600;">👍 Helpful</a>
                <a href="https://app.base44.com/feedback?alert_id=${alert.id}&feedback=not_helpful" style="display: inline-block; padding: 8px 16px; background: #f59e0b; color: white; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: 600;">👎 Not Helpful</a>
                <a href="https://app.base44.com/feedback?alert_id=${alert.id}&feedback=false_positive" style="display: inline-block; padding: 8px 16px; background: #ef4444; color: white; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: 600;">❌ False Positive</a>
            </div>
            <p style="margin: 10px 0 0 0; font-size: 11px; color: #9ca3af;">Your feedback helps the Lens learn and improve</p>
        </div>
        `;

        return `
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 28px; margin-bottom: 24px;">
            <div style="margin-bottom: 16px;">
                ${tierBadge}${priorityBadge}${triggerBadge}
            </div>
            
            <h3 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: #1a4d2e; line-height: 1.3;">${alert.company_name}</h3>
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151; line-height: 1.5; font-weight: 500;">${alert.headline}</p>
            
            ${alert.summary ? `<p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280; line-height: 1.6;">${alert.summary}</p>` : ''}
            
            <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; font-size: 13px; color: #9ca3af; padding-bottom: 16px; border-bottom: 1px solid #f3f4f6;">
                <div>
                    <span style="font-weight: 600; color: #374151;">Published:</span> ${publishedDate}
                    ${alert.date_evidence ? ` <span style="font-size: 11px; color: #9ca3af;">(${alert.date_evidence})</span>` : ''}
                </div>
                <div>
                    <span style="font-weight: 600; color: #374151;">Detected:</span> ${detectedDate}
                    ${alert.source_url ? ` · <a href="${alert.source_url}" style="color: #1a4d2e; text-decoration: none; font-weight: 500;">View Source</a>` : ''}
                </div>
            </div>
            
            ${alert.actionable_insight ? `
            <div style="margin-bottom: 20px; padding: 20px; background: #f0fdf4; border-left: 3px solid #1a4d2e; border-radius: 4px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #1a4d2e; text-transform: uppercase; letter-spacing: 0.5px;">💡 Actionable Insight</p>
                <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.6;">${alert.actionable_insight}</p>
            </div>
            ` : ''}
            
            ${alert.draft_email ? `
            <div style="margin-bottom: 20px; padding: 20px; background: #fafafa; border: 1px solid #e5e7eb; border-radius: 4px;">
                <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">📧 Suggested Outreach</p>
                <pre style="margin: 0; font-family: -apple-system, BlinkMacMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #374151; white-space: pre-wrap; line-height: 1.7;">${alert.draft_email}</pre>
            </div>
            ` : ''}
            
            ${relevantContent.length > 0 ? `
            <div style="padding: 20px; background: #fafafa; border: 1px solid #e5e7eb; border-radius: 4px; margin-bottom: 20px;">
                <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">📚 Relevant Collateral</p>
                <ul style="margin: 0; padding: 0; list-style: none;">
                    ${relevantContent.map(c => `<li style="margin-bottom: 8px;"><a href="${c.url}" style="color: #1a4d2e; text-decoration: none; font-size: 14px; font-weight: 500;">→ ${c.title}</a></li>`).join('')}
                </ul>
                <p style="margin: 12px 0 0 0;"><a href="https://volpicapital.com/news" style="color: #1a4d2e; text-decoration: none; font-size: 13px; font-weight: 600;">View more at volpicapital.com/news →</a></p>
            </div>
            ` : `
            <div style="padding: 20px; background: #fafafa; border: 1px solid #e5e7eb; border-radius: 4px; margin-bottom: 20px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">📚 Relevant Collateral</p>
                <p style="margin: 0;"><a href="https://volpicapital.com/news" style="color: #1a4d2e; text-decoration: none; font-size: 14px; font-weight: 500;">View our latest insights at volpicapital.com/news →</a></p>
            </div>
            `}
            
            ${feedbackSection}
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
            }
        </style>
    </head>
    <body style="background-color: #f9fafb; padding: 20px;">
        <div class="container" style="max-width: 700px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: #1a4d2e; color: #ffffff; padding: 40px 32px; text-align: center;">
                <h1 style="margin: 0 0 8px 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Daily Intelligence Digest</h1>
                <p style="margin: 0; font-size: 16px; color: #d1fae5; font-weight: 500;">${date}</p>
            </div>
            
            <div style="padding: 40px 32px;">
                <p style="margin: 0 0 32px 0; font-size: 16px; color: #374151; line-height: 1.6;">Hi <strong>${ownerName}</strong>,</p>
                <p style="margin: 0 0 32px 0; font-size: 16px; color: #374151; line-height: 1.6;">Here are your latest intelligence alerts from your monitored target companies:</p>
                
                ${alertRows}
            </div>
            
            <div style="background: #f9fafb; padding: 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; font-weight: 600;">Volpi Capital Intelligence Platform</p>
                <p style="margin: 0; font-size: 12px; color: #9ca3af;">Automated Private Equity Deal Origination</p>
                <p style="margin: 12px 0 0 0;"><a href="https://volpicapital.com" style="color: #1a4d2e; text-decoration: none; font-size: 13px; font-weight: 600;">volpicapital.com</a></p>
            </div>
        </div>
    </body>
    </html>
    `;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Get all new alerts from the last 30 DAYS that haven't been sent yet
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

        // Get all companies to map alerts to owners
        const companyIds = [...new Set(allPotentialAlerts.map(a => a.company_id))];
        const companies = await base44.asServiceRole.entities.Company.filter({
            id: { $in: companyIds }
        });

        // Get Volpi content for linking
        const volpiContent = await base44.asServiceRole.entities.VolpiContent.list();

        // Determine if today is a weekly send day (e.g., Monday)
        const today = new Date();
        const isWeeklySendDay = today.getDay() === 1; // Monday = 1

        // Group alerts by Volpi Owner - ENSURE ALL OWNERS GET THEIR ALERTS
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
                
                // ⚠️ SECURITY: Only send to @volpicapital.com addresses
                if (!isValidVolpiEmail(owner.email)) {
                    console.log(`  ⚠️ Skipping non-Volpi email: ${owner.email}`);
                    continue;
                }

                // Check digest frequency preference
                const digestFrequency = owner.digest_frequency || 'daily';
                
                // Skip weekly users if not weekly send day
                if (digestFrequency === 'weekly' && !isWeeklySendDay) {
                    console.log(`  ⏭️ Skipping ${owner.email} - weekly digest not due today`);
                    ownersSkippedWeekly.add(owner.email);
                    continue;
                }
                
                // Skip this alert if already sent to this specific owner
                if (alert.sent_to && alert.sent_to.includes(owner.email)) {
                    console.log(`  ⏭️ Already sent to ${owner.email}`);
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
                
                // Group by company to limit per company
                if (!alertsByOwner[owner.email].alertsByCompany[company.id]) {
                    alertsByOwner[owner.email].alertsByCompany[company.id] = [];
                }
                
                alertsByOwner[owner.email].alertsByCompany[company.id].push(alert);
            }
        }

        console.log(`\n📧 Preparing to send digests to ${Object.keys(alertsByOwner).length} owner(s)`);

        const results = [];
        const dateStr = format(new Date(), 'do MMMM yyyy');

        // Send digest to each owner
        for (const [ownerEmail, data] of Object.entries(alertsByOwner)) {
            try {
                // Double-check email domain before sending (for robustness)
                if (!isValidVolpiEmail(ownerEmail)) {
                    console.log(`⚠️ Blocked attempt to send to non-Volpi email: ${ownerEmail} (final check)`);
                    results.push({
                        owner: ownerEmail,
                        status: 'blocked',
                        reason: 'Non-Volpi email address'
                    });
                    continue;
                }

                // Limit to 2 alerts per company and deduplicate
                const allAlertsForOwner = [];
                const seenAlertIds = new Set();
                
                for (const [companyId, companyAlerts] of Object.entries(data.alertsByCompany)) {
                    // Sort by priority (tier_1 first, then by date)
                    const sortedAlerts = companyAlerts.sort((a, b) => {
                        if (a.tier === 'tier_1' && b.tier !== 'tier_1') return -1;
                        if (a.tier !== 'tier_1' && b.tier === 'tier_1') return 1;
                        return new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
                    });
                    
                    // Take max 2 alerts per company
                    const limitedAlerts = sortedAlerts.slice(0, 2);
                    
                    // Deduplicate by alert ID
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

                // Determine subject line based on digest frequency
                const digestType = data.digestFrequency === 'weekly' ? 'Weekly' : 'Daily';
                const subjectLine = `Your ${digestType} Intelligence Digest — ${dateStr}`;

                // Use Base44 email service
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: ownerEmail,
                    subject: subjectLine,
                    body: htmlBody,
                    from_name: 'Volpi Capital'
                });

                // ✅ MARK ALERTS AS SENT (add owner email to sent_to array)
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

                console.log(`✅ Sent ${digestType} digest to ${ownerEmail} with ${allAlertsForOwner.length} alerts and marked them as sent`);

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
