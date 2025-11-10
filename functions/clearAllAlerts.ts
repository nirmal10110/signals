import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all alerts
        const alerts = await base44.asServiceRole.entities.Alert.list();
        
        console.log(`Found ${alerts.length} alerts to delete`);

        let deletedCount = 0;
        
        // Delete each alert
        for (const alert of alerts) {
            try {
                await base44.asServiceRole.entities.Alert.delete(alert.id);
                deletedCount++;
                
                // Rate limiting: 200ms between deletions
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.error(`Error deleting alert ${alert.id}:`, error.message);
            }
        }

        console.log(`✓ Deleted ${deletedCount} alerts`);

        return Response.json({
            success: true,
            deleted: deletedCount,
            message: `Successfully cleared ${deletedCount} alerts. Ready for fresh monitoring run.`
        });

    } catch (error) {
        console.error('Clear alerts error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});