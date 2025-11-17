
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  Send, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronUp,
  Trash2,
  CheckSquare,
  Square,
  X
} from "lucide-react";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

const priorityColors = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-blue-100 text-blue-800 border-blue-200"
};

const statusColors = {
  new: "bg-emerald-100 text-emerald-800 border-emerald-200",
  reviewed: "bg-blue-100 text-blue-800 border-blue-200",
  actioned: "bg-purple-100 text-purple-800 border-purple-200",
  dismissed: "bg-slate-100 text-slate-800 border-slate-200"
};

const triggerLabels = {
  cfo_hiring: "CFO Hiring",
  ceo_hiring: "CEO Hiring",
  board_member_hired: "Board Member",
  head_of_sales_hiring: "Head of Sales",
  head_of_delivery_hiring: "Head of Delivery",
  executive_hiring: "Executive Hiring",
  acquisition_announced: "Acquisition",
  international_expansion: "Intl Expansion",
  new_office_opened: "New Office",
  job_posting_leadership: "Leadership Job Post",
  industry_award: "Industry Award",
  event_attendance: "Event",
  culture_initiative: "Culture",
  funding_round: "Funding Round",
  new_product_launch: "Product Launch",
  partnership: "Partnership",
  financial_results: "Financial Results",
  leadership_change: "Leadership Change", 
  expansion: "Expansion", 
  award_recognition: "Award", 
  other: "Other"
};

function formatAlertDate(dateString) {
  if (!dateString) return 'Date unknown';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Date unknown';
    return format(date, "MMM d, yyyy");
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Date unknown';
  }
}

function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function areSimilarHeadlines(headline1, headline2) {
  const norm1 = normalizeText(headline1);
  const norm2 = normalizeText(headline2);
  
  if (norm1 === norm2) return true;
  
  if (norm1.length > 20 && norm2.length > 20) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  }
  
  const words1 = norm1.split(' ');
  const words2 = norm2.split(' ');
  const commonWords = words1.filter(w => words2.includes(w) && w.length > 3);
  const similarity = (commonWords.length * 2) / (words1.length + words2.length);
  
  return similarity > 0.8;
}

export default function DigestsPage() {
  const [expandedOwners, setExpandedOwners] = useState(new Set());
  const [isSending, setIsSending] = useState(false);
  const [sendingOwner, setSendingOwner] = useState(null);
  const [discardingOwner, setDiscardingOwner] = useState(null);
  const [discardingAlert, setDiscardingAlert] = useState(null);
  const [sendResults, setSendResults] = useState(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterResults, setFilterResults] = useState(null);
  const [selectedAlerts, setSelectedAlerts] = useState({});
  const [isBulkDiscarding, setIsBulkDiscarding] = useState(false);
  const [showFilterSuggestions, setShowFilterSuggestions] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState(new Set());
  const [isDismissingSuggestions, setIsDismissingSuggestions] = useState(false);
  
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => base44.entities.Alert.list('-created_date'),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const isAdmin = currentUser?.role === 'admin';

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  
  const fortyFiveDaysAgo = new Date();
  fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
  fortyFiveDaysAgo.setHours(0, 0, 0, 0);
  
  const newAlerts = alerts.filter(alert => {
    if (alert.status !== 'new') return false;
    
    const alertCreatedDate = new Date(alert.created_date);
    if (isNaN(alertCreatedDate.getTime()) || alertCreatedDate < thirtyDaysAgo) {
      return false;
    }
    
    if (alert.detected_date) {
      const detectedDate = new Date(alert.detected_date);
      if (!isNaN(detectedDate.getTime())) {
        const detectedYear = detectedDate.getFullYear();
        
        if (detectedYear <= 2024) {
          return false;
        }
        
        if (detectedDate < fortyFiveDaysAgo) {
          return false;
        }
      }
    }
    
    if (alert.source_url) {
      const urlYearMatch = alert.source_url.match(/\/(\d{4})\//);
      if (urlYearMatch) {
        const urlYear = parseInt(urlYearMatch[1]);
        if (urlYear < 2025) {
          return false;
        }
      }
    }
    
    if (alert.date_evidence) {
      const evidence = alert.date_evidence.toLowerCase();
      if (evidence.includes('2024') || evidence.includes('2023') || evidence.includes('2022')) {
        return false;
      }
    }
    
    return true;
  });

  const handleCleanupDuplicates = async () => {
    if (!confirm('🧹 This will scan all alerts and remove duplicates based on source URL or highly similar headlines. Continue?')) return;
    
    setIsCleaning(true);
    try {
      const response = await base44.functions.invoke('cleanupDuplicateAlerts');
      const data = response.data;
      
      toast.success(`Cleaned up ${data.duplicates_deleted} duplicate alerts`);
      
      if (data.details && data.details.length > 0) {
        console.log('📋 Duplicates removed:', data.details);
      }
      
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    } catch (error) {
      toast.error('Cleanup failed: ' + error.message);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleFilterLowQuality = async () => {
    if (!confirm('🔍 This will fetch and verify source URLs, then suggest low-quality alerts for dismissal.\n\nThis may take 30-60 seconds depending on alert count. Continue?')) return;
    
    setIsFiltering(true);
    setFilterResults(null);
    setSelectedSuggestions(new Set());
    
    const processingToast = toast.loading('Fetching and analyzing source URLs... This may take up to 60 seconds.');
    
    try {
      const response = await base44.functions.invoke('filterLowQualityAlerts');
      const data = response.data;
      
      toast.dismiss(processingToast);
      
      setFilterResults(data);
      setShowFilterSuggestions(true);
      
      if (data.note) {
        toast.info(data.note);
      }
      
      toast.success(`Reviewed ${data.total_reviewed} alerts with source verification: ${data.total_suggestions} suggested discards (${data.execution_time})`);
    } catch (error) {
      toast.dismiss(processingToast);
      toast.error('Filter failed: ' + error.message);
    } finally {
      setIsFiltering(false);
    }
  };

  const toggleSuggestionSelection = (alertId) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(alertId)) {
        newSet.delete(alertId);
      } else {
        newSet.add(alertId);
      }
      return newSet;
    });
  };

  const selectAllSuggestionsInGroup = (suggestions) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set(prev);
      suggestions.forEach(s => newSet.add(s.alert_id));
      return newSet;
    });
  };

  const deselectAllSuggestionsInGroup = (suggestions) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set(prev);
      suggestions.forEach(s => newSet.delete(s.alert_id));
      return newSet;
    });
  };

  const handleDismissSuggestions = async () => {
    if (selectedSuggestions.size === 0) {
      toast.error('No suggestions selected');
      return;
    }

    if (!confirm(`⚠️ Dismiss ${selectedSuggestions.size} selected alert${selectedSuggestions.size !== 1 ? 's' : ''}?\n\nThey will be permanently marked as dismissed.`)) {
      return;
    }

    setIsDismissingSuggestions(true);
    
    try {
      let dismissedCount = 0;
      for (const alertId of selectedSuggestions) {
        const alertToDismiss = alerts.find(a => a.id === alertId);
        const existingFeedback = alertToDismiss?.feedback_notes || '';
        
        await base44.entities.Alert.update(alertId, {
          status: 'dismissed',
          feedback_notes: existingFeedback + (existingFeedback ? '\n' : '') + 'Auto-dismissed via quality filter suggestion'
        });
        dismissedCount++;
      }

      toast.success(`Dismissed ${dismissedCount} alerts`);
      setShowFilterSuggestions(false);
      setFilterResults(null);
      setSelectedSuggestions(new Set());
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    } catch (error) {
      toast.error(`Failed to dismiss alerts: ${error.message}`);
    } finally {
      setIsDismissingSuggestions(false);
    }
  };

  const toggleAlertSelection = (ownerEmail, alertId) => {
    setSelectedAlerts(prev => {
      const ownerSelections = new Set(prev[ownerEmail] || []);
      
      if (ownerSelections.has(alertId)) {
        ownerSelections.delete(alertId);
      } else {
        ownerSelections.add(alertId);
      }
      
      return {
        ...prev,
        [ownerEmail]: ownerSelections
      };
    });
  };

  const toggleAllAlertsForOwner = (ownerEmail, alertIds) => {
    setSelectedAlerts(prev => {
      const ownerSelections = new Set(prev[ownerEmail] || []);
      const allSelected = alertIds.every(id => ownerSelections.has(id));
      
      if (allSelected) {
        return {
          ...prev,
          [ownerEmail]: new Set()
        };
      } else {
        return {
          ...prev,
          [ownerEmail]: new Set(alertIds)
        };
      }
    });
  };

  const handleBulkDiscard = async (ownerEmail) => {
    const selected = selectedAlerts[ownerEmail];
    if (!selected || selected.size === 0) {
      toast.error('No alerts selected');
      return;
    }

    if (!confirm(`⚠️ Discard ${selected.size} selected alert${selected.size !== 1 ? 's' : ''} for ${ownerEmail}?\n\nThey will be marked as discarded and won't appear in future digests.`)) {
      return;
    }

    setIsBulkDiscarding(true);
    
    try {
      const response = await base44.functions.invoke('bulkDiscardAlerts', { 
        alert_ids: Array.from(selected),
        owner_email: ownerEmail 
      });
      toast.success(`Discarded ${response.data.alerts_processed} alerts`);
      
      setSelectedAlerts(prev => ({
        ...prev,
        [ownerEmail]: new Set()
      }));
      
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    } catch (error) {
      toast.error(`Failed to discard alerts: ${error.message}`);
    } finally {
      setIsBulkDiscarding(false);
    }
  };

  const handleDiscardDigest = async (ownerEmail) => {
    if (!confirm(`⚠️ Discard digest for ${ownerEmail}?\n\nThis will mark all alerts as discarded. These alerts will not appear in future digests.`)) {
      return;
    }

    setDiscardingOwner(ownerEmail);
    
    try {
      const response = await base44.functions.invoke('discardDigest', { 
        owner_email: ownerEmail 
      });
      toast.success(`Discarded ${response.data.alerts_discarded} alerts for ${ownerEmail}`);
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    } catch (error) {
      toast.error(`Failed to discard digest: ${error.message}`);
    } finally {
      setDiscardingOwner(null);
    }
  };

  const handleDiscardSingleAlert = async (alertId, ownerEmail) => {
    if (!confirm(`⚠️ Remove this alert from ${ownerEmail}'s digest?\n\nThis alert will not appear in future digests for this owner.`)) {
      return;
    }

    setDiscardingAlert(alertId);
    
    try {
      const response = await base44.functions.invoke('discardSingleAlert', { 
        alert_id: alertId,
        owner_email: ownerEmail 
      });
      toast.success(`Alert discarded`);
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    } catch (error) {
      toast.error(`Failed to discard alert: ${error.message}`);
    } finally {
      setDiscardingAlert(null);
    }
  };

  const alertsByOwnerRaw = {};

  for (const alert of newAlerts) {
    const company = companies.find(c => c.id === alert.company_id);
    if (!company) continue;

    const owners = company.relationship_owners || [];
    for (const owner of owners) {
      if (!owner.email) continue;
      
      // Skip if already sent to this owner
      if (alert.sent_to && alert.sent_to.includes(owner.email)) {
        continue;
      }
      
      // Skip if already discarded for this owner
      if (alert.discarded_for && alert.discarded_for.includes(owner.email)) {
        continue;
      }
      
      if (!alertsByOwnerRaw[owner.email]) {
        alertsByOwnerRaw[owner.email] = {
          name: owner.name || owner.email.split('@')[0],
          email: owner.email,
          alerts: []
        };
      }
      alertsByOwnerRaw[owner.email].alerts.push(alert);
    }
  }

  const alertsByOwner = {};
  const verificationData = {};
  
  for (const email in alertsByOwnerRaw) {
    const ownerData = alertsByOwnerRaw[email];
    const uniqueAlerts = [];
    const seenAlertIds = new Set();
    const seenUrls = new Set();
    const seenUrlDomains = new Set();
    const seenHeadlines = [];
    const duplicatesRemoved = [];
    
    for (const alert of ownerData.alerts) {
      let duplicateReason = null;
      
      if (seenAlertIds.has(alert.id)) {
        duplicateReason = 'Duplicate Alert ID';
      }
      else if (alert.source_url && seenUrls.has(alert.source_url)) {
        duplicateReason = 'Duplicate Source URL';
      }
      else if (alert.source_url) {
        try {
          const url = new URL(alert.source_url);
          const domainPath = `${url.hostname}${url.pathname}`;
          if (seenUrlDomains.has(domainPath)) {
            duplicateReason = 'Duplicate URL Path';
          } else {
            seenUrlDomains.add(domainPath);
          }
        } catch (e) {
          // Invalid URL, continue
        }
      }
      if (!duplicateReason && seenHeadlines.some(h => areSimilarHeadlines(h, alert.headline))) {
        duplicateReason = 'Similar Headline (80%+ match)';
      }
      
      if (duplicateReason) {
        duplicatesRemoved.push({ alert, reason: duplicateReason });
        continue;
      }
      
      uniqueAlerts.push(alert);
      seenAlertIds.add(alert.id);
      if (alert.source_url) seenUrls.add(alert.source_url);
      seenHeadlines.push(alert.headline);
    }
    
    uniqueAlerts.sort((a, b) => {
      if (a.tier === 'tier_1' && b.tier !== 'tier_1') return -1;
      if (a.tier !== 'tier_1' && b.tier === 'tier_1') return 1;
      
      const dateA = new Date(a.detected_date || a.created_date);
      const dateB = new Date(b.detected_date || b.created_date);
      return dateB.getTime() - dateA.getTime();
    });
    
    alertsByOwner[email] = { 
      ...ownerData, 
      alerts: uniqueAlerts
    };
    
    verificationData[email] = {
      name: ownerData.name,
      email: email,
      totalBefore: ownerData.alerts.length,
      totalAfter: uniqueAlerts.length,
      duplicatesRemoved: duplicatesRemoved.length,
      removedAlerts: duplicatesRemoved
    };
  }

  const ownersList = Object.values(alertsByOwner);
  const verificationList = Object.values(verificationData);

  const toggleOwner = (email) => {
    const newExpanded = new Set(expandedOwners);
    if (newExpanded.has(email)) {
      newExpanded.delete(email);
    } else {
      newExpanded.add(email);
    }
    setExpandedOwners(newExpanded);
  };

  const handleSendDigests = async () => {
    setIsSending(true);
    setSendResults(null);
    
    try {
      const response = await base44.functions.invoke('dailyDigest');
      setSendResults(response.data);
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    } catch (error) {
      setSendResults({
        success: false,
        error: error.message
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendSingleDigest = async (ownerEmail) => {
    setSendingOwner(ownerEmail);
    
    try {
      const response = await base44.functions.invoke('sendSingleDigest', { 
        owner_email: ownerEmail 
      });
      toast.success(`Digest sent to ${ownerEmail}`);
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    } catch (error) {
      toast.error(`Failed to send digest: ${error.message}`);
    } finally {
      setSendingOwner(null);
    }
  };

  const copyDraftEmail = (email) => {
    navigator.clipboard.writeText(email);
    toast.success('Draft email copied to clipboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Daily Digests</h1>
            <p className="text-slate-600 mt-1">Preview and send daily intelligence reports</p>
          </div>
          <div className="flex gap-3">
            {isAdmin && (
              <>
                <Button
                  onClick={() => setShowVerification(!showVerification)}
                  variant="outline"
                  className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                >
                  {showVerification ? 'Hide' : 'Show'} Verification Report
                </Button>
                <Button
                  onClick={handleFilterLowQuality}
                  disabled={isFiltering || isSending}
                  variant="outline"
                  className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                >
                  {isFiltering ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Filtering...
                    </>
                  ) : (
                    <>
                      🔍 Filter Low Quality
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleCleanupDuplicates}
                  disabled={isCleaning || isSending}
                  variant="outline"
                  className="bg-white"
                >
                  {isCleaning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cleaning...
                    </>
                  ) : (
                    <>
                      🧹 Clean Duplicates
                    </>
                  )}
                </Button>
              </>
            )}
            <Button
              onClick={handleSendDigests}
              disabled={isSending || ownersList.length === 0}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send All Digests
                </>
              )}
            </Button>
          </div>
        </div>

        {sendResults && (
          <Alert className={sendResults.success ? "bg-emerald-50 border-emerald-200 mb-6" : "bg-red-50 border-red-200 mb-6"}>
            {sendResults.success ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={sendResults.success ? "text-emerald-900" : "text-red-900"}>
              {sendResults.success 
                ? `Successfully sent ${sendResults.digests_sent} digest${sendResults.digests_sent !== 1 ? 's' : ''} to Volpi owners.`
                : `Failed to send digests: ${sendResults.error}`
              }
            </AlertDescription>
          </Alert>
        )}

        {isAdmin && showFilterSuggestions && filterResults && filterResults.total_suggestions > 0 && (
          <Card className="bg-white border-slate-300 mb-6 shadow-lg">
            <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-purple-50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900">
                    🔍 Quality Filter Suggestions
                  </CardTitle>
                  <p className="text-sm text-slate-600 mt-1">
                    Review {filterResults.total_suggestions} suggested discards • {selectedSuggestions.size} selected
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedSuggestions.size > 0 && (
                    <Button
                      onClick={handleDismissSuggestions}
                      disabled={isDismissingSuggestions}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {isDismissingSuggestions ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Dismissing...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Dismiss Selected ({selectedSuggestions.size})
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowFilterSuggestions(false)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 max-h-[600px] overflow-y-auto">
              {filterResults.suggestions.high.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-red-900 flex items-center gap-2">
                      <Badge className="bg-red-100 text-red-800 border-red-200">
                        HIGH CONFIDENCE ({filterResults.suggestions.high.length})
                      </Badge>
                      Strong recommendation to discard
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => selectAllSuggestionsInGroup(filterResults.suggestions.high)}
                      >
                        Select All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deselectAllSuggestionsInGroup(filterResults.suggestions.high)}
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {filterResults.suggestions.high.map((suggestion) => (
                      <Card key={suggestion.alert_id} className={`border-2 transition-all ${selectedSuggestions.has(suggestion.alert_id) ? 'bg-red-50 border-red-300' : 'bg-white border-red-200'}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => toggleSuggestionSelection(suggestion.alert_id)}
                              className="mt-1"
                            >
                              {selectedSuggestions.has(suggestion.alert_id) ? (
                                <CheckSquare className="w-5 h-5 text-red-600" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-400" />
                              )}
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="bg-white">
                                  {triggerLabels[suggestion.trigger_type]}
                                </Badge>
                                {suggestion.tier === 'tier_1' && (
                                  <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                                    TIER 1
                                  </Badge>
                                )}
                              </div>
                              <h4 className="font-bold text-slate-900">{suggestion.company}</h4>
                              <p className="text-sm text-slate-700 mt-1">{suggestion.headline}</p>
                              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                                <p className="text-xs text-red-900">
                                  <span className="font-semibold">Why dismiss:</span> {suggestion.reason}
                                </p>
                              </div>
                              {suggestion.source_url && (
                                <a
                                  href={suggestion.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 mt-2 inline-flex items-center gap-1"
                                >
                                  View Source <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {filterResults.suggestions.medium.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                        MEDIUM CONFIDENCE ({filterResults.suggestions.medium.length})
                      </Badge>
                      Consider discarding
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => selectAllSuggestionsInGroup(filterResults.suggestions.medium)}
                      >
                        Select All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deselectAllSuggestionsInGroup(filterResults.suggestions.medium)}
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {filterResults.suggestions.medium.map((suggestion) => (
                      <Card key={suggestion.alert_id} className={`border-2 transition-all ${selectedSuggestions.has(suggestion.alert_id) ? 'bg-amber-50 border-amber-300' : 'bg-white border-amber-200'}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => toggleSuggestionSelection(suggestion.alert_id)}
                              className="mt-1"
                            >
                              {selectedSuggestions.has(suggestion.alert_id) ? (
                                <CheckSquare className="w-5 h-5 text-amber-600" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-400" />
                              )}
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="bg-white">
                                  {triggerLabels[suggestion.trigger_type]}
                                </Badge>
                                {suggestion.tier === 'tier_1' && (
                                  <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                                    TIER 1
                                  </Badge>
                                )}
                              </div>
                              <h4 className="font-bold text-slate-900">{suggestion.company}</h4>
                              <p className="text-sm text-slate-700 mt-1">{suggestion.headline}</p>
                              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
                                <p className="text-xs text-amber-900">
                                  <span className="font-semibold">Why dismiss:</span> {suggestion.reason}
                                </p>
                              </div>
                              {suggestion.source_url && (
                                <a
                                  href={suggestion.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 mt-2 inline-flex items-center gap-1"
                                >
                                  View Source <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {filterResults.suggestions.low.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                      <Badge className="bg-slate-100 text-slate-800 border-slate-200">
                        LOW CONFIDENCE ({filterResults.suggestions.low.length})
                      </Badge>
                      Review carefully
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => selectAllSuggestionsInGroup(filterResults.suggestions.low)}
                      >
                        Select All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deselectAllSuggestionsInGroup(filterResults.suggestions.low)}
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {filterResults.suggestions.low.map((suggestion) => (
                      <Card key={suggestion.alert_id} className={`border-2 transition-all ${selectedSuggestions.has(suggestion.alert_id) ? 'bg-slate-50 border-slate-300' : 'bg-white border-slate-200'}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => toggleSuggestionSelection(suggestion.alert_id)}
                              className="mt-1"
                            >
                              {selectedSuggestions.has(suggestion.alert_id) ? (
                                <CheckSquare className="w-5 h-5 text-slate-600" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-400" />
                              )}
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className="bg-white">
                                  {triggerLabels[suggestion.trigger_type]}
                                </Badge>
                                {suggestion.tier === 'tier_1' && (
                                  <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                                    TIER 1
                                  </Badge>
                                )}
                              </div>
                              <h4 className="font-bold text-slate-900">{suggestion.company}</h4>
                              <p className="text-sm text-slate-700 mt-1">{suggestion.headline}</p>
                              <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded">
                                <p className="text-xs text-slate-700">
                                  <span className="font-semibold">Why dismiss:</span> {suggestion.reason}
                                </p>
                              </div>
                              {suggestion.source_url && (
                                <a
                                  href={suggestion.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:text-blue-800 mt-2 inline-flex items-center gap-1"
                                >
                                  View Source <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isAdmin && showVerification && (
          <Card className="bg-purple-50 border-purple-200 mb-6">
            <CardHeader className="border-b border-purple-200">
              <CardTitle className="text-xl font-bold text-purple-900">
                🔍 Digest Verification Report
              </CardTitle>
              <p className="text-sm text-purple-700 mt-2">
                Aggressive filtering applied: Only alerts from 2025, within 45 days, no duplicate URLs/headlines.
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <div className="mb-4 p-3 bg-purple-100 border border-purple-300 rounded-lg">
                <p className="text-sm font-semibold text-purple-900">
                  📊 Filtering Summary
                </p>
                <ul className="text-xs text-purple-800 mt-2 space-y-1">
                  <li>✅ Only showing alerts created in last 30 days</li>
                  <li>✅ Only showing alerts detected in last 45 days</li>
                  <li>✅ Rejecting any alerts from 2024 or earlier</li>
                  <li>✅ Checking URL paths for old year patterns (/2023/, /2024/)</li>
                  <li>✅ Checking date evidence for old year mentions</li>
                  <li>✅ Removing duplicate URLs and similar headlines</li>
                </ul>
              </div>
              
              <div className="space-y-4">
                {verificationList.length > 0 ? (
                  verificationList.map((owner) => (
                    <Card key={owner.email} className="bg-white border-purple-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-bold text-slate-900">{owner.name}</p>
                            <p className="text-sm text-slate-600">{owner.email}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-emerald-600">{owner.totalAfter}</p>
                            <p className="text-xs text-slate-500">unique alerts</p>
                          </div>
                        </div>
                        
                        {owner.duplicatesRemoved > 0 && (
                          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-sm font-semibold text-amber-900 mb-2">
                              ⚠️ Removed {owner.duplicatesRemoved} duplicate{owner.duplicatesRemoved !== 1 ? 's' : ''}:
                            </p>
                            <div className="space-y-2">
                              {owner.removedAlerts.map((item, idx) => (
                                <div key={idx} className="text-xs text-amber-800 bg-amber-100 p-2 rounded">
                                  <p className="font-semibold">{item.alert.company_name}: {item.alert.headline}</p>
                                  <p className="text-amber-600 mt-1">Reason: {item.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {owner.duplicatesRemoved === 0 && (
                          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <p className="text-sm text-emerald-800">
                              ✅ No duplicates found - all {owner.totalAfter} alerts are unique
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-center text-purple-700 py-4">
                    No pending digests to verify.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 mb-6">
          <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-600 rounded-lg">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">Digest Date</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {format(new Date(), 'EEEE, do MMMM yyyy')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-600">Unsent Alerts</p>
                  <p className="text-2xl font-bold text-slate-900">{newAlerts.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {ownersList.length === 0 ? (
          <Card className="bg-white border-slate-200">
            <CardContent className="p-12 text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-600">No new unsent alerts in the last 30 days.</p>
              <p className="text-sm text-slate-500 mt-2">All alerts have been sent or filtered out (old dates, duplicates, etc.).</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {ownersList.map((ownerData) => {
              const isExpanded = expandedOwners.has(ownerData.email);
              const ownerSelections = selectedAlerts[ownerData.email] || new Set();
              const hasSelections = ownerSelections.size > 0;
              const allSelected = ownerData.alerts.length > 0 && ownerData.alerts.every(alert => ownerSelections.has(alert.id));
              
              return (
                <Card key={ownerData.email} className="bg-white border-slate-200">
                  <CardHeader 
                    className="border-b border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => toggleOwner(ownerData.email)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          {ownerData.name}
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </CardTitle>
                        <p className="text-sm text-slate-500 mt-1">{ownerData.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                          {ownerData.alerts.length} unsent alert{ownerData.alerts.length !== 1 ? 's' : ''}
                        </Badge>
                        {hasSelections && (
                          <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                            {ownerSelections.size} selected
                          </Badge>
                        )}
                        {isAdmin && hasSelections && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBulkDiscard(ownerData.email);
                            }}
                            disabled={isBulkDiscarding || isSending}
                            size="sm"
                            variant="outline"
                            className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                          >
                            {isBulkDiscarding ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Discarding...
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Discard Selected ({ownerSelections.size})
                              </>
                            )}
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDiscardDigest(ownerData.email);
                            }}
                            disabled={discardingOwner === ownerData.email || isSending}
                            size="sm"
                            variant="outline"
                            className="bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                          >
                            {discardingOwner === ownerData.email ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Discarding...
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Discard All
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendSingleDigest(ownerData.email);
                          }}
                          disabled={sendingOwner === ownerData.email || isSending}
                          size="sm"
                          className="bg-slate-900 hover:bg-slate-800 text-white"
                        >
                          {sendingOwner === ownerData.email ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Send Digest
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  {isExpanded && (
                    <CardContent className="p-6">
                      {isAdmin && (
                        <div className="mb-4 flex items-center gap-3 pb-4 border-b border-slate-200">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleAllAlertsForOwner(ownerData.email, ownerData.alerts.map(a => a.id))}
                            className="bg-white"
                          >
                            {allSelected ? (
                              <>
                                <CheckSquare className="w-4 h-4 mr-2" />
                                Deselect All
                              </>
                            ) : (
                              <>
                                <Square className="w-4 h-4 mr-2" />
                                Select All
                              </>
                            )}
                          </Button>
                          {hasSelections && (
                            <span className="text-sm text-slate-600">
                              {ownerSelections.size} of {ownerData.alerts.length} selected
                            </span>
                          )}
                        </div>
                      )}
                      
                      <div className="space-y-4">
                        {ownerData.alerts.map((alert) => {
                          const isSelected = ownerSelections.has(alert.id);
                          
                          return (
                            <Card key={alert.id} className={`border-slate-200 transition-all ${isSelected ? 'bg-purple-50 border-purple-300' : 'bg-slate-50'}`}>
                              <CardContent className="p-6">
                                <div className="flex items-start gap-4">
                                  {isAdmin && (
                                    <button
                                      onClick={() => toggleAlertSelection(ownerData.email, alert.id)}
                                      className="mt-1 text-slate-400 hover:text-purple-600 transition-colors"
                                    >
                                      {isSelected ? (
                                        <CheckSquare className="w-5 h-5 text-purple-600" />
                                      ) : (
                                        <Square className="w-5 h-5" />
                                      )}
                                    </button>
                                  )}
                                  
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                                      {alert.tier === 'tier_1' && (
                                        <Badge className="bg-red-100 text-red-800 border-red-200 font-bold">
                                          TIER 1 - MUST FOLLOW UP
                                        </Badge>
                                      )}
                                      <Badge className={priorityColors[alert.priority]}>
                                        {alert.priority.toUpperCase()}
                                      </Badge>
                                      <Badge variant="outline" className="bg-white">
                                        {triggerLabels[alert.trigger_type]}
                                      </Badge>
                                      <Badge className={statusColors[alert.status]}>
                                        {alert.status}
                                      </Badge>
                                      {alert.confidence_score && (
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                          {alert.confidence_score}% confidence
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    <h3 className="text-xl font-bold text-slate-900 mb-2">{alert.company_name}</h3>
                                    <p className="text-lg text-slate-700 mb-3">{alert.headline}</p>
                                    
                                    {alert.summary && (
                                      <p className="text-sm text-slate-600 mb-3">{alert.summary}</p>
                                    )}

                                    <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap mb-2">
                                      <span>📅 {formatAlertDate(alert.detected_date || alert.created_date)}</span>
                                      {alert.source_url && (
                                        <a
                                          href={alert.source_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                                        >
                                          View Source
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>

                                    {alert.date_evidence && (
                                      <div className="text-xs text-slate-500 italic mb-3 p-2 bg-slate-100 rounded border border-slate-200">
                                        <span className="font-semibold">Date source:</span> {alert.date_evidence}
                                      </div>
                                    )}

                                    {alert.actionable_insight && (
                                      <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                                        <p className="text-sm font-semibold text-emerald-900 mb-1">💡 Actionable Insight</p>
                                        <p className="text-sm text-emerald-800">{alert.actionable_insight}</p>
                                      </div>
                                    )}

                                    {alert.draft_email && (
                                      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                        <div className="flex justify-between items-center mb-2">
                                          <p className="text-sm font-semibold text-blue-900">📧 Draft Email (UK English)</p>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => copyDraftEmail(alert.draft_email)}
                                            className="text-blue-700 hover:text-blue-900"
                                          >
                                            <Copy className="w-4 h-4 mr-1" />
                                            Copy
                                          </Button>
                                        </div>
                                        <pre className="text-sm text-blue-800 whitespace-pre-wrap font-sans">
                                          {alert.draft_email}
                                        </pre>
                                      </div>
                                    )}

                                    {alert.volpi_content && alert.volpi_content.length > 0 && (
                                      <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                                        <p className="text-sm font-semibold text-purple-900 mb-2">📚 Relevant Volpi Content</p>
                                        <div className="space-y-1">
                                          {alert.volpi_content.map((url, idx) => (
                                            <a
                                              key={idx}
                                              href={url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-2 text-sm text-purple-700 hover:text-purple-900"
                                            >
                                              <ExternalLink className="w-3 h-3" />
                                              {url}
                                            </a>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDiscardSingleAlert(alert.id, ownerData.email);
                                    }}
                                    disabled={discardingAlert === alert.id}
                                    size="sm"
                                    variant="ghost"
                                    className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                  >
                                    {discardingAlert === alert.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
