import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { format } from "npm:date-fns@3.6.0";

function isValidVolpiEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return email.toLowerCase().endsWith('@volpicapital.com');
}

function generateDigestHTML(ownerName, date, alerts, volpiContent) {
    // Sort alerts: TIER 1 first, then TIER 2, then by date within each tier
    const sortedAlerts = [...alerts].sort((a, b) => {
        if (a.tier === 'tier_1' && b.tier !== 'tier_1') return -1;
        if (a.tier !== 'tier_1' && b.tier === 'tier_1') return 1;
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
        const triggerBadge = `<span style="display: inline-block; background: #059669; color: white; padding: 6px 12px; border-radius: 4px; font-size: 10px; font-weight: 600; letter-spacing: 0.5px; margin-left: 6px;">${triggerLabel}</span>`;

        const relevantContent = (alert.volpi_content || [])
            .map(url => volpiContent.find(c => c.url === url))
            .filter(Boolean);

        const publishedDate = format(new Date(alert.detected_date || alert.created_date), "d MMM yyyy");
        const detectedDate = format(new Date(alert.created_date), "d MMM yyyy");

        return `
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 28px; margin-bottom: 24px;">
            <div style="margin-bottom: 16px;">
                ${tierBadge}${priorityBadge}${triggerBadge}
            </div>
            
            <h3 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: #059669; line-height: 1.3;">${alert.company_name}</h3>
            <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151; line-height: 1.5; font-weight: 500;">${alert.headline}</p>
            
            ${alert.summary ? `<p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280; line-height: 1.6;">${alert.summary}</p>` : ''}
            
            <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; font-size: 13px; color: #9ca3af; padding-bottom: 16px; border-bottom: 1px solid #f3f4f6;">
                <div>
                    <span style="font-weight: 600; color: #374151;">Published:</span> ${publishedDate}
                    ${alert.date_evidence ? ` <span style="font-size: 11px; color: #9ca3af;">(${alert.date_evidence})</span>` : ''}
                </div>
                <div>
                    <span style="font-weight: 600; color: #374151;">Detected:</span> ${detectedDate}
                    ${alert.source_url ? ` · <a href="${alert.source_url}" style="color: #059669; text-decoration: none; font-weight: 500;">View Source</a>` : ''}
                </div>
            </div>
            
            ${alert.actionable_insight ? `
            <div style="margin-bottom: 20px; padding: 20px; background: #f0fdf4; border-left: 3px solid #059669; border-radius: 4px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.5px;">💡 Actionable Insight</p>
                <p style="margin: 0; font-size: 14px; color: #065f46; line-height: 1.6;">${alert.actionable_insight}</p>
            </div>
            ` : ''}
            
            ${alert.draft_email ? `
            <div style="padding: 20px; background: #fafafa; border: 1px solid #e5e7eb; border-radius: 4px;">
                <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">📧 Suggested Outreach</p>
                <pre style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #374151; white-space: pre-wrap; line-height: 1.7;">${alert.draft_email}</pre>
            </div>
            ` : ''}
            
            ${relevantContent.length > 0 ? `
            <div style="padding: 20px; background: #fafafa; border: 1px solid #e5e7eb; border-radius: 4px; margin-top: 20px;">
                <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">📚 Relevant Collateral</p>
                <ul style="margin: 0; padding: 0; list-style: none;">
                    ${relevantContent.map(c => `<li style="margin-bottom: 8px;"><a href="${c.url}" style="color: #059669; text-decoration: none; font-size: 14px; font-weight: 500;">→ ${c.title}</a></li>`).join('')}
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
    <body style="background-color: #f9fafb; padding: 20px;">
        <div class="container" style="max-width: 700px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; padding: 40px 32px; text-align: center;">
                <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f5e8c214c862c9e823b068/21277dc16_volpi.png" alt="Volpi Capital" class="logo" style="max-width: 180px; height: auto; margin-bottom: 20px;" />
                <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Volpi Lens Intelligence Digest</h1>
                <p style="margin: 0; font-size: 16px; color: #d1fae5; font-weight: 500;">${date}</p>
            </div>
            
            <div style="padding: 40px 32px;">
                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                    <p style="margin: 0; font-size: 14px; color: #92400e; font-weight: 600;">📬 RESENT DIGEST</p>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #92400e;">This is a recovery email containing previously sent alerts.</p>
                </div>
                
                <p style="margin: 0 0 32px 0; font-size: 16px; color: #374151; line-height: 1.6;">Hi <strong>${ownerName}</strong>,</p>
                <p style="margin: 0 0 32px 0; font-size: 16px; color: #374151; line-height: 1.6;">Here are the intelligence alerts that were previously sent to you:</p>
                
                ${alertRows}
            </div>
            
            <div style="background: #f0fdf4; padding: 32px; text-align: center; border-top: 1px solid #d1fae5;">
                <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f5e8c214c862c9e823b068/21277dc16_volpi.png" alt="Volpi Capital" style="max-width: 140px; height: auto; margin-bottom: 16px;" />
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #059669; font-weight: 700;">Volpi Capital</p>
                <p style="margin: 0; font-size: 12px; color: #6b7280;">Private Equity Intelligence Platform</p>
                <p style="margin: 12px 0 0 0;"><a href="https://volpicapital.com" style="color: #059669; text-decoration: none; font-size: 13px; font-weight: 600;">volpicapital.com</a></p>
            </div>
        </div>
    </body>
    </html>
    `;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        console.log('🔄 Starting digest recovery process...');

        // Get all alerts from last 7 days that have been "sent" (have sent_to array populated)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const allAlerts = await base44.asServiceRole.entities.Alert.filter({
            status: 'new',
            created_date: { $gte: sevenDaysAgo.toISOString() }
        });

        console.log(`📊 Found ${allAlerts.length} total alerts from last 7 days`);

        // Filter for alerts that have been sent (have sent_to populated)
        const sentAlerts = allAlerts.filter(alert => 
            alert.sent_to && alert.sent_to.length > 0
        );

        console.log(`📧 Found ${sentAlerts.length} alerts that were sent`);

        if (sentAlerts.length === 0) {
            return Response.json({
                success: true,
                message: 'No sent alerts found in the last 7 days',
                digests_resent: 0
            });
        }

        // Get all companies
        const companyIds = [...new Set(sentAlerts.map(a => a.company_id))];
        const companies = await base44.asServiceRole.entities.Company.filter({
            id: { $in: companyIds }
        });

        // Get Volpi content
        const volpiContent = await base44.asServiceRole.entities.VolpiContent.list();

        // Group alerts by owner email (from sent_to array)
        const alertsByOwner = {};

        for (const alert of sentAlerts) {
            const sentToEmails = alert.sent_to || [];
            
            for (const ownerEmail of sentToEmails) {
                // Only process valid Volpi emails
                if (!isValidVolpiEmail(ownerEmail)) {
                    console.log(`⏭️ Skipping non-Volpi email: ${ownerEmail}`);
                    continue;
                }

                if (!alertsByOwner[ownerEmail]) {
                    alertsByOwner[ownerEmail] = {
                        name: ownerEmail.split('@')[0],
                        alerts: []
                    };
                }

                alertsByOwner[ownerEmail].alerts.push(alert);
            }
        }

        // Get proper names from companies
        for (const [ownerEmail, data] of Object.entries(alertsByOwner)) {
            for (const company of companies) {
                const owners = company.relationship_owners || [];
                const matchingOwner = owners.find(o => o.email === ownerEmail);
                if (matchingOwner && matchingOwner.name) {
                    data.name = matchingOwner.name;
                    break;
                }
            }
        }

        console.log(`\n📬 Preparing to resend digests to ${Object.keys(alertsByOwner).length} owner(s)`);

        const results = [];
        const dateStr = format(new Date(), 'do MMMM yyyy');

        // Resend digest to each owner
        for (const [ownerEmail, data] of Object.entries(alertsByOwner)) {
            try {
                console.log(`\n📨 Resending to ${ownerEmail}: ${data.alerts.length} alert(s)`);

                const htmlBody = generateDigestHTML(
                    data.name,
                    dateStr,
                    data.alerts,
                    volpiContent
                );

                // Send email with RESENT prefix
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: ownerEmail,
                    subject: `[RESENT] Your Volpi Lens Digest — ${dateStr}`,
                    body: htmlBody,
                    from_name: 'Volpi Capital'
                });

                results.push({
                    owner: ownerEmail,
                    alerts_resent: data.alerts.length,
                    status: 'resent'
                });

                console.log(`✅ Resent digest to ${ownerEmail} with ${data.alerts.length} alerts`);

            } catch (error) {
                console.error(`❌ Failed to resend digest to ${ownerEmail}:`, error.message);
                results.push({
                    owner: ownerEmail,
                    status: 'failed',
                    error: error.message
                });
            }
        }

        console.log(`\n✅ Digest recovery complete!`);
        console.log(`   - Resent: ${results.filter(r => r.status === 'resent').length}`);
        console.log(`   - Failed: ${results.filter(r => r.status === 'failed').length}`);

        return Response.json({
            success: true,
            digests_resent: results.filter(r => r.status === 'resent').length,
            total_alerts_resent: results.reduce((sum, r) => sum + (r.alerts_resent || 0), 0),
            recipients: results.map(r => r.owner),
            results
        });

    } catch (error) {
        console.error('❌ Recovery error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});