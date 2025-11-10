
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

function parseDate(dateString) {
    if (!dateString) return null;
    
    // Try parsing various date formats
    const formats = [
        // ISO formats
        /^\d{4}-\d{2}-\d{2}$/,
        // Human readable
        /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i,
        // Relative dates
        /(\d+)\s+(day|days|week|weeks|hour|hours)\s+ago/i
    ];
    
    try {
        // Try direct parse first
        const parsed = new Date(dateString);
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }
        
        // Check for relative dates
        const relativeMatch = dateString.match(/(\d+)\s+(day|days|week|weeks)\s+ago/i);
        if (relativeMatch) {
            const amount = parseInt(relativeMatch[1]);
            const unit = relativeMatch[2].toLowerCase();
            const now = new Date();
            
            if (unit.includes('day')) {
                now.setDate(now.getDate() - amount);
            } else if (unit.includes('week')) {
                now.setDate(now.getDate() - (amount * 7));
            }
            
            return now;
        }
        
    } catch (e) {
        return null;
    }
    
    return null;
}

function isRecent(dateString, cutoffDate) {
    const date = parseDate(dateString);
    if (!date) return false;
    
    const cutoff = new Date(cutoffDate);
    return date >= cutoff;
}

function categorizeNewsItem(title, summary) {
    const text = `${title} ${summary}`.toLowerCase();
    
    // TIER 1: MUST REACH OUT (Strong relationship-building opportunities)
    
    // Company milestones & anniversaries
    if (/(anniversary|milestone|celebrating|celebrate|years of|decade|founded.*ago|since.*started|turning.*years)/i.test(text) ||
        /(10 years|5 years|15 years|20 years|25 years)/i.test(text)) {
        return { trigger: 'company_milestone', tier: 'tier_1', priority: 'high' };
    }
    
    // CFO hiring - Finance leadership
    if (/(cfo|chief financial officer|finance director|vp finance|financial controller|head of finance)/i.test(text) && 
        /(hire|hired|join|joined|appoint|appointed|welcome|names|naming)/i.test(text)) {
        return { trigger: 'cfo_hiring', tier: 'tier_1', priority: 'high' };
    }
    
    // CEO hiring
    if (/(ceo|chief executive|managing director|president|md)/i.test(text) && 
        /(hire|hired|join|joined|appoint|appointed|welcome|names|naming)/i.test(text)) {
        return { trigger: 'ceo_hiring', tier: 'tier_1', priority: 'high' };
    }
    
    // Board member
    if (/(board|non-executive director|independent director)/i.test(text) && 
        /(join|joined|appoint|appointed|welcome|names|naming)/i.test(text)) {
        return { trigger: 'board_member_hired', tier: 'tier_1', priority: 'high' };
    }
    
    // Head of Sales/Commercial - expanded to catch Commercial Directors, Regional Directors
    if (/(head of sales|vp sales|sales director|cro|chief revenue|commercial director|regional.*director.*(sales|commercial|revenue)|director.*(sales|commercial|revenue))/i.test(text) && 
        /(hire|hired|join|joined|appoint|appointed|welcome|names|naming)/i.test(text)) {
        return { trigger: 'head_of_sales_hiring', tier: 'tier_1', priority: 'high' };
    }
    
    // Head of Delivery/Operations
    if (/(head of delivery|head of operations|coo|chief operating|operations director|vp operations|regional.*director.*operations)/i.test(text) && 
        /(hire|hired|join|joined|appoint|appointed|welcome|names|naming)/i.test(text)) {
        return { trigger: 'head_of_delivery_hiring', tier: 'tier_1', priority: 'high' };
    }
    
    // Other Executive/Director level hires in strategic functions
    if (/(director|vp|vice president|head of|chief).*(technology|product|marketing|strategy|growth|digital|customer|people|hr)/i.test(text) && 
        /(hire|hired|join|joined|appoint|appointed|welcome|names|naming)/i.test(text)) {
        return { trigger: 'executive_hiring', tier: 'tier_1', priority: 'high' };
    }
    
    // Acquisitions
    if (/(acquire|acquired|acquisition|acquires|buys|bought|takeover|merges with)/i.test(text) && 
        !/(was acquired|being acquired|to be acquired)/i.test(text)) {
        return { trigger: 'acquisition_announced', tier: 'tier_1', priority: 'high' };
    }
    
    // International expansion - catches regional expansion too
    if (/(expan|office|opens|opening|launch)/i.test(text) && 
        /(international|europe|asia|america|americas|global|country|region|stockholm|berlin|paris|new york|london|madrid|singapore|nordic|benelux)/i.test(text)) {
        return { trigger: 'international_expansion', tier: 'tier_1', priority: 'high' };
    }
    
    // Awards & Recognition - ANY award is worth congratulating
    if (/(award|winner|ft 1000|inc 5000|fast 500|partner of the year|recognition|recognised|recognized|ranked|top.*companies|best.*company|shortlisted|finalist|won.*prize)/i.test(text)) {
        return { trigger: 'industry_award', tier: 'tier_1', priority: 'high' };
    }
    
    // Funding
    if (/(funding|investment|series [a-f]|round|raised|capital|investors|seed round|venture)/i.test(text) && 
        !/(seeking funding|looking for)/i.test(text)) {
        return { trigger: 'funding_round', tier: 'tier_1', priority: 'high' };
    }
    
    // Major client wins / case studies
    if (/(case study|customer story|client success|customer success|project success|deployed at|partnership with.*customer|working with.*client)/i.test(text)) {
        return { trigger: 'customer_success', tier: 'tier_1', priority: 'high' };
    }
    
    // TIER 2: GOOD TO REACH OUT (Softer touchpoints)
    
    // Partnership announcements
    if (/(partnership|partner with|strategic.*partner|alliance|collaboration|teaming up|joined forces)/i.test(text)) {
        return { trigger: 'partnership', tier: 'tier_2', priority: 'medium' };
    }
    
    // Product launches
    if (/(new product|product launch|launching|introduces|unveils|announces.*new|released.*version)/i.test(text)) {
        return { trigger: 'new_product_launch', tier: 'tier_2', priority: 'medium' };
    }
    
    // New offices (not international)
    if (/(new office|opens office|office opening|expanding.*office|relocated|moved.*office)/i.test(text)) {
        return { trigger: 'new_office_opened', tier: 'tier_2', priority: 'medium' };
    }
    
    // Event participation (speaking, exhibiting, hosting)
    if (/(speaking at|keynote|presenting at|exhibiting|hosting.*event|conference.*speaker|webinar|workshop)/i.test(text)) {
        return { trigger: 'event_participation', tier: 'tier_2', priority: 'medium' };
    }
    
    // Company culture initiatives
    if (/(culture|values|team building|charity|community|volunteering|giving back|csr|social responsibility)/i.test(text)) {
        return { trigger: 'culture_initiative', tier: 'tier_2', priority: 'medium' };
    }
    
    // Thought leadership content
    if (/(whitepaper|research|report|study|insights|trends|future of|guide to|how to)/i.test(text)) {
        return { trigger: 'thought_leadership', tier: 'tier_2', priority: 'medium' };
    }
    
    return null;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all active tier 1 companies
        const companies = await base44.asServiceRole.entities.Company.filter({
            monitoring_active: true,
            tier: 'tier_1'
        });

        if (companies.length === 0) {
            return Response.json({
                success: true,
                message: 'No companies to monitor',
                alerts_generated: 0
            });
        }

        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
        fifteenDaysAgo.setHours(0, 0, 0, 0);
        const cutoffDate = fifteenDaysAgo.toISOString().split('T')[0];

        console.log(`Starting enhanced monitoring for ${companies.length} companies (cutoff: ${cutoffDate})`);

        const alerts = [];
        const errors = [];

        for (const company of companies) {
            try {
                console.log(`\n🔍 Monitoring: ${company.name}`);
                
                // Call the scraping function with priority order:
                // 1. Website → 2. LinkedIn → 3. Google News
                const scrapeResult = await base44.asServiceRole.functions.invoke('scrapeCompanyNews', {
                    company_id: company.id,
                    company_name: company.name,
                    website: company.website,
                    linkedin_url: company.linkedin_url,
                    ceo_founder_linkedin_url: company.ceo_founder_linkedin_url,
                    careers_url: company.careers_page_url
                });

                const scrapedData = scrapeResult.data;
                if (!scrapedData.success) {
                    console.log(`❌ Scraping failed for ${company.name}`);
                    continue;
                }

                let foundItems = 0;

                // Process sources in priority order (already sorted by scrapeCompanyNews)
                const sortedSources = (scrapedData.results.sources || []).sort((a, b) => 
                    (a.priority || 999) - (b.priority || 999)
                );

                for (const source of sortedSources) {
                    if (!source.items || source.items.length === 0) continue;

                    console.log(`\n  📰 Processing ${source.source_type} (Priority ${source.priority})...`);

                    for (const item of source.items) {
                        // Check if date is recent
                        if (!isRecent(item.date, cutoffDate)) {
                            console.log(`  ⏭️ Skipping old item: ${item.title} (${item.date})`);
                            continue;
                        }

                        // Categorize the news
                        const category = categorizeNewsItem(item.title, item.summary || '');
                        if (!category) {
                            console.log(`  ⏭️ Not strategic: ${item.title}`);
                            continue;
                        }

                        // Check for duplicates
                        const existing = await base44.asServiceRole.entities.Alert.filter({
                            company_id: company.id,
                            headline: item.title.substring(0, 100)
                        });

                        if (existing.length > 0) {
                            console.log(`  ⏭️ Duplicate: ${item.title}`);
                            continue;
                        }

                        // Parse date properly
                        const detectedDate = parseDate(item.date);
                        const formattedDate = detectedDate ? detectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

                        // Create alert
                        const alertData = {
                            company_id: company.id,
                            company_name: company.name,
                            trigger_type: category.trigger,
                            headline: item.title.substring(0, 100),
                            summary: item.summary || item.title,
                            source_url: item.link || '',
                            detected_date: formattedDate,
                            tier: category.tier,
                            priority: category.priority,
                            confidence_score: 85,
                            actionable_insight: `Follow up on this ${category.trigger.replace(/_/g, ' ')} development with the management team.`,
                            status: 'new',
                            email_sent: false,
                            follow_up_due: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
                        };

                        const createdAlert = await base44.asServiceRole.entities.Alert.create(alertData);
                        alerts.push(createdAlert);
                        foundItems++;
                        
                        console.log(`  ✅ Created alert: ${item.title} (${category.trigger}) from ${source.source_type}`);
                    }
                }

                console.log(`\n  📊 ${company.name}: Found ${foundItems} strategic alerts`);

                // Update last_monitored
                await base44.asServiceRole.entities.Company.update(company.id, {
                    last_monitored: new Date().toISOString()
                });

            } catch (companyError) {
                console.error(`Error monitoring ${company.name}:`, companyError.message);
                errors.push({
                    company: company.name,
                    error: companyError.message
                });
            }

            // Rate limiting: 3 seconds between companies
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        return Response.json({
            success: true,
            companies_monitored: companies.length,
            alerts_generated: alerts.length,
            cutoff_date: cutoffDate,
            errors: errors.length > 0 ? errors : undefined,
            timestamp: new Date().toISOString(),
            note: 'Using web scraping + structured news sources for verified dates'
        });

    } catch (error) {
        console.error('Enhanced monitoring error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});
