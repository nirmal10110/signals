
import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  RefreshCw, 
  Send,
  Search,
  Calendar,
  Mail,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Trash2,
  CheckSquare,
  Square,
  Loader2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const triggerLabels = {
  company_milestone: "Company Milestone",
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
  event_participation: "Event",
  culture_initiative: "Culture",
  funding_round: "Funding Round",
  new_product_launch: "Product Launch",
  partnership: "Partnership",
  financial_results: "Financial Results",
  customer_success: "Customer Success",
  thought_leadership: "Thought Leadership",
  leadership_change: "Leadership Change",
  expansion: "Expansion",
  award_recognition: "Award",
  other: "Other"
};

const priorityColors = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-blue-100 text-blue-800 border-blue-200"
};

export default function DigestHistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOwner, setSelectedOwner] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [expandedDigest, setExpandedDigest] = useState(null);
  const [sendingTo, setSendingTo] = useState(null);
  const [selectedAlerts, setSelectedAlerts] = useState({});
  const [isBulkDiscarding, setIsBulkDiscarding] = useState(false);
  const [discardingAlert, setDiscardingAlert] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => base44.entities.Alert.list('-created_date'),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  // Get all owners lookup
  const ownersLookup = useMemo(() => {
    const lookup = {};
    companies.forEach(company => {
      const owners = company.relationship_owners || [];
      owners.forEach(owner => {
        if (owner.email && !lookup[owner.email]) {
          lookup[owner.email] = owner.name || owner.email.split('@')[0];
        }
      });
    });
    return lookup;
  }, [companies]);

  // Group alerts into digest sends (by recipient + created_date)
  const digestSends = useMemo(() => {
    // Get all alerts that have been sent
    const sentAlerts = alerts.filter(alert => alert.sent_to && alert.sent_to.length > 0);
    
    // Build a map of digest sends
    const digestMap = new Map();
    
    sentAlerts.forEach(alert => {
      alert.sent_to.forEach(recipientEmail => {
        if (!recipientEmail.toLowerCase().endsWith('@volpicapital.com')) return;
        
        // Create a key based on recipient + date (group alerts sent on same day)
        const alertDate = new Date(alert.created_date);
        const dateKey = `${alertDate.getFullYear()}-${alertDate.getMonth()}-${alertDate.getDate()}`;
        const digestKey = `${recipientEmail}|${dateKey}`;
        
        if (!digestMap.has(digestKey)) {
          digestMap.set(digestKey, {
            id: digestKey,
            recipientEmail,
            recipientName: ownersLookup[recipientEmail] || recipientEmail.split('@')[0],
            sendDate: alert.created_date,
            batchDate: alert.created_date, // Store for passing to resend function
            alerts: [],
            totalAlerts: 0,
            tier1Count: 0,
            tier2Count: 0,
            dismissedCount: 0
          });
        }
        
        const digest = digestMap.get(digestKey);
        
        // Add alert to digest
        digest.alerts.push({
          ...alert,
          company: companies.find(c => c.id === alert.company_id)
        });
        
        digest.totalAlerts++;
        if (alert.tier === 'tier_1') digest.tier1Count++;
        if (alert.tier === 'tier_2') digest.tier2Count++;
        if (alert.status === 'dismissed') digest.dismissedCount++;
        
        // Update send date to latest alert's created date
        if (new Date(alert.created_date) > new Date(digest.sendDate)) {
          digest.sendDate = alert.created_date;
        }
      });
    });
    
    // Convert to array and sort by send date (newest first)
    return Array.from(digestMap.values())
      .sort((a, b) => new Date(b.sendDate) - new Date(a.sendDate));
  }, [alerts, companies, ownersLookup]);

  // Get unique owners
  const uniqueOwners = useMemo(() => {
    const ownersSet = new Set();
    digestSends.forEach(digest => {
      ownersSet.add(digest.recipientEmail);
    });
    
    return Array.from(ownersSet)
      .map(email => ({
        email,
        name: ownersLookup[email] || email.split('@')[0]
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [digestSends, ownersLookup]);

  // Filter digests based on search and filters
  const filteredDigests = useMemo(() => {
    let filtered = [...digestSends];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(digest => 
        digest.recipientName.toLowerCase().includes(query) ||
        digest.recipientEmail.toLowerCase().includes(query) ||
        digest.alerts.some(alert => 
          alert.company_name?.toLowerCase().includes(query) ||
          alert.headline?.toLowerCase().includes(query) ||
          alert.summary?.toLowerCase().includes(query)
        )
      );
    }

    // Filter by owner
    if (selectedOwner !== "all") {
      filtered = filtered.filter(digest => 
        digest.recipientEmail === selectedOwner
      );
    }

    // Filter by date range
    if (dateRange !== "all") {
      const now = new Date();
      let cutoffDate;
      
      switch (dateRange) {
        case "7days":
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30days":
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "90days":
          cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = null;
      }
      
      if (cutoffDate) {
        filtered = filtered.filter(digest => 
          new Date(digest.sendDate) >= cutoffDate
        );
      }
    }

    return filtered;
  }, [digestSends, searchQuery, selectedOwner, dateRange]);

  const toggleAlertSelection = (digestId, alertId) => {
    setSelectedAlerts(prev => {
      const digestSelections = new Set(prev[digestId] || []);
      
      if (digestSelections.has(alertId)) {
        digestSelections.delete(alertId);
      } else {
        digestSelections.add(alertId);
      }
      
      return {
        ...prev,
        [digestId]: digestSelections
      };
    });
  };

  const toggleAllAlertsForDigest = (digestId, alertIds) => {
    setSelectedAlerts(prev => {
      const digestSelections = new Set(prev[digestId] || []);
      const allSelected = alertIds.every(id => digestSelections.has(id));
      
      if (allSelected) {
        return {
          ...prev,
          [digestId]: new Set()
        };
      } else {
        return {
          ...prev,
          [digestId]: new Set(alertIds)
        };
      }
    });
  };

  const handleBulkDiscard = async (digest) => {
    const selected = selectedAlerts[digest.id];
    if (!selected || selected.size === 0) {
      toast.error('No alerts selected');
      return;
    }

    if (!confirm(`⚠️ Remove ${selected.size} selected alert${selected.size !== 1 ? 's' : ''} from ${digest.recipientName}'s sent digest?\n\nThis will remove them from sent_to so they won't appear in digest history.`)) {
      return;
    }

    setIsBulkDiscarding(true);
    
    try {
      // Remove owner from sent_to for each selected alert
      for (const alertId of selected) {
        const alert = alerts.find(a => a.id === alertId);
        if (!alert) continue;

        const currentSentTo = alert.sent_to || [];
        const updatedSentTo = currentSentTo.filter(email => email !== digest.recipientEmail);

        await base44.entities.Alert.update(alertId, {
          sent_to: updatedSentTo
        });
      }

      toast.success(`Removed ${selected.size} alerts from digest history`);
      
      setSelectedAlerts(prev => ({
        ...prev,
        [digest.id]: new Set()
      }));
      
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    } catch (error) {
      toast.error(`Failed to remove alerts: ${error.message}`);
    } finally {
      setIsBulkDiscarding(false);
    }
  };

  const handleDiscardSingleAlert = async (alertId, digest) => {
    if (!confirm(`⚠️ Remove this alert from ${digest.recipientName}'s sent digest?\n\nIt will no longer appear in their digest history.`)) {
      return;
    }

    setDiscardingAlert(alertId);
    
    try {
      const alert = alerts.find(a => a.id === alertId);
      if (!alert) {
        toast.error('Alert not found');
        return;
      }

      const currentSentTo = alert.sent_to || [];
      const updatedSentTo = currentSentTo.filter(email => email !== digest.recipientEmail);

      await base44.entities.Alert.update(alertId, {
        sent_to: updatedSentTo
      });

      toast.success(`Alert removed from digest history`);
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    } catch (error) {
      toast.error(`Failed to remove alert: ${error.message}`);
    } finally {
      setDiscardingAlert(null);
    }
  };

  const handleResendDigest = async (digest) => {
    // Filter out any selected alerts before resending
    const selected = selectedAlerts[digest.id] || new Set();
    
    if (selected.size > 0) {
      if (!confirm(`⚠️ You have ${selected.size} alert${selected.size !== 1 ? 's' : ''} selected.\n\nDo you want to remove them before resending?\n\n• Click OK to remove selected alerts first\n• Click Cancel to resend everything (ignore selection)`)) {
        // User chose to ignore selection and resend everything
      } else {
        // Remove selected alerts first
        await handleBulkDiscard(digest);
        // Wait a moment for the updates to propagate
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setSendingTo(digest.id);
    
    try {
      console.log('🔄 Resending specific digest batch to:', digest.recipientEmail, 'from date:', digest.batchDate);
      const response = await base44.functions.invoke('resendSingleDigest', {
        owner_email: digest.recipientEmail,
        batch_date: digest.batchDate // Pass the specific batch date
      });
      
      if (response.data.success) {
        toast.success(`✅ Digest resent to ${digest.recipientName} (${response.data.alerts_sent} alerts)`);
      } else {
        toast.error('Failed to resend: ' + (response.data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error resending digest:', error);
      toast.error('Failed to resend: ' + error.message);
    } finally {
      setSendingTo(null);
    }
  };

  if (alertsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">📬 Digest Email Repository</h1>
          <p className="text-slate-600 mt-1">Complete history of all digest emails sent to your team</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Digests</p>
                  <p className="text-2xl font-bold text-slate-900">{digestSends.length}</p>
                </div>
                <Mail className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Recipients</p>
                  <p className="text-2xl font-bold text-slate-900">{uniqueOwners.length}</p>
                </div>
                <Mail className="w-8 h-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Alerts</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {digestSends.reduce((sum, d) => sum + d.totalAlerts, 0)}
                  </p>
                </div>
                <Mail className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Last 7 Days</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {digestSends.filter(d => {
                      const sevenDaysAgo = new Date();
                      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                      return new Date(d.sendDate) >= sevenDaysAgo;
                    }).length}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by recipient, company, or alert content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={selectedOwner} onValueChange={setSelectedOwner}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="All Recipients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Recipients</SelectItem>
                  {uniqueOwners.map(owner => (
                    <SelectItem key={owner.email} value={owner.email}>
                      {owner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="90days">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {(searchQuery || selectedOwner !== "all" || dateRange !== "all") && (
              <div className="mt-4 flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-50">
                  {filteredDigests.length} digest{filteredDigests.length !== 1 ? 's' : ''}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedOwner("all");
                    setDateRange("all");
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Digests List */}
        {filteredDigests.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-600">
                {digestSends.length === 0 
                  ? 'No digests have been sent yet.'
                  : 'No digests match your filters.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredDigests.map((digest) => {
              const isExpanded = expandedDigest === digest.id;
              const digestSelections = selectedAlerts[digest.id] || new Set();
              const hasSelections = digestSelections.size > 0;
              const allSelected = digest.alerts.length > 0 && digest.alerts.every(alert => digestSelections.has(alert.id));

              return (
                <Card key={digest.id} className="bg-white border-slate-200">
                  <CardHeader 
                    className="border-b border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedDigest(isExpanded ? null : digest.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                          <Mail className="w-6 h-6 text-emerald-600" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-bold text-slate-900">
                              {digest.recipientName}
                            </h3>
                            <Badge variant="outline" className="bg-blue-50">
                              {digest.recipientEmail}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                              {digest.totalAlerts} alert{digest.totalAlerts !== 1 ? 's' : ''}
                            </Badge>
                            {digest.tier1Count > 0 && (
                              <Badge className="bg-red-100 text-red-800 border-red-200">
                                {digest.tier1Count} Tier 1
                              </Badge>
                            )}
                            {digest.tier2Count > 0 && (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                                {digest.tier2Count} Tier 2
                              </Badge>
                            )}
                            {digest.dismissedCount > 0 && (
                              <Badge variant="outline" className="bg-slate-100">
                                <Trash2 className="w-3 h-3 mr-1" />
                                {digest.dismissedCount} dismissed
                              </Badge>
                            )}
                            {hasSelections && (
                              <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                                {digestSelections.size} selected
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span>📅 Sent: {format(new Date(digest.sendDate), "MMM d, yyyy 'at' h:mm a")}</span>
                            <span>⏰ {formatDistanceToNow(new Date(digest.sendDate), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {hasSelections && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBulkDiscard(digest);
                            }}
                            disabled={isBulkDiscarding || sendingTo !== null}
                            size="sm"
                            variant="outline"
                            className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                          >
                            {isBulkDiscarding ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Removing...
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Remove Selected ({digestSelections.size})
                              </>
                            )}
                          </Button>
                        )}
                        
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResendDigest(digest);
                          }}
                          disabled={sendingTo !== null}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {sendingTo === digest.id ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Resending...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Resend Digest
                            </>
                          )}
                        </Button>
                        
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  {isExpanded && (
                    <CardContent className="p-6">
                      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm font-semibold text-blue-900 mb-2">📧 Digest Email Details</p>
                        <div className="text-sm text-blue-800 space-y-1">
                          <p><strong>Subject:</strong> Your Volpi Lens Digest — {format(new Date(digest.sendDate), "do MMMM yyyy")}</p>
                          <p><strong>To:</strong> {digest.recipientEmail}</p>
                          <p><strong>Sent:</strong> {format(new Date(digest.sendDate), "EEEE, MMMM d, yyyy 'at' h:mm a")}</p>
                          <p><strong>Total Alerts:</strong> {digest.totalAlerts} ({digest.tier1Count} must follow-up, {digest.tier2Count} optional)</p>
                          {digest.dismissedCount > 0 && (
                            <p className="text-amber-700"><strong>Note:</strong> {digest.dismissedCount} alert{digest.dismissedCount !== 1 ? 's were' : ' was'} later dismissed (still visible in history)</p>
                          )}
                        </div>
                      </div>

                      <div className="mb-4 flex items-center gap-3 pb-4 border-b border-slate-200">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleAllAlertsForDigest(digest.id, digest.alerts.map(a => a.id))}
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
                            {digestSelections.size} of {digest.alerts.length} selected
                          </span>
                        )}
                      </div>
                      
                      <h4 className="text-sm font-semibold text-slate-900 mb-3">📋 Alerts in This Digest:</h4>
                      <div className="space-y-3">
                        {digest.alerts
                          .sort((a, b) => {
                            if (a.tier === 'tier_1' && b.tier !== 'tier_1') return -1;
                            if (a.tier !== 'tier_1' && b.tier === 'tier_1') return 1;
                            return 0;
                          })
                          .map((alert) => {
                            const isSelected = digestSelections.has(alert.id);
                            
                            return (
                              <Card key={alert.id} className={`border-slate-200 transition-all ${isSelected ? 'bg-purple-50 border-purple-300' : 'bg-slate-50'}`}>
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-4">
                                    <button
                                      onClick={() => toggleAlertSelection(digest.id, alert.id)}
                                      className="mt-1 text-slate-400 hover:text-purple-600 transition-colors"
                                    >
                                      {isSelected ? (
                                        <CheckSquare className="w-5 h-5 text-purple-600" />
                                      ) : (
                                        <Square className="w-5 h-5" />
                                      )}
                                    </button>
                                    
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        {alert.tier === 'tier_1' && (
                                          <Badge className="bg-red-100 text-red-800 border-red-200 font-bold">
                                            TIER 1
                                          </Badge>
                                        )}
                                        <Badge className={priorityColors[alert.priority]}>
                                          {alert.priority?.toUpperCase()}
                                        </Badge>
                                        <Badge variant="outline" className="bg-white">
                                          {triggerLabels[alert.trigger_type]}
                                        </Badge>
                                        {alert.status === 'dismissed' && (
                                          <Badge variant="outline" className="bg-slate-100 text-slate-600">
                                            <Trash2 className="w-3 h-3 mr-1" />
                                            Dismissed
                                          </Badge>
                                        )}
                                      </div>
                                      
                                      <h5 className="text-md font-bold text-slate-900 mb-1">{alert.company_name}</h5>
                                      <p className="text-sm text-slate-700 mb-2">{alert.headline}</p>
                                      
                                      {alert.summary && (
                                        <p className="text-xs text-slate-600 mb-2">{alert.summary}</p>
                                      )}

                                      {alert.actionable_insight && (
                                        <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded">
                                          <p className="text-xs font-semibold text-emerald-900">💡 Actionable Insight</p>
                                          <p className="text-xs text-emerald-800 mt-1">{alert.actionable_insight}</p>
                                        </div>
                                      )}
                                      
                                      <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                                        <span>📅 {format(new Date(alert.detected_date || alert.created_date), "MMM d, yyyy")}</span>
                                        {alert.source_url && (
                                          <a
                                            href={alert.source_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-emerald-600 hover:text-emerald-800"
                                          >
                                            Source
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <Button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDiscardSingleAlert(alert.id, digest);
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
