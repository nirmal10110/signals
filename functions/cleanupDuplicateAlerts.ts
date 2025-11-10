import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Helper function to normalize text for comparison
function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

// Check if two headlines are similar (fuzzy match)
function areSimilarHeadlines(headline1, headline2) {
  const norm1 = normalizeText(headline1);
  const norm2 = normalizeText(headline2);
  
  // Exact match after normalization
  if (norm1 === norm2) return true;
  
  // Check if one contains the other (for variations)
  if (norm1.length > 20 && norm2.length > 20) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  }
  
  // Check similarity ratio (at least 80% similar)
  const words1 = norm1.split(' ');
  const words2 = norm2.split(' ');
  const commonWords = words1.filter(w => words2.includes(w) && w.length > 3);
  const similarity = (commonWords.length * 2) / (words1.length + words2.length);
  
  return similarity > 0.8;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('🧹 Starting duplicate cleanup...');

        // Get all alerts
        const allAlerts = await base44.asServiceRole.entities.Alert.list();
        
        console.log(`📊 Total alerts in system: ${allAlerts.length}`);

        // Track duplicates to delete
        const toDelete = [];
        const seen = {
            ids: new Set(),
            urls: new Map(), // url -> first alert
            headlines: [] // array of {alert, headline}
        };

        // Sort by created_date (oldest first) - we keep the oldest, delete newer duplicates
        const sortedAlerts = allAlerts.sort((a, b) => 
            new Date(a.created_date).getTime() - new Date(b.created_date).getTime()
        );

        for (const alert of sortedAlerts) {
            let isDuplicate = false;
            let reason = '';

            // Check for duplicate URL
            if (alert.source_url && seen.urls.has(alert.source_url)) {
                isDuplicate = true;
                reason = `Duplicate URL (original: ${seen.urls.get(alert.source_url).id.substring(0, 8)})`;
            }
            // Check for similar headline within same company
            else if (alert.headline) {
                const similarAlert = seen.headlines.find(item => 
                    item.alert.company_id === alert.company_id && 
                    areSimilarHeadlines(item.headline, alert.headline)
                );
                
                if (similarAlert) {
                    isDuplicate = true;
                    reason = `Similar headline to ${similarAlert.alert.id.substring(0, 8)}`;
                }
            }

            if (isDuplicate) {
                toDelete.push({
                    id: alert.id,
                    company_name: alert.company_name,
                    headline: alert.headline,
                    source_url: alert.source_url,
                    reason
                });
                console.log(`🔄 Found duplicate: ${alert.company_name} - "${alert.headline}" (${reason})`);
            } else {
                // This is a unique alert, track it
                seen.ids.add(alert.id);
                if (alert.source_url) {
                    seen.urls.set(alert.source_url, alert);
                }
                if (alert.headline) {
                    seen.headlines.push({ alert, headline: alert.headline });
                }
            }
        }

        console.log(`\n📋 Found ${toDelete.length} duplicate alerts to delete`);

        // Delete duplicates
        let deletedCount = 0;
        for (const item of toDelete) {
            try {
                await base44.asServiceRole.entities.Alert.delete(item.id);
                deletedCount++;
                console.log(`✓ Deleted: ${item.company_name} - "${item.headline.substring(0, 50)}..."`);
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.error(`❌ Failed to delete ${item.id}:`, error.message);
            }
        }

        const summary = {
            success: true,
            total_alerts: allAlerts.length,
            duplicates_found: toDelete.length,
            duplicates_deleted: deletedCount,
            remaining_alerts: allAlerts.length - deletedCount,
            details: toDelete.map(d => ({
                company: d.company_name,
                headline: d.headline.substring(0, 60) + '...',
                reason: d.reason
            }))
        };

        console.log(`\n✅ Cleanup complete!`);
        console.log(`   - Total alerts: ${summary.total_alerts}`);
        console.log(`   - Duplicates deleted: ${summary.duplicates_deleted}`);
        console.log(`   - Remaining alerts: ${summary.remaining_alerts}`);

        return Response.json(summary);

    } catch (error) {
        console.error('❌ Cleanup error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});