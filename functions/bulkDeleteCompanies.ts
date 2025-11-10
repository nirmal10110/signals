import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { companyIds } = await req.json();

        if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
            return Response.json({ error: 'Invalid input: companyIds must be a non-empty array.' }, { status: 400 });
        }

        let deletedAlertsCount = 0;
        let deletedCompaniesCount = 0;

        // Process each company individually for robustness
        for (const companyId of companyIds) {
            // 1. Find and delete associated alerts for the current company
            const alertsToDelete = await base44.asServiceRole.entities.Alert.filter({
                company_id: companyId
            });

            for (const alert of alertsToDelete) {
                await base44.asServiceRole.entities.Alert.delete(alert.id);
                deletedAlertsCount++;
            }

            // 2. Delete the company itself
            await base44.asServiceRole.entities.Company.delete(companyId);
            deletedCompaniesCount++;
        }

        return Response.json({
            success: true,
            deletedCompaniesCount,
            deletedAlertsCount
        });

    } catch (error) {
        console.error('Bulk delete error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});