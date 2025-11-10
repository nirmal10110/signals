import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
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
  Filter
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
  const [expandedAlert, setExpandedAlert] = useState(null);
  const [sendingTo, setSendingTo] = useState(null);

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => base44.entities.Alert.list('-created_date'),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  // Get all sent alerts with recipient information
  const sentAlerts = useMemo(() => {
    return alerts
      .filter(alert => alert.sent_to && alert.sent_to.length > 0)
      .map(alert => {
        const company = companies.find(c => c.id === alert.company_id);
        return {
          ...alert,
          company,
          recipients: alert.sent_to || []
        };
      })
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [alerts, companies]);

  // Get unique owners
  const uniqueOwners = useMemo(() => {
    const ownersSet = new Set();
    sentAlerts.forEach(alert => {
      alert.recipients.forEach(email => {
        if (email.toLowerCase().endsWith('@volpicapital.com')) {
          ownersSet.add(email);
        }
      });
    });
    
    const ownersList = Array.from(ownersSet).map(email => {
      // Try to find owner name from companies
      let name = email.split('@')[0];
      for (const company of companies) {
        const owners = company.relationship_owners || [];
        const matchingOwner = owners.find(o => o.email === email);
        if (matchingOwner && matchingOwner.name) {
          name = matchingOwner.name;
          break;
        }
      }
      return { email, name };
    });
    
    return ownersList.sort((a, b) => a.name.localeCompare(b.name));
  }, [sentAlerts, companies]);

  // Filter alerts based on search and filters
  const filteredAlerts = useMemo(() => {
    let filtered = [...sentAlerts];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(alert => 
        alert.company_name?.toLowerCase().includes(query) ||
        alert.headline?.toLowerCase().includes(query) ||
        alert.summary?.toLowerCase().includes(query)
      );
    }

    // Filter by owner
    if (selectedOwner !== "all") {
      filtered = filtered.filter(alert => 
        alert.recipients.includes(selectedOwner)
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
        filtered = filtered.filter(alert => 
          new Date(alert.created_date) >= cutoffDate
        );
      }
    }

    return filtered;
  }, [sentAlerts, searchQuery, selectedOwner, dateRange]);

  // Group alerts by recipient for stats
  const statsByOwner = useMemo(() => {
    const stats = {};
    
    sentAlerts.forEach(alert => {
      alert.recipients.forEach(email => {
        if (!email.toLowerCase().endsWith('@volpicapital.com')) return;
        
        if (!stats[email]) {
          stats[email] = {
            email,
            name: uniqueOwners.find(o => o.email === email)?.name || email.split('@')[0],
            totalAlerts: 0,
            tier1Alerts: 0,
            companies: new Set()
          };
        }
        
        stats[email].totalAlerts++;
        if (alert.tier === 'tier_1') stats[email].tier1Alerts++;
        stats[email].companies.add(alert.company_name);
      });
    });
    
    return Object.values(stats).map(stat => ({
      ...stat,
      companies: stat.companies.size
    }));
  }, [sentAlerts, uniqueOwners]);

  const handleResendAlert = async (alert) => {
    setSendingTo(alert.id);
    
    try {
      // Find the first recipient (primary owner)
      const primaryRecipient = alert.recipients.find(email => 
        email.toLowerCase().endsWith('@volpicapital.com')
      );
      
      if (!primaryRecipient) {
        toast.error('No valid recipient found for this alert');
        return;
      }
      
      const response = await base44.functions.invoke('resendSingleDigest', {
        owner_email: primaryRecipient
      });
      
      if (response.data.success) {
        toast.success(`✅ Digest resent to ${primaryRecipient}`);
      } else {
        toast.error('Failed to resend: ' + (response.data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error resending:', error);
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
          <h1 className="text-3xl font-bold text-slate-900">Digest History</h1>
          <p className="text-slate-600 mt-1">Complete history of all sent digests and alerts</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Sent</p>
                  <p className="text-2xl font-bold text-slate-900">{sentAlerts.length}</p>
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
                  <p className="text-sm text-slate-600">Tier 1 Alerts</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {sentAlerts.filter(a => a.tier === 'tier_1').length}
                  </p>
                </div>
                <Mail className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Last 7 Days</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {sentAlerts.filter(a => {
                      const sevenDaysAgo = new Date();
                      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                      return new Date(a.created_date) >= sevenDaysAgo;
                    }).length}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-purple-500" />
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
                    placeholder="Search by company, headline, or content..."
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
                  {filteredAlerts.length} result{filteredAlerts.length !== 1 ? 's' : ''}
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

        {/* Alerts List */}
        {filteredAlerts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-600">
                {sentAlerts.length === 0 
                  ? 'No digests have been sent yet.'
                  : 'No alerts match your filters.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredAlerts.map((alert) => {
              const isExpanded = expandedAlert === alert.id;
              const ownerName = uniqueOwners.find(o => o.email === alert.recipients[0])?.name || alert.recipients[0];

              return (
                <Card key={alert.id} className="bg-white border-slate-200">
                  <CardHeader 
                    className="border-b border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
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
                        </div>
                        
                        <h3 className="text-lg font-bold text-slate-900 mb-1">
                          {alert.company_name}
                        </h3>
                        <p className="text-sm text-slate-700 mb-2">{alert.headline}</p>
                        
                        <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                          <span>📧 Sent to: {alert.recipients.length} recipient{alert.recipients.length !== 1 ? 's' : ''}</span>
                          <span>📅 {format(new Date(alert.created_date), "MMM d, yyyy 'at' h:mm a")}</span>
                          <span>⏰ {formatDistanceToNow(new Date(alert.created_date), { addSuffix: true })}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResendAlert(alert);
                          }}
                          disabled={sendingTo !== null}
                          size="sm"
                          variant="outline"
                          className="bg-white"
                        >
                          {sendingTo === alert.id ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Resend
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
                      <div className="space-y-4">
                        {/* Recipients */}
                        <div>
                          <p className="text-sm font-semibold text-slate-900 mb-2">📧 Recipients:</p>
                          <div className="flex flex-wrap gap-2">
                            {alert.recipients.map(email => {
                              const owner = uniqueOwners.find(o => o.email === email);
                              return (
                                <Badge key={email} variant="outline" className="bg-emerald-50">
                                  {owner?.name || email}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* Summary */}
                        {alert.summary && (
                          <div>
                            <p className="text-sm font-semibold text-slate-900 mb-2">Summary:</p>
                            <p className="text-sm text-slate-700">{alert.summary}</p>
                          </div>
                        )}
                        
                        {/* Actionable Insight */}
                        {alert.actionable_insight && (
                          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <p className="text-sm font-semibold text-emerald-900 mb-2">💡 Actionable Insight</p>
                            <p className="text-sm text-emerald-800">{alert.actionable_insight}</p>
                          </div>
                        )}
                        
                        {/* Source */}
                        {alert.source_url && (
                          <div>
                            <a
                              href={alert.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-800"
                            >
                              View Source
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        )}
                        
                        {/* Dates */}
                        <div className="pt-4 border-t border-slate-200">
                          <div className="grid grid-cols-2 gap-4 text-xs text-slate-600">
                            <div>
                              <span className="font-semibold">Published:</span>{' '}
                              {format(new Date(alert.detected_date || alert.created_date), "MMM d, yyyy")}
                            </div>
                            <div>
                              <span className="font-semibold">Sent:</span>{' '}
                              {format(new Date(alert.created_date), "MMM d, yyyy 'at' h:mm a")}
                            </div>
                          </div>
                        </div>
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