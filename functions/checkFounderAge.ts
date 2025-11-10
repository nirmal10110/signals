import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all active succession checks that DON'T have age calculated yet
        const successionChecks = await base44.asServiceRole.entities.SuccessionCheck.filter({
            active: true
        });

        // Filter to only those without calculated_age or where age needs recalculation
        const uncheckedProspects = successionChecks.filter(s => !s.calculated_age || !s.university_start_year);

        if (uncheckedProspects.length === 0) {
            return Response.json({
                success: true,
                message: 'All succession prospects already have ages calculated',
                checked: 0
            });
        }

        console.log(`🔍 Calculating ages for ${uncheckedProspects.length} succession prospects...`);

        const currentYear = new Date().getFullYear();
        let successCount = 0;
        let failedCount = 0;

        // Process in batches to avoid timeout
        const BATCH_SIZE = 10;
        for (let i = 0; i < uncheckedProspects.length; i += BATCH_SIZE) {
            const batch = uncheckedProspects.slice(i, i + BATCH_SIZE);
            
            console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(uncheckedProspects.length / BATCH_SIZE)}...`);

            for (const check of batch) {
                try {
                    console.log(`📊 Calculating age for ${check.company_name}...`);
                    
                    const prompt = `Look up the LinkedIn profile at ${check.linkedin_url}.

Find the EDUCATION section and look for when they started university (undergraduate degree).

IMPORTANT: Return ONLY the year they STARTED university (not graduated).
For example, if they attended "University of Cambridge 2005 - 2009", return 2005.

If you find the start year, calculate their current age using:
Current Age = ${currentYear} - [university start year] + 18

Return the data in this exact format.`;

                    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
                        prompt,
                        add_context_from_internet: true,
                        response_json_schema: {
                            type: "object",
                            properties: {
                                university_start_year: { 
                                    type: "number",
                                    description: "Year they started university"
                                },
                                calculated_age: { 
                                    type: "number",
                                    description: "Current age based on formula: 2025 - start year + 18"
                                },
                                confidence: { 
                                    type: "string",
                                    enum: ["high", "medium", "low"]
                                }
                            }
                        }
                    });

                    if (result.calculated_age && result.university_start_year) {
                        // Update succession check record
                        await base44.asServiceRole.entities.SuccessionCheck.update(check.id, {
                            calculated_age: result.calculated_age,
                            university_start_year: result.university_start_year,
                            last_checked: new Date().toISOString()
                        });

                        console.log(`✓ ${check.company_name} - Age ${result.calculated_age} (started uni in ${result.university_start_year})`);
                        successCount++;
                    } else {
                        console.log(`⚠️ Could not calculate age for ${check.company_name}`);
                        failedCount++;
                    }

                    // Rate limiting - 3 seconds between LLM calls
                    await new Promise(resolve => setTimeout(resolve, 3000));

                } catch (error) {
                    console.error(`❌ Error processing ${check.company_name}:`, error.message);
                    failedCount++;
                }
            }
        }

        return Response.json({
            success: true,
            checked: successCount + failedCount,
            successful: successCount,
            failed: failedCount,
            total_prospects: successionChecks.length,
            message: `Calculated ages for ${successCount} prospects, ${failedCount} failed`
        });

    } catch (error) {
        console.error('Founder age check error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});