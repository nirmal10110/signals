import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        const { alert_id, owner_email } = await req.json();
        
        console.log(`🗑️ Removing alert ${alert_id} from ${owner_email}'s digest history`);
        
        if (!alert_id || !owner_email) {
            return Response.json({ error: 'alert_id and owner_email required' }, { status: 400 });
        }

        // Use service role to ensure we have permission
        const alert = await base44.asServiceRole.entities.Alert.filter({ id: alert_id });
        
        if (!alert || alert.length === 0) {
            return Response.json({ error: 'Alert not found' }, { status: 404 });
        }

        const alertData = alert[0];
        const currentSentTo = alertData.sent_to || [];
        const updatedSentTo = currentSentTo.filter(email => email !== owner_email);

        console.log(`📝 Updating sent_to from:`, currentSentTo);
        console.log(`📝 Updating sent_to to:`, updatedSentTo);

        await base44.asServiceRole.entities.Alert.update(alert_id, {
            sent_to: updatedSentTo
        });

        console.log(`✅ Removed ${owner_email} from alert ${alert_id}`);

        return Response.json({
            success: true,
            alert_id,
            owner_email,
            message: `Alert removed from ${owner_email}'s digest history`
        });

    } catch (error) {
        console.error('❌ Remove alert error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});