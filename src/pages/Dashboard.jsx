import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  Building2, 
  Bell, 
  TrendingUp, 
  Clock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Database
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import StatsCards from "../components/dashboard/StatsCards";
import RecentAlerts from "../components/dashboard/RecentAlerts";
import TopCompanies from "../components/dashboard/TopCompanies";

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => base44.entities.Alert.list('-created_date'),
  });

  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const syncAffinity = async () => {
    setIsSyncing(true);
    try {
      const response = await base44.functions.invoke('syncAffinity');
      toast.success(`Synced ${response.data.synced + response.data.updated} companies from Affinity`);
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    } catch (error) {
      toast.error('Failed to sync Affinity: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const runMonitoring = async () => {
    setIsMonitoring(true);
    try {
      const response = await base44.functions.invoke('monitorCompanies');
      toast.success(`Generated ${response.data.alerts_generated} new alerts`);
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    } catch (error) {
      toast.error('Monitoring failed: ' + error.message);
    } finally {
      setIsMonitoring(false);
    }
  };

  const newAlerts = alerts.filter(a => a.status === 'new');
  const tier1Alerts = alerts.filter(a => a.tier === 'tier_1' && a.status === 'new');
  const activeCompanies = companies.filter(c => c.monitoring_active && c.tier === 'tier_1');

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Volpi Lens</h1>
            <p className="text-slate-600 mt-1">Automated PE Deal Intelligence</p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={syncAffinity}
              disabled={isSyncing}
              variant="outline" 
              className="bg-white"
            >
              {isSyncing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Database className="w-4 h-4 mr-2" />
              )}
              Sync Affinity
            </Button>
            <Button 
              onClick={runMonitoring}
              disabled={isMonitoring}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isMonitoring ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Bell className="w-4 h-4 mr-2" />
              )}
              Run Monitoring
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatsCards
            title="Tier 1 Alerts"
            value={tier1Alerts.length}
            icon={AlertCircle}
            bgColor="bg-red-500"
            trend="Must follow up"
          />
          <StatsCards
            title="All New Alerts"
            value={newAlerts.length}
            icon={Bell}
            bgColor="bg-blue-500"
            trend={`${alerts.filter(a => a.tier === 'tier_2').length} optional`}
          />
          <StatsCards
            title="Active Targets"
            value={activeCompanies.length}
            icon={Building2}
            bgColor="bg-emerald-600"
            trend={`${companies.length} total targets`}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RecentAlerts 
              alerts={alerts}
              isLoading={alertsLoading}
            />
          </div>

          <div className="space-y-6">
            <TopCompanies 
              title="Top Targets"
              companies={companies}
              alerts={alerts}
              isLoading={companiesLoading}
            />
            
            <Card className="bg-gradient-to-br from-emerald-700 to-emerald-800 text-white">
              <CardHeader>
                <CardTitle className="text-lg">Automation Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Daily Monitoring</span>
                  <Badge className="bg-white text-emerald-800">07:30 GMT</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Affinity Sync</span>
                  <Badge className="bg-white text-emerald-800">Enabled</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Follow-up Tracking</span>
                  <Badge className="bg-white text-emerald-800">48hr/5day</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Birthday Reminders</span>
                  <Badge className="bg-white text-emerald-800">Active</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}