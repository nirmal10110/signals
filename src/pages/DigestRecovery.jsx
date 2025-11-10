import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Mail,
  Send,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { format } from "date-fns";
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

export default function DigestRecoveryPage() {
  const [sendingTo, setSendingTo] = useState(null);
  const [expandedOwner, setExpandedOwner] = useState(null);
  const [alertsByOwner, setAlertsByOwner] = useState({});

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => base44.entities.Alert.list('-created_date'),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  // Process alerts to group by owner
  useEffect(() => {
    // Get alerts from last 7 days that have been sent
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const sentAlerts = alerts.filter(alert => {
      const createdDate = new Date(alert.created_date);
      return (
        alert.status === 'new' &&
        createdDate >= sevenDaysAgo &&
        alert.sent_to &&
        alert.sent_to.length > 0
      );
    });

    // Group by owner
    const grouped = {};
    
    for (const alert of sentAlerts) {
      const sentToEmails = alert.sent_to || [];
      
      for (const ownerEmail of sentToEmails) {
        // Only process volpi emails
        if (!ownerEmail.toLowerCase().endsWith('@volpicapital.com')) continue;

        if (!grouped[ownerEmail]) {
          grouped[ownerEmail] = {
            name: ownerEmail.split('@')[0],
            email: ownerEmail,
            alerts: []
          };
        }

        grouped[ownerEmail].alerts.push(alert);
      }
    }

    // Get proper names from companies
    for (const [ownerEmail, data] of Object.entries(grouped)) {
      for (const company of companies) {
        const owners = company.relationship_owners || [];
        const matchingOwner = owners.find(o => o.email === ownerEmail);
        if (matchingOwner && matchingOwner.name) {
          data.name = matchingOwner.name;
          break;
        }
      }
    }

    setAlertsByOwner(grouped);
  }, [alerts, companies]);

  const handleResendSingle = async (ownerEmail) => {
    setSendingTo(ownerEmail);
    
    try {
      const response = await base44.functions.invoke('resendSingleDigest', {
        owner_email: ownerEmail
      });
      
      if (response.data.success) {
        toast.success(`Digest resent to ${ownerEmail}`);
      } else {
        toast.error('Failed to resend: ' + (response.data.error || 'Unknown error'));
      }
    } catch (error) {
      toast.error('Failed to resend: ' + error.message);
    } finally {
      setSendingTo(null);
    }
  };

  const handleResendAll = async () => {
    setSendingTo('all');
    
    try {
      const response = await base44.functions.invoke('resendRecentDigests');
      const data = response.data;
      
      if (data.success) {
        toast.success(`Successfully resent ${data.digests_resent} digest(s) with ${data.total_alerts_resent} alerts`);
      } else {
        toast.error('Failed to resend: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      toast.error('Failed to resend: ' + error.message);
    } finally {
      setSendingTo(null);
    }
  };

  const ownersList = Object.values(alertsByOwner);

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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Digest Recovery</h1>
            <p className="text-slate-600 mt-1">Review and resend recent digests (last 7 days)</p>
          </div>
          {ownersList.length > 0 && (
            <Button
              onClick={handleResendAll}
              disabled={sendingTo !== null}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {sendingTo === 'all' ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Resend All Digests
                </>
              )}
            </Button>
          )}
        </div>

        <Alert className="bg-blue-50 border-blue-200 mb-6">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            Showing digests sent in the last 7 days. Click on any team member to see their alerts, 
            then use <strong>"Resend to [Name]"</strong> to send them their digest again.
          </AlertDescription>
        </Alert>

        {ownersList.length === 0 ? (
          <Card className="bg-white border-slate-200">
            <CardContent className="p-12 text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-600">No sent digests found in the last 7 days.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {ownersList.map((owner) => {
              const isExpanded = expandedOwner === owner.email;
              const tier1Count = owner.alerts.filter(a => a.tier === 'tier_1').length;
              const tier2Count = owner.alerts.filter(a => a.tier === 'tier_2').length;

              return (
                <Card key={owner.email} className="bg-white border-slate-200">
                  <CardHeader 
                    className="border-b border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedOwner(isExpanded ? null : owner.email)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                          <Mail className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            {owner.name}
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </CardTitle>
                          <p className="text-sm text-slate-500 mt-1">{owner.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <Badge className="bg-slate-100 text-slate-800 border-slate-200">
                            {owner.alerts.length} alert{owner.alerts.length !== 1 ? 's' : ''}
                          </Badge>
                          {tier1Count > 0 && (
                            <Badge className="bg-red-100 text-red-800 border-red-200 ml-2">
                              {tier1Count} Tier 1
                            </Badge>
                          )}
                        </div>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResendSingle(owner.email);
                          }}
                          disabled={sendingTo !== null}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {sendingTo === owner.email ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Resend to {owner.name.split(' ')[0]}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  {isExpanded && (
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        {owner.alerts.map((alert) => (
                          <Card key={alert.id} className="bg-slate-50 border-slate-200">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-2 mb-3">
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
                              </div>
                              
                              <h3 className="text-lg font-bold text-slate-900 mb-2">{alert.company_name}</h3>
                              <p className="text-sm text-slate-700 mb-3">{alert.headline}</p>
                              
                              {alert.summary && (
                                <p className="text-sm text-slate-600 mb-3">{alert.summary}</p>
                              )}

                              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                                <span>📅 Published: {format(new Date(alert.detected_date || alert.created_date), "MMM d, yyyy")}</span>
                                {alert.source_url && (
                                  <a
                                    href={alert.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-emerald-600 hover:text-emerald-800"
                                  >
                                    View Source
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>

                              {alert.actionable_insight && (
                                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                                  <p className="text-xs font-semibold text-emerald-900 mb-1">💡 Actionable Insight</p>
                                  <p className="text-xs text-emerald-800">{alert.actionable_insight}</p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
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