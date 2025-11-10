import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const AFFINITY_API_KEY = Deno.env.get("Affinity_API")?.trim();
        
        if (!AFFINITY_API_KEY) {
            return Response.json({ 
                error: 'Affinity_API secret not found',
                message: 'Please set it in Dashboard → Settings → Environment Variables'
            }, { status: 500 });
        }

        console.log('API Key length:', AFFINITY_API_KEY.length);
        console.log('First 10 chars:', AFFINITY_API_KEY.substring(0, 10));

        // Simple authentication test
        const response = await fetch('https://api.affinity.co/v2/auth/whoami', {
            headers: {
                'Authorization': `Bearer ${AFFINITY_API_KEY}`
            }
        });

        const responseText = await response.text();

        if (!response.ok) {
            return Response.json({ 
                success: false,
                status: response.status,
                error: responseText,
                message: 'Affinity API authentication failed'
            }, { status: 500 });
        }

        const data = JSON.parse(responseText);

        return Response.json({
            success: true,
            message: '✅ Affinity API authentication successful!',
            user_info: data
        });

    } catch (error) {
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});