import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all succession checks with calculated ages
        const successionChecks = await base44.asServiceRole.entities.SuccessionCheck.filter({
            active: true
        });

        const prospects55Plus = successionChecks.filter(s => s.calculated_age && s.calculated_age >= 55);

        if (prospects55Plus.length === 0) {
            return Response.json({
                success: true,
                message: 'No founders 55+ found',
                alerts_generated: 0
            });
        }

        console.log(`🎯 Found ${prospects55Plus.length} founders aged 55+`);

        const alerts = [];
        const currentYear = new Date().getFullYear();
        const today = new Date().toISOString().split('T')[0];

        for (const check of prospects55Plus) {
            try {
                // Check if we've already alerted this year
                const existingAlerts = await base44.asServiceRole.entities.Alert.filter({
                    company_name: check.company_name,
                    trigger_type: 'other',
                    headline: { $regex: 'succession', $options: 'i' }
                });

                // Filter to this year's alerts
                const thisYearAlerts = existingAlerts.filter(a => {
                    const alertYear = new Date(a.created_date).getFullYear();
                    return alertYear === currentYear;
                });

                if (thisYearAlerts.length > 0) {
                    console.log(`⏭️ Already alerted for ${check.company_name} this year`);
                    continue;
                }

                const alertData = {
                    company_id: check.company_name,
                    company_name: check.company_name,
                    trigger_type: 'other',
                    headline: `Founder succession planning opportunity (Age ${check.calculated_age})`,
                    summary: `The founder of ${check.company_name} is ${check.calculated_age} years old, entering the typical succession planning age range. This may indicate openness to discussing next-phase growth or exit planning.`,
                    tier: 'tier_2',
                    priority: 'medium',
                    status: 'new',
                    actionable_insight: `Tailored founder-succession messaging. Share content on succession planning and PE partnerships.`,
                    draft_email: `Hi [Name],\n\nI've been following ${check.company_name} for a while and thought you might find this useful.\n\nWe recently wrote about how founders plan for the next phase of growth and succession, based on conversations with others who've been through it. Thought it might be relevant given where ${check.company_name} is today.\n\nHappy to share more if it's helpful.\n\nBest,\n[Your Name]`,
                    detected_date: today,
                    source_url: check.linkedin_url
                };

                const alert = await base44.asServiceRole.entities.Alert.create(alertData);
                alerts.push(alert);
                console.log(`✓ Created succession alert for ${check.company_name} (age ${check.calculated_age})`);

            } catch (error) {
                console.error(`❌ Error creating alert for ${check.company_name}:`, error.message);
            }
        }

        return Response.json({
            success: true,
            prospects_55_plus: prospects55Plus.length,
            alerts_generated: alerts.length,
            message: `Generated ${alerts.length} succession alerts from ${prospects55Plus.length} prospects aged 55+`
        });

    } catch (error) {
        console.error('Generate succession alerts error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});