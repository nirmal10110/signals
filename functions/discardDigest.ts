import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

function isValidVolpiEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return email.toLowerCase().endsWith('@volpicapital.com');
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        const { owner_email } = await req.json();
        
        console.log(`🗑️ Discarding digest for: ${owner_email}`);
        
        if (!owner_email) {
            return Response.json({ error: 'owner_email required' }, { status: 400 });
        }

        // Validate email domain
        if (!isValidVolpiEmail(owner_email)) {
            console.log(`⚠️ Invalid email domain: ${owner_email}`);
            return Response.json({ 
                error: 'Invalid email domain. Only @volpicapital.com addresses allowed.',
                blocked_email: owner_email
            }, { status: 403 });
        }

        // Get new alerts from last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        
        console.log(`📅 Looking for alerts since: ${thirtyDaysAgo.toISOString()}`);
        
        const allAlerts = await base44.asServiceRole.entities.Alert.filter({
            status: 'new'
        });
        
        console.log(`📊 Found ${allAlerts.length} total new alerts`);
        
        // Filter by date AND whether already sent or discarded for this owner
        const recentAlerts = allAlerts.filter(alert => {
            const createdDate = new Date(alert.created_date);
            const detectedDate = alert.detected_date ? new Date(alert.detected_date) : null;
            
            if (createdDate < thirtyDaysAgo) return false;
            
            if (detectedDate) {
                const detectedYear = detectedDate.getFullYear();
                if (detectedYear <= 2024) return false;
                if (detectedDate < thirtyDaysAgo) return false;
            }

            // Skip if already sent to this owner
            if (alert.sent_to && alert.sent_to.includes(owner_email)) {
                return false;
            }

            // Skip if already discarded for this owner
            if (alert.discarded_for && alert.discarded_for.includes(owner_email)) {
                return false;
            }
            
            return true;
        });
        
        console.log(`📊 ${recentAlerts.length} unsent/undiscarded alerts from last 30 days`);

        if (recentAlerts.length === 0) {
            console.log(`ℹ️ No new unsent alerts for this owner`);
            return Response.json({
                success: true,
                message: 'No new unsent alerts in the last 30 days',
                alerts_discarded: 0
            });
        }

        // Get all companies to match alerts to owners
        const companyIds = [...new Set(recentAlerts.map(a => a.company_id))];
        console.log(`🏢 Fetching ${companyIds.length} companies...`);
        
        const companies = await base44.asServiceRole.entities.Company.filter({
            id: { $in: companyIds }
        });
        
        console.log(`🏢 Found ${companies.length} companies`);

        // Find alerts for this specific owner
        const alertsToDiscard = [];

        for (const alert of recentAlerts) {
            const company = companies.find(c => c.id === alert.company_id);
            if (!company) continue;

            const owners = company.relationship_owners || [];
            const matchingOwner = owners.find(o => o.email === owner_email);
            
            if (matchingOwner) {
                alertsToDiscard.push(alert);
            }
        }

        console.log(`🗑️ Found ${alertsToDiscard.length} alerts to discard for ${owner_email}`);

        if (alertsToDiscard.length === 0) {
            console.log(`ℹ️ No alerts assigned to this owner`);
            return Response.json({
                success: true,
                message: `No unsent alerts assigned to ${owner_email}`,
                alerts_discarded: 0
            });
        }

        // Mark alerts as discarded (add owner email to discarded_for array) WITHOUT sending email
        for (const alert of alertsToDiscard) {
            const currentDiscardedFor = alert.discarded_for || [];
            const updatedDiscardedFor = [...new Set([...currentDiscardedFor, owner_email])];

            await base44.asServiceRole.entities.Alert.update(alert.id, {
                discarded_for: updatedDiscardedFor
            });
        }

        console.log(`✅ Marked ${alertsToDiscard.length} alerts as discarded for ${owner_email}`);

        return Response.json({
            success: true,
            alerts_discarded: alertsToDiscard.length,
            owner: owner_email,
            message: `Discarded ${alertsToDiscard.length} alert${alertsToDiscard.length !== 1 ? 's' : ''} for ${owner_email} without sending`
        });

    } catch (error) {
        console.error('❌ Discard digest error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});