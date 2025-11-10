import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const now = new Date();
        const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

        // Get all tier 1 alerts that haven't been actioned
        const overdueAlerts = await base44.asServiceRole.entities.Alert.filter({
            tier: 'tier_1',
            status: 'new'
        });

        const escalations = [];

        for (const alert of overdueAlerts) {
            const createdDate = new Date(alert.created_date);
            const hoursSinceCreated = (now - createdDate) / (1000 * 60 * 60);

            // 48-hour reminder
            if (hoursSinceCreated >= 48 && hoursSinceCreated < 50 && !alert.reminder_48hr_sent) {
                if (user?.email) {
                    await base44.asServiceRole.integrations.Core.SendEmail({
                        to: user.email,
                        subject: `[Volpi Lens] ⏰ 48hr Reminder - ${alert.company_name}`,
                        body: `Reminder: Tier 1 Alert Pending Action\n\nCompany: ${alert.company_name}\nTrigger: ${alert.trigger_type}\nHeadline: ${alert.headline}\n\nThis alert was generated 48 hours ago and hasn't been actioned yet.\n\nView in dashboard to take action.`
                    });
                }
                
                await base44.asServiceRole.entities.Alert.update(alert.id, {
                    reminder_48hr_sent: true
                });
                
                escalations.push({ type: '48hr_reminder', alert_id: alert.id });
            }

            // 5-day escalation
            if (createdDate < fiveDaysAgo && !alert.escalation_sent) {
                if (user?.email) {
                    await base44.asServiceRole.integrations.Core.SendEmail({
                        to: user.email,
                        subject: `[Volpi Lens] 🚨 ESCALATION - 5 Days Overdue - ${alert.company_name}`,
                        body: `URGENT: Tier 1 Alert Overdue\n\nCompany: ${alert.company_name}\nTrigger: ${alert.trigger_type}\nHeadline: ${alert.headline}\n\nThis alert was generated 5+ days ago and still hasn't been actioned.\n\nPlease review and action immediately in the dashboard.`
                    });
                }
                
                await base44.asServiceRole.entities.Alert.update(alert.id, {
                    escalation_sent: true,
                    priority: 'high' // Escalate priority
                });
                
                escalations.push({ type: '5day_escalation', alert_id: alert.id });
            }
        }

        return Response.json({
            success: true,
            escalations_sent: escalations.length,
            escalations
        });

    } catch (error) {
        console.error('Follow-up check error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});