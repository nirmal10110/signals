
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  Filter,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Eye,
  Copy,
  ExternalLink as LinkIcon // Renamed to avoid conflict with existing ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner"; // Added toast import

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

export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all"); // New state for tier filter
  
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => base44.entities.Alert.list('-created_date'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Alert.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Alert status updated'); // Added toast notification
    },
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async ({ alertId, feedback, notes }) => {
      return base44.functions.invoke('submitAlertFeedback', { 
        alert_id: alertId, 
        feedback, 
        notes 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Feedback submitted');
    },
  });

  const handleStatusChange = (alertId, newStatus) => {
    updateStatusMutation.mutate({ id: alertId, status: newStatus });
  };

  const handleFeedback = (alertId, feedback) => {
    submitFeedbackMutation.mutate({ alertId, feedback, notes: '' });
  };

  // New function to copy draft email to clipboard
  const copyDraftEmail = (email) => {
    navigator.clipboard.writeText(email);
    toast.success('Draft email copied to clipboard');
  };

  const filteredAlerts = alerts.filter(alert => {
    const statusMatch = statusFilter === "all" || alert.status === statusFilter;
    const priorityMatch = priorityFilter === "all" || alert.priority === priorityFilter;
    const tierMatch = tierFilter === "all" || alert.tier === tierFilter; // Added tier filter
    return statusMatch && priorityMatch && tierMatch;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Alerts</h1>
            <p className="text-slate-600 mt-1">Review and action intelligence alerts</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Filters:</span>
          </div>
          
          {/* New Select component for Tier Filter */}
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-40 bg-white">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="tier_1">Tier 1 (Must Follow Up)</SelectItem>
              <SelectItem value="tier_2">Tier 2 (Optional)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="actioned">Actioned</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-40 bg-white">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <Card key={alert.id} className="bg-white border-slate-200 hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {/* Conditional TIER 1 Badge */}
                      {alert.tier === 'tier_1' && (
                        <Badge className="bg-red-100 text-red-800 border-red-200 font-bold">
                          TIER 1 - MUST FOLLOW UP
                        </Badge>
                      )}
                      <Badge className={priorityColors[alert.priority]}>
                        {alert.priority.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="bg-slate-50">
                        {triggerLabels[alert.trigger_type]}
                      </Badge>
                      <Badge className={statusColors[alert.status]}>
                        {alert.status}
                      </Badge>
                      {/* Conditional Confidence Score Badge */}
                      {alert.confidence_score && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {alert.confidence_score}% confidence
                        </Badge>
                      )}
                      {alert.date_needs_review && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
                          ⚠️ Date Uncertain
                        </Badge>
                      )}
                      {alert.user_feedback && (
                        <Badge variant="outline" className={
                          alert.user_feedback === 'helpful' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                          alert.user_feedback === 'false_positive' ? 'bg-red-50 text-red-800 border-red-300' :
                          'bg-amber-50 text-amber-800 border-amber-300'
                        }>
                          {alert.user_feedback === 'helpful' ? '👍 Helpful' :
                           alert.user_feedback === 'false_positive' ? '❌ False Positive' :
                           '👎 Not Helpful'}
                        </Badge>
                      )}
                    </div>
                    
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{alert.company_name}</h3>
                    <p className="text-lg text-slate-700 mb-3">{alert.headline}</p>
                    
                    {alert.summary && (
                      <p className="text-sm text-slate-600 mb-3">{alert.summary}</p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                      <span>📅 Published: {format(new Date(alert.detected_date || alert.created_date), "MMM d, yyyy")}</span>
                      <span>🔍 Detected: {format(new Date(alert.created_date), "MMM d, yyyy 'at' h:mm a")}</span>
                      {alert.date_evidence && (
                        <span className="text-xs bg-slate-100 px-2 py-1 rounded">
                          Source: {alert.date_evidence}
                        </span>
                      )}
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
                  </div>
                </div>

                {alert.actionable_insight && (
                  <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-sm font-semibold text-emerald-900 mb-1">💡 Actionable Insight</p>
                    <p className="text-sm text-emerald-800">{alert.actionable_insight}</p>
                  </div>
                )}

                {/* Conditional Draft Email Section */}
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

                {/* Conditional Volpi Content Section */}
                {alert.volpi_content && alert.volpi_content.length > 0 && (
                  <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
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
                          <LinkIcon className="w-3 h-3" /> {/* Using the aliased LinkIcon */}
                          {url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange(alert.id, 'reviewed')}
                    disabled={alert.status === 'reviewed'}
                    className="bg-white"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Mark Reviewed
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange(alert.id, 'actioned')}
                    disabled={alert.status === 'actioned'}
                    className="bg-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark Actioned
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange(alert.id, 'dismissed')}
                    disabled={alert.status === 'dismissed'}
                    className="bg-white"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Dismiss
                  </Button>
                  
                  {!alert.user_feedback && (
                    <>
                      <div className="ml-auto flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleFeedback(alert.id, 'helpful')}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                        >
                          👍 Helpful
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleFeedback(alert.id, 'not_helpful')}
                          className="bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
                        >
                          👎 Not Helpful
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleFeedback(alert.id, 'false_positive')}
                          className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                        >
                          ❌ False Positive
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredAlerts.length === 0 && (
            <div className="text-center py-12 text-slate-500 bg-white rounded-lg border border-slate-200">
              <Bell className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No alerts found matching your filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
