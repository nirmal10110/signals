import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Allow both authenticated users AND service role calls (from other functions)
        const isAuthenticated = await base44.auth.isAuthenticated();
        
        if (!isAuthenticated) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { to, subject, html, from_name } = await req.json();

        if (!to || !subject || !html) {
            return Response.json({ 
                error: 'Missing required fields: to, subject, html' 
            }, { status: 400 });
        }

        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (!resendApiKey) {
            return Response.json({ 
                error: 'RESEND_API_KEY not configured' 
            }, { status: 500 });
        }

        console.log(`📧 Sending email to: ${to}`);
        console.log(`📝 Subject: ${subject}`);

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: from_name ? `${from_name} <noreply@updates.volpicapital.com>` : 'Volpi Lens <noreply@updates.volpicapital.com>',
                to: [to],
                subject: subject,
                html: html
            })
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('❌ Resend API error:', result);
            return Response.json({ 
                error: 'Failed to send email via Resend',
                details: result
            }, { status: response.status });
        }

        console.log('✅ Email sent successfully:', result.id);

        return Response.json({
            success: true,
            email_id: result.id,
            recipient: to
        });

    } catch (error) {
        console.error('❌ Send email error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});