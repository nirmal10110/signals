import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        const { alert_ids, owner_email } = await req.json();
        
        console.log(`🗑️ Bulk removing ${alert_ids?.length} alerts from ${owner_email}'s digest history`);
        
        if (!alert_ids || !Array.isArray(alert_ids) || alert_ids.length === 0) {
            return Response.json({ error: 'alert_ids array required' }, { status: 400 });
        }

        if (!owner_email) {
            return Response.json({ error: 'owner_email required' }, { status: 400 });
        }

        let processedCount = 0;
        let skippedCount = 0;

        // Use service role to ensure we have permission
        for (const alertId of alert_ids) {
            try {
                const alert = await base44.asServiceRole.entities.Alert.filter({ id: alertId });
                
                if (!alert || alert.length === 0) {
                    console.log(`⚠️ Alert ${alertId} not found, skipping`);
                    skippedCount++;
                    continue;
                }

                const alertData = alert[0];
                const currentSentTo = alertData.sent_to || [];
                
                if (!currentSentTo.includes(owner_email)) {
                    console.log(`⚠️ Alert ${alertId} was not sent to ${owner_email}, skipping`);
                    skippedCount++;
                    continue;
                }

                const updatedSentTo = currentSentTo.filter(email => email !== owner_email);

                await base44.asServiceRole.entities.Alert.update(alertId, {
                    sent_to: updatedSentTo
                });

                processedCount++;
                console.log(`✅ Removed ${owner_email} from alert ${alertId}`);
            } catch (error) {
                console.error(`❌ Failed to process alert ${alertId}:`, error.message);
                skippedCount++;
            }
        }

        console.log(`✅ Bulk remove complete: ${processedCount} processed, ${skippedCount} skipped`);

        return Response.json({
            success: true,
            alerts_processed: processedCount,
            alerts_skipped: skippedCount,
            owner_email,
            message: `Removed ${processedCount} alerts from ${owner_email}'s digest history`
        });

    } catch (error) {
        console.error('❌ Bulk remove error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});