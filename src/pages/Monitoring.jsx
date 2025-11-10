import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Clock,
  Trash2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

// Helper function to safely format dates
function safeFormatDate(dateString, formatString = "MMM d, HH:mm") {
  if (!dateString) return 'Never';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return format(date, formatString);
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid date';
  }
}

// Helper function to safely format distance to now
function safeFormatDistanceToNow(dateString) {
  if (!dateString) return 'Never';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.error('Date distance formatting error:', error);
    return 'Invalid date';
  }
}

export default function MonitoringPage() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [alertsGenerated, setAlertsGenerated] = useState(0);
  const [isClearing, setIsClearing] = useState(false);
  const [showCompanyList, setShowCompanyList] = useState(false);
  const [lastCompleteScan, setLastCompleteScan] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const activeCompanies = companies.filter(c => c.monitoring_active && c.tier === 'tier_1');
  
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const companiesMonitoredRecently = activeCompanies.filter(c => {
    if (!c.last_monitored) return false;
    try {
      const lastMonitored = new Date(c.last_monitored);
      if (isNaN(lastMonitored.getTime())) return false;
      return lastMonitored > oneHourAgo;
    } catch {
      return false;
    }
  });
  
  const companiesNeedingMonitoring = activeCompanies.filter(c => {
    if (!c.last_monitored) return true;
    try {
      const lastMonitored = new Date(c.last_monitored);
      if (isNaN(lastMonitored.getTime())) return true;
      return lastMonitored < oneDayAgo;
    } catch {
      return true;
    }
  });

  const clearAllAlerts = async () => {
    if (!confirm('⚠️ Delete ALL alerts? This cannot be undone.')) return;

    setIsClearing(true);
    try {
      const response = await base44.functions.invoke('clearAllAlerts');
      toast.success(response.data.message);
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    } catch (error) {
      toast.error('Failed to clear alerts: ' + error.message);
    } finally {
      setIsClearing(false);
    }
  };

  const runMonitoring = async () => {
    if (activeCompanies.length === 0) {
      toast.error('No active Tier 1 companies to monitor');
      return;
    }

    setIsMonitoring(true);
    setProgress(0);
    setProcessed(0);
    setTotal(activeCompanies.length);
    setAlertsGenerated(0);

    try {
      let hasMore = true;
      let totalAlertsGenerated = 0;
      let batchCount = 0;

      while (hasMore) {
        batchCount++;
        console.log(`Starting batch ${batchCount}...`);
        
        const response = await base44.functions.invoke('monitorCompanies');
        const data = response.data;

        totalAlertsGenerated += data.alerts_generated;

        const totalProcessedSoFar = activeCompanies.length - (data.remaining_companies || 0);
        
        setProcessed(totalProcessedSoFar);
        setAlertsGenerated(totalAlertsGenerated);
        setProgress((totalProcessedSoFar / activeCompanies.length) * 100);

        hasMore = data.has_more;

        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 3000)); 
        }
      }

      setLastCompleteScan(new Date());
      
      toast.success(`✅ Monitoring complete! Generated ${totalAlertsGenerated} alerts from ${activeCompanies.length} companies.`);
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });

    } catch (error) {
      toast.error('Monitoring failed: ' + error.message);
    } finally {
      setIsMonitoring(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Monitoring Center</h1>
          <p className="text-slate-600 mt-1">Run intelligence checks on your target companies</p>
        </div>

        <Card className="mb-6 bg-white border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center justify-between">
              <span>📊 Monitoring Status</span>
              {lastCompleteScan && (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Last scan: {safeFormatDistanceToNow(lastCompleteScan)}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-5 h-5 text-slate-600" />
                  <p className="text-sm font-semibold text-slate-700">Total Targets</p>
                </div>
                <p className="text-2xl font-bold text-slate-900">{activeCompanies.length}</p>
                <p className="text-xs text-slate-500 mt-1">Tier 1 companies</p>
              </div>

              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <p className="text-sm font-semibold text-emerald-700">Monitored (1h)</p>
                </div>
                <p className="text-2xl font-bold text-emerald-900">{companiesMonitoredRecently.length}</p>
                <p className="text-xs text-emerald-600 mt-1">In last hour</p>
              </div>

              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <p className="text-sm font-semibold text-amber-700">Need Monitoring</p>
                </div>
                <p className="text-2xl font-bold text-amber-900">{companiesNeedingMonitoring.length}</p>
                <p className="text-xs text-amber-600 mt-1">Not checked in 24h</p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setShowCompanyList(!showCompanyList)}
              className="w-full bg-white mb-4"
            >
              {showCompanyList ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" />
                  Hide Company Details
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  Show All Companies & Last Monitored Times
                </>
              )}
            </Button>

            {showCompanyList && (
              <div className="space-y-2 max-h-96 overflow-y-auto border border-slate-200 rounded-lg p-4 bg-slate-50">
                {activeCompanies.map((company) => {
                  let lastMonitored = null;
                  let isRecent = false;
                  let needsMonitoring = true;
                  
                  if (company.last_monitored) {
                    try {
                      lastMonitored = new Date(company.last_monitored);
                      if (!isNaN(lastMonitored.getTime())) {
                        isRecent = lastMonitored > oneHourAgo;
                        needsMonitoring = lastMonitored < oneDayAgo;
                      } else {
                        lastMonitored = null;
                      }
                    } catch {
                      lastMonitored = null;
                    }
                  }

                  return (
                    <div key={company.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                      <div className="flex items-center gap-3 flex-1">
                        {isRecent ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        ) : needsMonitoring ? (
                          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        )}
                        <span className="font-medium text-slate-900">{company.name}</span>
                      </div>
                      <div className="text-right">
                        {lastMonitored ? (
                          <>
                            <p className="text-xs font-semibold text-slate-700">
                              {safeFormatDistanceToNow(company.last_monitored)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {safeFormatDate(company.last_monitored)}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-amber-600 font-semibold">
                            Never monitored
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6 bg-white border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-xl font-bold text-slate-900">
              📰 News Monitoring
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {isMonitoring && (
                <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold text-blue-900">
                        Monitoring in progress...
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Processed: {processed} / {total} companies • {alertsGenerated} alerts generated
                      </p>
                    </div>
                    <span className="text-sm font-bold text-blue-900">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={runMonitoring}
                  disabled={isMonitoring || activeCompanies.length === 0}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base font-semibold"
                >
                  {isMonitoring ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Monitoring...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5 mr-2" />
                      🚀 Start Monitoring
                    </>
                  )}
                </Button>

                <Button
                  onClick={clearAllAlerts}
                  disabled={isClearing || isMonitoring}
                  variant="outline"
                  className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                >
                  {isClearing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear All
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-blue-900">
            <div className="space-y-3">
              <div>
                <p className="font-semibold mb-2">What we look for:</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li>C-suite hires (CEO, CFO, COO, CTO, CMO, CRO)</li>
                  <li>Board appointments or new investors</li>
                  <li>Acquisitions (company buying or being bought)</li>
                  <li>International expansion (new country/region)</li>
                  <li>Funding rounds (Seed, Series A-D+, growth equity)</li>
                  <li>Major awards or industry certifications</li>
                  <li>Company milestones/anniversaries (5, 10, 15, 20+ years)</li>
                  <li>Major client wins (Fortune 500, enterprise deals)</li>
                  <li>New product launches or major features</li>
                  <li>Strategic partnerships</li>
                  <li>New office openings</li>
                  <li>Speaking engagements at major industry events</li>
                  <li>Thought leadership (whitepapers, research)</li>
                </ul>
              </div>
              
              <div>
                <p className="font-semibold mb-2">Sources (in priority order):</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li>Company website pages: /news, /press, /media, /blog, /insights, /stories, /updates, /careers</li>
                  <li>Company LinkedIn page and Founder LinkedIn posts</li>
                  <li>Reputable industry publications and major news outlets</li>
                </ul>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}