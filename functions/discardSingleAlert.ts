import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { alert_id, owner_email } = await req.json();
        
        console.log(`🗑️ Discarding single alert ${alert_id} for: ${owner_email}`);
        
        if (!alert_id || !owner_email) {
            return Response.json({ error: 'alert_id and owner_email required' }, { status: 400 });
        }

        // Get the alert
        const alerts = await base44.asServiceRole.entities.Alert.filter({ id: alert_id });
        if (alerts.length === 0) {
            return Response.json({ error: 'Alert not found' }, { status: 404 });
        }

        const alert = alerts[0];

        // Check if already discarded for this owner
        if (alert.discarded_for && alert.discarded_for.includes(owner_email)) {
            return Response.json({
                success: true,
                message: 'Alert already discarded for this owner',
                already_discarded: true
            });
        }

        // Add owner email to discarded_for array
        const currentDiscardedFor = alert.discarded_for || [];
        const updatedDiscardedFor = [...new Set([...currentDiscardedFor, owner_email])];

        await base44.asServiceRole.entities.Alert.update(alert_id, {
            discarded_for: updatedDiscardedFor
        });

        console.log(`✅ Marked alert ${alert_id} as discarded for ${owner_email}`);

        return Response.json({
            success: true,
            message: 'Alert discarded successfully',
            alert_id: alert_id,
            owner: owner_email
        });

    } catch (error) {
        console.error('❌ Discard single alert error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});