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

// Verify source URL and extract actual publication date from the page
async function verifyAndExtractDate(url, claimedDate) {
    try {
        console.log(`    🔗 Fetching article: ${url}`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: AbortSignal.timeout(10000)
        });
        
        if (!response.ok) {
            console.log(`    ❌ Source verification failed: HTTP ${response.status}`);
            return { valid: false, reason: `HTTP ${response.status}` };
        }
        
        const html = await response.text();
        
        // Extract text content
        const textContent = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        if (textContent.length < 100) {
            console.log(`    ❌ Source has insufficient content (${textContent.length} chars)`);
            return { valid: false, reason: 'Insufficient content' };
        }

        console.log(`    ✅ Page fetched (${textContent.length} chars)`);
        
        // THOROUGH DATE EXTRACTION from the actual page
        let extractedDate = null;
        let dateEvidence = null;
        
        // 1. Check for HTML datetime attributes (most reliable)
        const datetimeMatch = html.match(/<time[^>]*datetime=["']([^"']+)["'][^>]*>/i);
        if (datetimeMatch) {
            const dt = new Date(datetimeMatch[1]);
            if (!isNaN(dt.getTime())) {
                extractedDate = dt.toISOString().split('T')[0];
                dateEvidence = `HTML <time datetime="${datetimeMatch[1]}">`;
                console.log(`    📅 Found datetime attribute: ${extractedDate}`);
            }
        }
        
        // 2. Check meta tags for article dates
        if (!extractedDate) {
            const metaPatterns = [
                /property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
                /content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i,
                /name=["']date["'][^>]*content=["']([^"']+)["']/i,
                /name=["']pubdate["'][^>]*content=["']([^"']+)["']/i,
                /name=["']publish-date["'][^>]*content=["']([^"']+)["']/i,
                /itemprop=["']datePublished["'][^>]*content=["']([^"']+)["']/i,
            ];
            
            for (const pattern of metaPatterns) {
                const match = html.match(pattern);
                if (match) {
                    const dt = new Date(match[1]);
                    if (!isNaN(dt.getTime())) {
                        extractedDate = dt.toISOString().split('T')[0];
                        dateEvidence = `Meta tag: ${match[1]}`;
                        console.log(`    📅 Found meta date: ${extractedDate}`);
                        break;
                    }
                }
            }
        }
        
        // 3. Check JSON-LD structured data
        if (!extractedDate) {
            const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
            if (jsonLdMatch) {
                try {
                    const jsonLd = JSON.parse(jsonLdMatch[1]);
                    const dateFields = ['datePublished', 'dateCreated', 'publishedDate'];
                    for (const field of dateFields) {
                        if (jsonLd[field]) {
                            const dt = new Date(jsonLd[field]);
                            if (!isNaN(dt.getTime())) {
                                extractedDate = dt.toISOString().split('T')[0];
                                dateEvidence = `JSON-LD ${field}: ${jsonLd[field]}`;
                                console.log(`    📅 Found JSON-LD date: ${extractedDate}`);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    // JSON parse failed, continue
                }
            }
        }
        
        // 4. Search text content for date patterns
        if (!extractedDate) {
            const months = 'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
            const textDatePatterns = [
                // "Published: January 15, 2025" or "Posted on January 15, 2025"
                new RegExp(`(?:Published|Posted|Date|Updated|Written)[:\\s]+(?:on\\s+)?(\\d{1,2})\\s+(${months})\\s+(\\d{4})`, 'i'),
                new RegExp(`(?:Published|Posted|Date|Updated|Written)[:\\s]+(?:on\\s+)?(${months})\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i'),
                // "15 January 2025" or "January 15, 2025" standalone
                new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(${months})\\s+(\\d{4})`, 'i'),
                new RegExp(`(${months})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`, 'i'),
                // ISO format in text "2025-01-15"
                /(\d{4})-(\d{2})-(\d{2})/,
                // European format "15/01/2025" or "15.01.2025"
                /(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})/,
            ];
            
            for (const pattern of textDatePatterns) {
                const match = textContent.match(pattern);
                if (match) {
                    let parsedDate = null;
                    const matchStr = match[0];
                    
                    // Try parsing different formats
                    const testDate = new Date(matchStr);
                    if (!isNaN(testDate.getTime()) && testDate.getFullYear() >= 2020) {
                        parsedDate = testDate;
                    }
                    
                    if (parsedDate) {
                        extractedDate = parsedDate.toISOString().split('T')[0];
                        dateEvidence = `Text: "${matchStr}"`;
                        console.log(`    📅 Found text date: ${extractedDate} from "${matchStr}"`);
                        break;
                    }
                }
            }
        }
        
        // 5. Check URL for date patterns
        if (!extractedDate) {
            const urlDateMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
            if (urlDateMatch) {
                extractedDate = `${urlDateMatch[1]}-${urlDateMatch[2]}-${urlDateMatch[3]}`;
                dateEvidence = `URL path: /${urlDateMatch[1]}/${urlDateMatch[2]}/${urlDateMatch[3]}/`;
                console.log(`    📅 Found URL date: ${extractedDate}`);
            } else {
                const urlYearMonth = url.match(/\/(\d{4})\/(\d{2})\//);
                if (urlYearMonth) {
                    extractedDate = `${urlYearMonth[1]}-${urlYearMonth[2]}-15`; // Assume mid-month
                    dateEvidence = `URL path: /${urlYearMonth[1]}/${urlYearMonth[2]}/ (day estimated)`;
                    console.log(`    📅 Found URL year/month: ${extractedDate}`);
                }
            }
        }
        
        // Validate extracted date
        if (extractedDate) {
            const extractedYear = new Date(extractedDate).getFullYear();
            
            // STRICT: Must be 2025 or later
            if (extractedYear < 2025) {
                console.log(`    ❌ Extracted date ${extractedDate} is from ${extractedYear} - TOO OLD`);
                return { 
                    valid: false, 
                    reason: `Article is from ${extractedYear}, not recent enough`,
                    extractedDate,
                    dateEvidence
                };
            }
            
            // Check if within 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const articleDate = new Date(extractedDate);
            
            if (articleDate < thirtyDaysAgo) {
                console.log(`    ❌ Article date ${extractedDate} is older than 30 days`);
                return { 
                    valid: false, 
                    reason: `Article is from ${extractedDate}, more than 30 days old`,
                    extractedDate,
                    dateEvidence
                };
            }
            
            console.log(`    ✅ Date verified: ${extractedDate} (${dateEvidence})`);
            return { 
                valid: true, 
                content: textContent.substring(0, 5000),
                extractedDate,
                dateEvidence
            };
        }
        
        // No date found - be cautious
        console.log(`    ⚠️ Could not extract date from page - checking URL...`);
        
        // Last resort: Check URL for old years
        const urlYearCheck = url.match(/\/(\d{4})\//);
        if (urlYearCheck && parseInt(urlYearCheck[1]) < 2025) {
            console.log(`    ❌ URL contains old year ${urlYearCheck[1]}`);
            return { valid: false, reason: `URL contains old year ${urlYearCheck[1]}` };
        }
        
        // If claimed date is reasonable (2025+), cautiously accept
        if (claimedDate) {
            const claimedYear = new Date(claimedDate).getFullYear();
            if (claimedYear >= 2025) {
                console.log(`    ⚠️ Using LLM claimed date ${claimedDate} - unable to verify from page`);
                return { 
                    valid: true, 
                    content: textContent.substring(0, 5000),
                    extractedDate: claimedDate,
                    dateEvidence: 'Unable to verify from page - using LLM claimed date',
                    uncertain: true
                };
            }
        }
        
        return { valid: false, reason: 'Could not verify publication date' };
        
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
                    
                    // Validate URL format first
                    if (!item.source_url || !(item.source_url.startsWith('http://') || item.source_url.startsWith('https://'))) {
                        console.log(`  ❌ REJECTED: Invalid or missing URL`);
                        continue;
                    }

                    // CRITICAL: Fetch article and extract actual publication date
                    const verification = await verifyAndExtractDate(item.source_url, item.date_published);
                    if (!verification.valid) {
                        console.log(`  ❌ REJECTED: ${verification.reason}`);
                        continue;
                    }
                    
                    // Use the date we extracted from the actual page (not LLM claimed date)
                    const verifiedDate = verification.extractedDate || item.date_published;
                    const verifiedDateEvidence = verification.dateEvidence || item.date_evidence;
                    
                    // If we couldn't verify date and it's uncertain, skip
                    if (verification.uncertain && item.date_confidence !== 'high') {
                        console.log(`  ❌ REJECTED: Could not verify date and LLM confidence is not high`);
                        continue;
                    }

                    // Final year check on verified date
                    const publishedDate = new Date(verifiedDate);
                    const publishedYear = publishedDate.getFullYear();
                    
                    if (publishedYear < 2025) {
                        console.log(`  ❌ REJECTED: Verified date is from ${publishedYear}, must be 2025 or later`);
                        continue;
                    }

                    // Check within 30-day window
                    if (!isWithin30Days(verifiedDate, cutoffDate)) {
                        console.log(`  ❌ REJECTED: Verified date ${verifiedDate} is outside 30-day window`);
                        continue;
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

                    // Create alert with VERIFIED date from actual page
                    const alertData = {
                        company_id: company.id,
                        company_name: company.name,
                        trigger_type: item.trigger_type,
                        headline: item.headline.substring(0, 100),
                        summary: item.summary,
                        source_url: item.source_url,
                        detected_date: verifiedDate, // Use date extracted from page
                        date_evidence: verifiedDateEvidence, // Use evidence from page
                        date_needs_review: verification.uncertain || false,
                        tier: item.tier,
                        priority: item.tier === 'tier_1' ? 'high' : 'medium',
                        status: 'new',
                        email_sent: false,
                        sent_to: [],
                        confidence_score: verification.uncertain ? 80 : 95
                    };

                    const alert = await base44.asServiceRole.entities.Alert.create(alertData);
                    alertsCreated.push(alert);
                    
                    console.log(`  ✅ CREATED: Alert saved with verified date (ID: ${alert.id.substring(0, 8)}...)`);
                    console.log(`  📅 Verified Date: ${verifiedDate} (Year: ${publishedYear})`);
                    console.log(`  📌 Evidence: ${verifiedDateEvidence}`);
                    console.log(`  🔗 Source: ${item.source_url}`);
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