import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import * as cheerio from 'npm:cheerio@1.0.0-rc.12';

async function scrapeWebsiteNews(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}` };
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const newsItems = [];
        
        // Common news/blog article selectors (prioritized order)
        const articleSelectors = [
            'article',
            '.news-item',
            '.blog-post',
            '.post',
            '.press-release',
            '[class*="news-"]',
            '[class*="blog-"]',
            '[class*="article-"]',
            '[class*="post-"]'
        ];
        
        for (const selector of articleSelectors) {
            $(selector).each((i, elem) => {
                const $elem = $(elem);
                
                // Try to find title
                const title = $elem.find('h1, h2, h3, h4, .title, [class*="title"], [class*="heading"]').first().text().trim();
                
                // Try to find date (multiple methods)
                let dateText = null;
                
                // Method 1: time tag with datetime attribute
                const timeElem = $elem.find('time[datetime]').first();
                if (timeElem.length) {
                    dateText = timeElem.attr('datetime');
                }
                
                // Method 2: common date classes
                if (!dateText) {
                    dateText = $elem.find('.date, .published, .post-date, [class*="date"]').first().text().trim();
                }
                
                // Method 3: meta tags
                if (!dateText) {
                    dateText = $elem.find('meta[property="article:published_time"]').attr('content') ||
                              $elem.find('meta[name="publish-date"]').attr('content');
                }
                
                // Try to find link
                let link = $elem.find('a').first().attr('href');
                if (link && !link.startsWith('http')) {
                    link = new URL(link, url).href;
                }
                
                // Try to find excerpt/summary
                const summary = $elem.find('p, .excerpt, .summary, .description, [class*="excerpt"], [class*="summary"]').first().text().trim();
                
                if (title && title.length > 10) {
                    newsItems.push({
                        title,
                        date: dateText || null,
                        link: link || url,
                        summary: summary ? summary.substring(0, 300) : title,
                        source_type: 'company_website'
                    });
                }
            });
            
            if (newsItems.length > 0) break; // Found articles, stop trying other selectors
        }
        
        return {
            success: true,
            items: newsItems.slice(0, 10),
            source: 'website_scrape'
        };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function scrapeLinkedInPosts(companyUrl, founderUrl) {
    // Note: LinkedIn actively blocks scraping, so this is best-effort
    // For production, use LinkedIn API or third-party services like Proxycurl, RapidAPI
    const posts = [];
    
    try {
        // Try to get company posts via RSS feed (if available)
        // Most companies don't have this, but worth trying
        if (companyUrl) {
            const response = await fetch(companyUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                signal: AbortSignal.timeout(8000)
            });
            
            if (response.ok) {
                const html = await response.text();
                const $ = cheerio.load(html);
                
                // Try to extract recent posts from page structure
                // This is very limited without API access
                $('.feed-shared-update-v2').each((i, elem) => {
                    if (i >= 5) return; // Max 5 posts
                    
                    const $elem = $(elem);
                    const text = $elem.find('.feed-shared-text').text().trim();
                    const time = $elem.find('time').attr('datetime') || $elem.find('.feed-shared-actor__sub-description').text().trim();
                    
                    if (text && text.length > 20) {
                        posts.push({
                            title: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                            summary: text.substring(0, 300),
                            date: time,
                            link: companyUrl,
                            source_type: 'linkedin_company'
                        });
                    }
                });
            }
        }
    } catch (error) {
        console.log('LinkedIn scraping limited:', error.message);
    }
    
    return {
        success: posts.length > 0,
        items: posts,
        source: 'linkedin_scrape',
        note: 'LinkedIn scraping is limited. Consider LinkedIn API or services like Proxycurl for better results.'
    };
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { company_id, company_name, website, linkedin_url, ceo_founder_linkedin_url, careers_url } = await req.json();

        console.log(`\n🔍 Scraping ${company_name} in priority order...`);

        const results = {
            company_id,
            company_name,
            sources: [],
            priority_order: '1. Website → 2. LinkedIn'
        };

        // PRIORITY 1: Scrape company website for news
        if (website) {
            const websiteUrl = website.startsWith('http') ? website : `https://${website}`;
            const newsUrls = [
                `${websiteUrl}/news`,
                `${websiteUrl}/blog`,
                `${websiteUrl}/press`,
                `${websiteUrl}/media`,
                `${websiteUrl}/newsroom`,
                `${websiteUrl}/press-releases`,
                `${websiteUrl}/latest-news`,
                websiteUrl // Also try homepage
            ];
            
            console.log(`  1️⃣ Checking company website...`);
            for (const url of newsUrls) {
                const scraped = await scrapeWebsiteNews(url);
                if (scraped.success && scraped.items.length > 0) {
                    console.log(`     ✅ Found ${scraped.items.length} items at ${url}`);
                    results.sources.push({
                        source_type: 'company_website',
                        url,
                        items: scraped.items,
                        priority: 1
                    });
                    break; // Found news, stop trying other URLs
                }
                await new Promise(r => setTimeout(r, 1000)); // Rate limit
            }
        }

        // PRIORITY 2: Scrape LinkedIn (company + founder)
        console.log(`  2️⃣ Checking LinkedIn...`);
        if (linkedin_url || ceo_founder_linkedin_url) {
            const linkedinData = await scrapeLinkedInPosts(linkedin_url, ceo_founder_linkedin_url);
            if (linkedinData.success && linkedinData.items.length > 0) {
                console.log(`     ✅ Found ${linkedinData.items.length} LinkedIn posts`);
                results.sources.push({
                    source_type: 'linkedin',
                    url: linkedin_url || ceo_founder_linkedin_url,
                    items: linkedinData.items,
                    priority: 2,
                    note: linkedinData.note
                });
            } else {
                console.log(`     ⚠️ LinkedIn scraping limited (consider API)`);
                results.sources.push({
                    source_type: 'linkedin',
                    url: linkedin_url || ceo_founder_linkedin_url,
                    items: [],
                    priority: 2,
                    note: 'LinkedIn scraping is restricted. For production, use LinkedIn API or services like Proxycurl/RapidAPI.'
                });
            }
        }

        // OPTIONAL: Check careers page for job postings
        if (careers_url) {
            console.log(`  3️⃣ Checking careers page...`);
            const careersUrl = careers_url.startsWith('http') ? careers_url : `https://${careers_url}`;
            const scraped = await scrapeWebsiteNews(careersUrl);
            if (scraped.success) {
                console.log(`     ✅ Found ${scraped.items.length} job postings`);
                results.sources.push({
                    source_type: 'careers_page',
                    url: careersUrl,
                    items: scraped.items,
                    priority: 3
                });
            }
        }

        const totalItems = results.sources.reduce((sum, s) => sum + (s.items?.length || 0), 0);
        console.log(`\n  📊 Total items found: ${totalItems}`);

        return Response.json({
            success: true,
            results,
            total_items: totalItems
        });

    } catch (error) {
        console.error('Scrape error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});