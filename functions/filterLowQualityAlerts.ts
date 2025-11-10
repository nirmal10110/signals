import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

async function fetchSourceContent(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: AbortSignal.timeout(8000)
        });
        
        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}` };
        }
        
        const html = await response.text();
        
        // Extract text content (basic extraction)
        const textContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 3000); // Limit to first 3000 chars
        
        return { success: true, content: textContent };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

Deno.serve(async (req) => {
    const startTime = Date.now();
    const MAX_EXECUTION_TIME = 55000;
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        console.log('🔍 Starting quality filter with source verification...');

        const allNewAlerts = await base44.asServiceRole.entities.Alert.filter({
            status: 'new'
        });

        console.log(`📊 Found ${allNewAlerts.length} new alerts to review`);

        if (allNewAlerts.length === 0) {
            return Response.json({
                success: true,
                message: 'No new alerts to filter',
                total_reviewed: 0,
                total_suggestions: 0,
                suggestions: {
                    high: [],
                    medium: [],
                    low: []
                }
            });
        }

        // LIMIT: Only process first 30 alerts (reduced due to source fetching)
        const alertsToProcess = allNewAlerts.slice(0, 30);
        console.log(`📊 Processing first ${alertsToProcess.length} alerts with source verification`);

        const suggestions = [];

        // Process in batches of 3 (reduced due to source fetching)
        const BATCH_SIZE = 3;
        for (let i = 0; i < alertsToProcess.length; i += BATCH_SIZE) {
            if (Date.now() - startTime > MAX_EXECUTION_TIME) {
                console.log('⏱️ Timeout reached, stopping early');
                break;
            }

            const batch = alertsToProcess.slice(i, i + BATCH_SIZE);
            
            console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(alertsToProcess.length / BATCH_SIZE)}...`);

            for (const alert of batch) {
                try {
                    console.log(`\n  🔍 Checking: ${alert.company_name} - ${alert.headline}`);
                    
                    // Fetch source content
                    let sourceContent = '';
                    let sourceError = null;
                    
                    if (alert.source_url) {
                        console.log(`  📄 Fetching source: ${alert.source_url}`);
                        const fetchResult = await fetchSourceContent(alert.source_url);
                        
                        if (fetchResult.success) {
                            sourceContent = fetchResult.content;
                            console.log(`  ✅ Source fetched (${sourceContent.length} chars)`);
                        } else {
                            sourceError = fetchResult.error;
                            console.log(`  ⚠️ Could not fetch source: ${sourceError}`);
                        }
                    }

                    const alertContext = `
Company: ${alert.company_name}
Trigger Type: ${alert.trigger_type}
Headline: ${alert.headline}
Summary: ${alert.summary || 'N/A'}
Tier: ${alert.tier}
Detected Date: ${alert.detected_date || alert.created_date}
Date Evidence: ${alert.date_evidence || 'N/A'}
Source URL: ${alert.source_url || 'N/A'}
`;

                    const assessmentPrompt = `You are reviewing a deal intelligence alert for a UK private equity firm. 

**TODAY'S DATE: ${new Date().toISOString().split('T')[0]}**

Assess if this alert should be kept or dismissed based on:
1. **Strategic relevance** - Is this news significant enough for PE relationship building?
2. **Date accuracy** - Is the date recent (last 30 days) and verified from the source?

**Alert Details:**
${alertContext}

${sourceContent ? `**ACTUAL SOURCE CONTENT (verify date and relevance):**
${sourceContent}

IMPORTANT: Check the source content for:
- Publication date mentions (look for dates, "Published", "Posted", etc.)
- Whether the content matches the headline/summary
- Strategic significance of the news
` : `**Note:** Could not fetch source content${sourceError ? ` (${sourceError})` : ''}. Assess based on alert metadata only.`}

**Dismiss if:**
- Date is NOT within last 30 days (check source content for actual date)
- Date is uncertain or cannot be verified from source
- Minor product updates or small feature releases
- Routine blog posts or content marketing
- Minor team hires (non-executive roles)
- Generic industry news not specific to the company
- Webinars or minor event appearances
- Social media milestones
- Minor awards (internal, small regional)
- Purely promotional press releases
- Source content doesn't match the headline (false positive)

**Keep if:**
- Date is verified as within last 30 days from source content
- Executive hires (C-suite, VP, Directors)
- Board appointments or investors
- Acquisitions or major partnerships
- International expansion
- Significant funding rounds
- Major industry awards (FT 1000, Inc 5000, etc.)
- Company milestones (5, 10, 15+ years)
- Major client wins (Fortune 500, enterprise)
- New office openings in new geographies
- Strategic product launches
- Source content confirms strategic significance

**Your task:**
Assess if this alert should be **kept** or **dismissed**.

Respond with JSON containing:
- "decision": "keep" or "dismiss"
- "reason": Brief explanation mentioning what you found in source (1-2 sentences)
- "confidence": "high", "medium", or "low"
- "date_verified": true/false (did you find date confirmation in source?)
- "strategic_value": "high", "medium", or "low"`;

                    const assessment = await base44.asServiceRole.integrations.Core.InvokeLLM({
                        prompt: assessmentPrompt,
                        response_json_schema: {
                            type: "object",
                            properties: {
                                decision: { type: "string", enum: ["keep", "dismiss"] },
                                reason: { type: "string" },
                                confidence: { type: "string", enum: ["high", "medium", "low"] },
                                date_verified: { type: "boolean" },
                                strategic_value: { type: "string", enum: ["high", "medium", "low"] }
                            }
                        }
                    });

                    if (assessment.decision === 'dismiss') {
                        suggestions.push({
                            alert_id: alert.id,
                            company: alert.company_name,
                            headline: alert.headline,
                            trigger_type: alert.trigger_type,
                            tier: alert.tier,
                            reason: assessment.reason,
                            confidence: assessment.confidence,
                            date_verified: assessment.date_verified,
                            strategic_value: assessment.strategic_value,
                            source_url: alert.source_url,
                            source_checked: !!sourceContent
                        });

                        console.log(`  💡 Suggested discard: ${alert.company_name}`);
                        console.log(`     Reason: ${assessment.reason}`);
                        console.log(`     Confidence: ${assessment.confidence} | Date verified: ${assessment.date_verified} | Strategic value: ${assessment.strategic_value}`);
                    } else {
                        console.log(`  ✅ Keep: ${alert.company_name} - ${assessment.reason}`);
                    }

                } catch (error) {
                    console.error(`  ⚠️ Error processing alert ${alert.id}:`, error.message);
                }

                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        const highConfidence = suggestions.filter(s => s.confidence === 'high');
        const mediumConfidence = suggestions.filter(s => s.confidence === 'medium');
        const lowConfidence = suggestions.filter(s => s.confidence === 'low');

        const summary = {
            success: true,
            total_reviewed: alertsToProcess.length,
            total_suggestions: suggestions.length,
            high_confidence: highConfidence.length,
            medium_confidence: mediumConfidence.length,
            low_confidence: lowConfidence.length,
            suggestions: {
                high: highConfidence,
                medium: mediumConfidence,
                low: lowConfidence
            },
            message: `Reviewed ${alertsToProcess.length} alerts with source verification: ${suggestions.length} suggested for dismissal`,
            execution_time: ((Date.now() - startTime) / 1000).toFixed(1) + 's',
            note: allNewAlerts.length > 30 ? `Limited to first 30 alerts for performance. ${allNewAlerts.length - 30} alerts not reviewed.` : undefined
        };

        console.log(`\n✅ Quality filter complete!`);
        console.log(`   - Reviewed: ${summary.total_reviewed} (with source verification)`);
        console.log(`   - Suggested discards: ${summary.total_suggestions}`);
        console.log(`     • High confidence: ${highConfidence.length}`);
        console.log(`     • Medium confidence: ${mediumConfidence.length}`);
        console.log(`     • Low confidence: ${lowConfidence.length}`);
        console.log(`   - Execution time: ${summary.execution_time}`);

        return Response.json(summary);

    } catch (error) {
        console.error('❌ Filter error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack,
            execution_time: ((Date.now() - startTime) / 1000).toFixed(1) + 's'
        }, { status: 500 });
    }
});