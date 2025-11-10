import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { alert_ids, owner_email } = await req.json();
        
        console.log(`🗑️ Bulk discarding ${alert_ids.length} alerts for: ${owner_email}`);
        
        if (!alert_ids || !Array.isArray(alert_ids) || alert_ids.length === 0) {
            return Response.json({ error: 'alert_ids array required' }, { status: 400 });
        }

        if (!owner_email) {
            return Response.json({ error: 'owner_email required' }, { status: 400 });
        }

        let processed = 0;
        let alreadyDiscarded = 0;

        for (const alertId of alert_ids) {
            try {
                // Get the alert
                const alerts = await base44.asServiceRole.entities.Alert.filter({ id: alertId });
                if (alerts.length === 0) {
                    console.log(`⚠️ Alert ${alertId} not found, skipping`);
                    continue;
                }

                const alert = alerts[0];

                // Check if already marked as sent to this owner
                if (alert.sent_to && alert.sent_to.includes(owner_email)) {
                    console.log(`⏭️ Alert ${alertId} already sent to ${owner_email}`);
                    alreadyDiscarded++;
                    continue;
                }

                // Add owner email to sent_to array
                const currentSentTo = alert.sent_to || [];
                const updatedSentTo = [...new Set([...currentSentTo, owner_email])];

                await base44.asServiceRole.entities.Alert.update(alertId, {
                    sent_to: updatedSentTo
                });

                processed++;
                console.log(`✅ Marked alert ${alertId} as sent to ${owner_email}`);

            } catch (error) {
                console.error(`❌ Error processing alert ${alertId}:`, error.message);
            }
        }

        console.log(`✅ Bulk discard complete: ${processed} processed, ${alreadyDiscarded} already discarded`);

        return Response.json({
            success: true,
            message: `Discarded ${processed} alerts`,
            alerts_processed: processed,
            alerts_already_discarded: alreadyDiscarded,
            owner: owner_email
        });

    } catch (error) {
        console.error('❌ Bulk discard error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});