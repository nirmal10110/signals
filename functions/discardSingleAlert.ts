import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { alert_id, owner_email } = await req.json();
        
        console.log(`🗑️ Discarding alert ${alert_id} globally (triggered by: ${owner_email})`);
        
        if (!alert_id || !owner_email) {
            return Response.json({ error: 'alert_id and owner_email required' }, { status: 400 });
        }

        // Get the alert
        const alerts = await base44.asServiceRole.entities.Alert.filter({ id: alert_id });
        if (alerts.length === 0) {
            return Response.json({ error: 'Alert not found' }, { status: 404 });
        }

        const alert = alerts[0];

        // Get the company to find ALL owners
        const companies = await base44.asServiceRole.entities.Company.filter({ id: alert.company_id });
        const company = companies[0];
        
        // Collect ALL owner emails for this company
        const allOwnerEmails = [];
        if (company && company.relationship_owners) {
            for (const owner of company.relationship_owners) {
                if (owner.email) {
                    allOwnerEmails.push(owner.email);
                }
            }
        }
        
        // Always include the requesting owner
        if (!allOwnerEmails.includes(owner_email)) {
            allOwnerEmails.push(owner_email);
        }

        console.log(`📋 Found ${allOwnerEmails.length} owner(s) for ${alert.company_name}: ${allOwnerEmails.join(', ')}`);

        // Merge with existing discarded_for to discard for ALL owners
        const currentDiscardedFor = alert.discarded_for || [];
        const updatedDiscardedFor = [...new Set([...currentDiscardedFor, ...allOwnerEmails])];

        await base44.asServiceRole.entities.Alert.update(alert_id, {
            discarded_for: updatedDiscardedFor
        });

        console.log(`✅ Alert ${alert_id} discarded for ALL ${updatedDiscardedFor.length} owner(s)`);

        return Response.json({
            success: true,
            message: `Alert discarded for all ${allOwnerEmails.length} owner(s) of ${alert.company_name}`,
            alert_id: alert_id,
            discarded_for: updatedDiscardedFor,
            owners_affected: allOwnerEmails
        });

    } catch (error) {
        console.error('❌ Discard alert error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});