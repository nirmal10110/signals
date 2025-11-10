import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { alert_id, feedback, notes } = await req.json();

        if (!alert_id || !feedback) {
            return Response.json({ error: 'alert_id and feedback are required' }, { status: 400 });
        }

        if (!['helpful', 'not_helpful', 'false_positive'].includes(feedback)) {
            return Response.json({ error: 'Invalid feedback value' }, { status: 400 });
        }

        // Get the alert
        const alerts = await base44.asServiceRole.entities.Alert.filter({ id: alert_id });
        if (alerts.length === 0) {
            return Response.json({ error: 'Alert not found' }, { status: 404 });
        }

        // Update alert with feedback
        await base44.asServiceRole.entities.Alert.update(alert_id, {
            user_feedback: feedback,
            feedback_notes: notes || '',
            feedback_by: user.email
        });

        console.log(`✅ Feedback recorded: ${feedback} for alert ${alert_id} by ${user.email}`);

        // If marked as false positive, optionally auto-dismiss
        if (feedback === 'false_positive') {
            await base44.asServiceRole.entities.Alert.update(alert_id, {
                status: 'dismissed'
            });
            console.log(`   → Auto-dismissed alert as false positive`);
        }

        return Response.json({
            success: true,
            message: 'Feedback recorded successfully'
        });

    } catch (error) {
        console.error('Feedback submission error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});