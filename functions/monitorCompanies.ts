import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

function isValidDate(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
}

function isWithin30Days(dateString, cutoffDate) {
    if (!isValidDate(dateString)) return false;
    const date = new Date(dateString);
    const cutoff = new Date(cutoffDate);
    return date >= cutoff;
}

function hasRecentYearInUrl(url) {
    if (!url) return false;
    return url.includes('/2025/') || url.includes('/2024/');
}

function extractYearFromUrl(url) {
    if (!url) return null;
    const yearMatch = url.match(/\/(\d{4})\//);
    return yearMatch ? parseInt(yearMatch[1]) : null;
}

// NEW: Verify source URL actually exists and fetch content
async function verifySourceUrl(url) {
    try {
        console.log(`    🔗 Verifying source URL: ${url}`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: AbortSignal.timeout(8000)
        });
        
        if (!response.ok) {
            console.log(`    ❌ Source verification failed: HTTP ${response.status}`);
            return { valid: false, reason: `HTTP ${response.status}` };
        }
        
        const html = await response.text();
        
        // Extract text content for validation
        const textContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 5000);
        
        if (textContent.length < 100) {
            console.log(`    ❌ Source has insufficient content (${textContent.length} chars)`);
            return { valid: false, reason: 'Insufficient content' };
        }
        
        console.log(`    ✅ Source verified (${textContent.length} chars)`);
        return { valid: true, content: textContent };
        
    } catch (error) {
        console.log(`    ❌ Source verification error: ${error.message}`);
        return { valid: false, reason: error.message };
    }
}

Deno.serve(async (req) => {
    const startTime = Date.now();
    const MAX_EXECUTION_TIME = 50000;
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

        console.log(`📅 Today: ${todayStr}`);
        console.log(`📅 Cutoff (30 days ago): ${cutoffDate}`);
        console.log(`⚠️ Source URL verification: ENABLED`);

        const allCompanies = await base44.asServiceRole.entities.Company.filter({
            monitoring_active: true,
            tier: 'tier_1'
        });

        if (allCompanies.length === 0) {
            return Response.json({
                success: true,
                message: 'No active tier 1 companies to monitor',
                companies_monitored: 0,
                alerts_generated: 0,
                remaining_companies: 0,
                has_more: false
            });
        }

        const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
        let companies = allCompanies.filter(c => {
            if (!c.last_monitored) return true;
            return new Date(c.last_monitored) < threeMinutesAgo;
        });

        if (companies.length === 0) {
            return Response.json({
                success: true,
                message: 'All companies monitored recently',
                companies_monitored: 0,
                alerts_generated: 0,
                remaining_companies: 0,
                has_more: false
            });
        }

        companies.sort((a, b) => {
            if (!a.last_monitored && b.last_monitored) return -1;
            if (a.last_monitored && !b.last_monitored) return 1;
            if (!a.last_monitored && !b.last_monitored) return 0;
            return new Date(a.last_monitored).getTime() - new Date(b.last_monitored).getTime();
        });

        console.log(`📋 Companies to monitor (sorted by oldest first):`);
        companies.slice(0, 5).forEach(c => {
            console.log(`  - ${c.name}: ${c.last_monitored ? new Date(c.last_monitored).toISOString() : 'NEVER'}`);
        });

        const BATCH_SIZE = 2;
        const batch = companies.slice(0, BATCH_SIZE);
        const remaining = companies.length - BATCH_SIZE;

        console.log(`\n🔄 Processing ${batch.length} companies (${remaining} remaining after this batch)`);

        const alertsCreated = [];

        for (const company of batch) {
            if (Date.now() - startTime > MAX_EXECUTION_TIME) {
                console.log('⏱️ Timeout approaching, stopping batch');
                break;
            }

            try {
                console.log(`\n🔍 Monitoring: ${company.name}`);
                console.log(`   Last monitored: ${company.last_monitored || 'NEVER'}`);

                let context = `Company: ${company.name}`;
                if (company.website) context += `\nWebsite: ${company.website}`;
                if (company.linkedin_url) context += `\nLinkedIn: ${company.linkedin_url}`;
                if (company.industry) context += `\nIndustry: ${company.industry}`;

                const prompt = `**TODAY'S DATE: ${todayStr}**

**CRITICAL: You MUST only report news that actually exists and has a real, verifiable source URL.**
**DO NOT make up, assume, or infer news that you haven't found. DO NOT create hypothetical news.**
**If you cannot find verifiable news with a real source URL, return an empty news_items array.**

Search for recent, REAL, VERIFIABLE news about this company:

${context}

**MANDATORY SOURCE VERIFICATION:**
- Every news item MUST have a real, accessible source URL that you found
- The URL must point to an actual article/page (not just the homepage)
- You must have actually found this article during your search
- NEVER generate a URL - it must be real and working
- If you cannot find a real source URL, DO NOT report the news

**DATE REQUIREMENTS:**
- Find the publication date from the actual article
- Look for: HTML datetime tags, "Published [date]", URL paths, article text
- Convert ALL dates to YYYY-MM-DD format (e.g., "2025-01-15")
- Include news published between ${cutoffDate} and ${todayStr} (last 30 days)
- "date_evidence" should show where you found the date (e.g., "HTML <time datetime='2025-01-15'>", "Article: Published 15 Jan 2025", "URL: /2025/01/15/article")
- Relative dates like "3 days ago" are acceptable - just calculate the actual date

**WHERE TO LOOK:**
1) Company website: /news, /press, /media, /blog, /insights, /stories, /updates, /careers
   - Navigate to actual article pages (not just listing pages)
2) Company LinkedIn and Founder LinkedIn (if provided)
3) Industry news sources with clear dates (NOT press release aggregators)

**NEWS CATEGORIES:**

**Tier 1 (HIGH PRIORITY):**
- C-suite hires (CEO, CFO, COO, CTO, CMO, CRO)
- Board appointments or new investors
- Acquisitions (company buying or being bought)
- International expansion (new country/region)
- Funding rounds (Seed, Series A-D+, growth equity)
- Major awards or industry certifications
- Company milestones/anniversaries (5, 10, 15, 20+ years)
- Major client wins (Fortune 500, enterprise deals)

**Tier 2 (MEDIUM PRIORITY):**
- New product launches or major features
- Strategic partnerships
- New office openings (domestic)
- Speaking engagements at major industry events
- Thought leadership (whitepapers, research)

**RESPONSE FORMAT:**
{
  "trigger_type": "ceo_hiring|cfo_hiring|executive_hiring|acquisition_announced|international_expansion|funding_round|industry_award|company_milestone|partnership|new_product_launch|new_office_opened|event_participation",
  "headline": "[Clear headline from the actual article, max 100 characters]",
  "summary": "[2-3 sentence summary of actual news content]",
  "source_url": "[REAL, COMPLETE URL to the actual article you found]",
  "date_published": "[YYYY-MM-DD format]",
  "date_confidence": "high|uncertain",
  "date_evidence": "[Exact quote/location where date was found]",
  "tier": "tier_1|tier_2"
}

**VALIDATION RULES:**
✅ MUST have: Real, working source URL you actually found
✅ MUST have: Date between ${cutoffDate} and ${todayStr}
✅ MUST have: High date confidence
✅ MUST be: Real news you found, not assumed/inferred

❌ REJECT: Any news without a real source URL
❌ REJECT: Dates older than ${cutoffDate} or future dates
❌ REJECT: Uncertain dates
❌ REJECT: Made-up or hypothetical news
❌ REJECT: Press release aggregators or unverifiable sources

**If you cannot find any verifiable news, return: { "news_items": [] }**

Max 3 items per company. Quality over quantity. ONLY REAL NEWS.

Return "news_items" array with 0-3 REAL items.`;

                console.log(`\n📝 Searching for news...`);

                const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
                    prompt,
                    add_context_from_internet: true,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            news_items: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        trigger_type: { type: "string" },
                                        headline: { type: "string" },
                                        summary: { type: "string" },
                                        source_url: { type: "string" },
                                        date_published: { type: "string" },
                                        date_confidence: { type: "string", enum: ["high", "uncertain"] },
                                        date_evidence: { type: "string" },
                                        tier: { type: "string", enum: ["tier_1", "tier_2"] }
                                    },
                                    required: ["trigger_type", "headline", "summary", "source_url", "date_published", "date_evidence", "tier", "date_confidence"]
                                }
                            }
                        }
                    }
                });

                const items = result.news_items || [];
                console.log(`\n📊 LLM Response: Found ${items.length} news items`);

                for (const item of items) {
                    console.log(`\n  Checking: ${item.headline}`);
                    console.log(`  Published: ${item.date_published} (confidence: ${item.date_confidence})`);
                    console.log(`  Evidence: ${item.date_evidence}`);
                    console.log(`  Source URL: ${item.source_url}`);
                    
                    // CRITICAL: Verify source URL actually exists
                    const urlVerification = await verifySourceUrl(item.source_url);
                    if (!urlVerification.valid) {
                        console.log(`  ❌ REJECTED: Source URL verification failed (${urlVerification.reason})`);
                        console.log(`  ⚠️ WARNING: LLM may have hallucinated this news - URL doesn't exist or is inaccessible`);
                        continue;
                    }
                    
                    // Require high confidence
                    if (item.date_confidence !== 'high') {
                        console.log(`  ❌ REJECTED: Date confidence is not HIGH (got: ${item.date_confidence})`);
                        continue;
                    }

                    // Validate URL format
                    if (!item.source_url || !(item.source_url.startsWith('http://') || item.source_url.startsWith('https://'))) {
                        console.log(`  ❌ REJECTED: Invalid or missing URL`);
                        continue;
                    }

                    // Validate date format
                    if (!isValidDate(item.date_published)) {
                        console.log(`  ❌ REJECTED: Invalid date format`);
                        continue;
                    }

                    // Check if date is within 30-day window
                    if (!isWithin30Days(item.date_published, cutoffDate)) {
                        console.log(`  ❌ REJECTED: Outside 30-day window`);
                        continue;
                    }

                    // Year validation - must be 2025+
                    const publishedDate = new Date(item.date_published);
                    const publishedYear = publishedDate.getFullYear();
                    
                    if (publishedYear < 2025) {
                        console.log(`  ❌ REJECTED: Date is from ${publishedYear}, must be 2025 or later`);
                        continue;
                    }

                    // URL year cross-validation
                    const urlYear = extractYearFromUrl(item.source_url);
                    if (urlYear && urlYear < 2024) {
                        console.log(`  ❌ REJECTED: URL contains old year ${urlYear}`);
                        continue;
                    }
                    if (urlYear && Math.abs(urlYear - publishedYear) > 1) {
                        console.log(`  ⚠️ WARNING: URL year ${urlYear} doesn't match published year ${publishedYear}, but within tolerance`);
                    }

                    // ENHANCED DUPLICATE CHECK
                    const existingByHeadline = await base44.asServiceRole.entities.Alert.filter({
                        company_id: company.id,
                        headline: item.headline.substring(0, 100)
                    });

                    const existingByUrl = await base44.asServiceRole.entities.Alert.filter({
                        company_id: company.id,
                        source_url: item.source_url
                    });

                    if (existingByHeadline.length > 0) {
                        console.log(`  ⏭️ SKIPPED: Duplicate alert (same headline)`);
                        continue;
                    }

                    if (existingByUrl.length > 0) {
                        console.log(`  ⏭️ SKIPPED: Duplicate alert (same source URL)`);
                        continue;
                    }

                    // Create alert
                    const alertData = {
                        company_id: company.id,
                        company_name: company.name,
                        trigger_type: item.trigger_type,
                        headline: item.headline.substring(0, 100),
                        summary: item.summary,
                        source_url: item.source_url,
                        detected_date: item.date_published,
                        date_evidence: item.date_evidence,
                        date_needs_review: false,
                        tier: item.tier,
                        priority: item.tier === 'tier_1' ? 'high' : 'medium',
                        status: 'new',
                        email_sent: false,
                        sent_to: [],
                        confidence_score: 95 // Higher confidence since URL was verified
                    };

                    const alert = await base44.asServiceRole.entities.Alert.create(alertData);
                    alertsCreated.push(alert);
                    
                    console.log(`  ✅ CREATED: Alert saved with verified source (ID: ${alert.id.substring(0, 8)}...)`);
                    console.log(`  📅 Published: ${item.date_published} (Year: ${publishedYear})`);
                    console.log(`  📌 Evidence: ${item.date_evidence}`);
                    console.log(`  🔗 Verified URL: ${item.source_url}`);
                }

                // Update last_monitored
                await base44.asServiceRole.entities.Company.update(company.id, {
                    last_monitored: new Date().toISOString()
                });

                console.log(`\n✅ ${company.name}: Generated ${alertsCreated.filter(a => a.company_id === company.id).length} verified alerts`);

            } catch (error) {
                console.error(`❌ Error monitoring ${company.name}:`, error.message);
                
                try {
                    await base44.asServiceRole.entities.Company.update(company.id, {
                        last_monitored: new Date().toISOString()
                    });
                    console.log(`   ⚠️ Updated last_monitored despite error`);
                } catch (e) {
                    console.error(`   ❌ Failed to update last_monitored:`, e.message);
                }
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const response = {
            success: true,
            companies_monitored: batch.length,
            alerts_generated: alertsCreated.length,
            remaining_companies: Math.max(0, remaining),
            has_more: remaining > 0,
            date_range: `${cutoffDate} to ${todayStr}`,
            filtering_mode: 'strict - source URL verification enabled',
            execution_time: ((Date.now() - startTime) / 1000).toFixed(1)
        };

        if (remaining > 0) {
            response.message = `Processed ${batch.length} companies. ${remaining} remaining.`;
        } else {
            response.message = `✅ All ${allCompanies.length} companies monitored with URL verification!`;
        }

        console.log(`\n📈 BATCH COMPLETE:`);
        console.log(`   Monitored: ${batch.length} companies`);
        console.log(`   Verified Alerts: ${alertsCreated.length}`);
        console.log(`   Remaining: ${remaining}`);

        return Response.json(response);

    } catch (error) {
        console.error('Fatal error:', error);
        return Response.json({ 
            error: error.message,
            execution_time: ((Date.now() - startTime) / 1000).toFixed(1)
        }, { status: 500 });
    }
});