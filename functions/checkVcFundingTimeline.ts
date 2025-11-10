import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all companies with investment dates
        const companies = await base44.asServiceRole.entities.Company.filter({
            monitoring_active: true
        });

        const now = new Date();
        const alerts = [];

        for (const company of companies) {
            if (!company.investment_date) continue;

            try {
                const investmentDate = new Date(company.investment_date);
                const yearsAgo = (now - investmentDate) / (1000 * 60 * 60 * 24 * 365);

                // Alert if 3+ years ago and we haven't alerted for this before
                if (yearsAgo >= 3) {
                    // Check if we've already created this alert
                    const existingAlerts = await base44.asServiceRole.entities.Alert.filter({
                        company_id: company.id,
                        trigger_type: 'funding_round'
                    });

                    if (existingAlerts.length === 0) {
                        // Calculate which series (rough estimate)
                        const roundYear = investmentDate.getFullYear();
                        const seriesEstimate = yearsAgo >= 5 ? "B/C" : "A/B";

                        const alert = await base44.asServiceRole.entities.Alert.create({
                            company_id: company.id,
                            company_name: company.name,
                            trigger_type: 'funding_round',
                            headline: `VC funding approaching ${Math.floor(yearsAgo)}-year mark`,
                            summary: `${company.name} raised funding around ${roundYear}, approximately ${Math.floor(yearsAgo)} years ago. Early VC investors may be approaching exit windows, making this a good time to explore PE positioning.`,
                            tier: 'tier_2',
                            priority: 'medium',
                            status: 'new',
                            actionable_insight: `Reach out to discuss PE as a follow-on to VC, positioning for secondary buyout or growth capital.`,
                            draft_email: `Hi [Name],\n\nI saw ${company.name} raised its Series ${seriesEstimate} around ${roundYear}. Many of our investments come from similar situations where early VC investors are approaching exit windows.\n\nThought it could be good to connect and exchange thoughts on if and how PE can support that next chapter for ${company.name}.\n\nHappy to chat if the timing makes sense.\n\nBest,\n[Your Name]`,
                            detected_date: now.toISOString().split('T')[0]
                        });

                        alerts.push(alert);
                        console.log(`✓ Created VC timeline alert for ${company.name} (${Math.floor(yearsAgo)} years since funding)`);
                    }
                }
            } catch (error) {
                console.error(`Error processing ${company.name}:`, error.message);
            }
        }

        return Response.json({
            success: true,
            alerts_generated: alerts.length,
            alerts
        });

    } catch (error) {
        console.error('VC timeline check error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});