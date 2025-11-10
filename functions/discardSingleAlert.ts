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

        // Check if already marked as sent to this owner
        if (alert.sent_to && alert.sent_to.includes(owner_email)) {
            return Response.json({
                success: true,
                message: 'Alert already marked as sent to this owner',
                already_discarded: true
            });
        }

        // Add owner email to sent_to array
        const currentSentTo = alert.sent_to || [];
        const updatedSentTo = [...new Set([...currentSentTo, owner_email])];

        await base44.asServiceRole.entities.Alert.update(alert_id, {
            sent_to: updatedSentTo
        });

        console.log(`✅ Marked alert ${alert_id} as sent to ${owner_email} (discarded)`);

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