import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const companies = await base44.asServiceRole.entities.Company.filter({
            monitoring_active: true
        });

        const alerts = [];

        for (const company of companies) {
            try {
                // Check employee growth YoY
                if (company.employee_growth_yoy) {
                    const growthStr = company.employee_growth_yoy.toString();
                    const growthMatch = growthStr.match(/(\d+)/);
                    
                    if (growthMatch) {
                        const growthPercent = parseInt(growthMatch[0]);
                        
                        if (growthPercent >= 20) {
                            // Check if we've already alerted on this
                            const existingAlerts = await base44.asServiceRole.entities.Alert.filter({
                                company_id: company.id,
                                trigger_type: 'headcount_growth'
                            });

                            if (existingAlerts.length === 0) {
                                const alert = await base44.asServiceRole.entities.Alert.create({
                                    company_id: company.id,
                                    company_name: company.name,
                                    trigger_type: 'headcount_growth',
                                    headline: `${growthPercent}% employee growth YoY at ${company.name}`,
                                    summary: `${company.name} has grown its headcount by ${growthPercent}% year-over-year, indicating strong scaling momentum and potential need for operational support.`,
                                    tier: 'tier_2',
                                    priority: 'medium',
                                    status: 'new',
                                    actionable_insight: `Flag as scaling indicator. Share content on operationalising growth or international expansion.`,
                                    draft_email: `Hi [Name],\n\nI've been tracking ${company.name}'s growth and noticed you've scaled the team significantly over the past year (${growthPercent}% growth). Impressive momentum.\n\nWe've written a short piece on operationalising growth based on what's working for similar companies. Thought it might be useful as you scale – happy to share more if relevant.\n\nLet me know if it would be helpful to compare notes.\n\nBest,\n[Your Name]`,
                                    detected_date: new Date().toISOString().split('T')[0]
                                });

                                alerts.push(alert);
                                console.log(`✓ Created employee growth alert for ${company.name} (${growthPercent}% YoY)`);
                            }
                        }
                    }
                }

                // Check recent leadership hires
                if (company.recent_leadership_hires && company.recent_leadership_hires.trim()) {
                    const existingAlerts = await base44.asServiceRole.entities.Alert.filter({
                        company_id: company.id,
                        trigger_type: 'executive_hiring',
                        headline: { $contains: 'recent leadership' }
                    });

                    if (existingAlerts.length === 0) {
                        const alert = await base44.asServiceRole.entities.Alert.create({
                            company_id: company.id,
                            company_name: company.name,
                            trigger_type: 'executive_hiring',
                            headline: `Recent leadership hires at ${company.name}`,
                            summary: `${company.name} has made recent leadership hires: ${company.recent_leadership_hires}. This indicates organizational growth and potential need for strategic support.`,
                            tier: 'tier_1',
                            priority: 'high',
                            status: 'new',
                            actionable_insight: `Personal outreach to discuss leadership transition support and PE value-add during scaling phase.`,
                            draft_email: `Hi [Name],\n\nI saw you recently brought on new leadership at ${company.name}. That's a significant move as you scale.\n\nWould be keen to hear what you expect these roles to bring and compare notes on current strategy. We've worked with several companies at similar stages and happy to share what's worked.\n\nLet me know if you're up for a quick chat.\n\nBest,\n[Your Name]`,
                            detected_date: new Date().toISOString().split('T')[0]
                        });

                        alerts.push(alert);
                        console.log(`✓ Created leadership hire alert for ${company.name}`);
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
        console.error('Employee growth check error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});