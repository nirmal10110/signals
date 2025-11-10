
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ExternalLink, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

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
  other: "Other"
};

export default function RecentAlerts({ alerts, isLoading }) {
  const recentAlerts = alerts.slice(0, 5);

  return (
    <Card className="bg-white shadow-sm border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-bold text-slate-900">Recent Alerts</CardTitle>
          <Link to={createPageUrl("Alerts")}>
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
              View All
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : recentAlerts.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>No alerts yet. Add companies and run monitoring to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentAlerts.map((alert) => (
              <div key={alert.id} className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors duration-200 bg-slate-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {alert.tier === 'tier_1' && (
                        <Badge className="bg-red-100 text-red-800 border-red-200 font-bold text-xs">
                          TIER 1
                        </Badge>
                      )}
                      <Badge className={priorityColors[alert.priority]}>
                        {alert.priority}
                      </Badge>
                      <Badge variant="outline" className="bg-white">
                        {triggerLabels[alert.trigger_type]}
                      </Badge>
                      <Badge className={statusColors[alert.status]}>
                        {alert.status}
                      </Badge>
                    </div>
                    <h4 className="font-semibold text-slate-900 mb-1">{alert.company_name}</h4>
                    <p className="text-sm text-slate-700 mb-2">{alert.headline}</p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(alert.created_date), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  {alert.source_url && (
                    <a
                      href={alert.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                {alert.actionable_insight && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-md">
                    <p className="text-sm text-emerald-900 font-medium">
                      💡 {alert.actionable_insight}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
