import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

export default function MonitoringProgress({ progress, currentCompany }) {
  return (
    <Card className="mb-6 bg-white border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Monitoring in Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-medium text-slate-700">
                Currently checking: <span className="font-bold">{currentCompany}</span>
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {Math.round(progress)}%
              </p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          <p className="text-sm text-slate-600">
            Scanning web sources for recent news, executive changes, and business developments...
          </p>
        </div>
      </CardContent>
    </Card>
  );
}