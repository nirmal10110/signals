import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function TopCompanies({ companies, alerts, isLoading }) {
  const companiesWithAlerts = companies.map(company => ({
    ...company,
    alertCount: alerts.filter(a => a.company_id === company.id).length
  })).sort((a, b) => b.alertCount - a.alertCount).slice(0, 5);

  return (
    <Card className="bg-white shadow-sm border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <CardTitle className="text-xl font-bold text-slate-900">Top Monitored Companies</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {companiesWithAlerts.map((company, index) => (
              <div key={company.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    ['bg-blue-100', 'bg-emerald-100', 'bg-purple-100', 'bg-amber-100', 'bg-pink-100'][index]
                  }`}>
                    <Building2 className={`w-5 h-5 ${
                      ['text-blue-600', 'text-emerald-600', 'text-purple-600', 'text-amber-600', 'text-pink-600'][index]
                    }`} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{company.name}</p>
                    <p className="text-xs text-slate-500">{company.industry || 'No industry'}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                  {company.alertCount} alerts
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}