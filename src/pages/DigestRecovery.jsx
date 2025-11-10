import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Mail
} from "lucide-react";
import { toast } from "sonner";

export default function DigestRecoveryPage() {
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryResults, setRecoveryResults] = useState(null);

  const handleRecovery = async () => {
    setIsRecovering(true);
    setRecoveryResults(null);
    
    try {
      const response = await base44.functions.invoke('resendRecentDigests');
      const data = response.data;
      
      setRecoveryResults(data);
      
      if (data.success) {
        toast.success(`Successfully resent ${data.digests_resent} digest(s) with ${data.total_alerts_resent} alerts`);
      } else {
        toast.error('Recovery failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      toast.error('Recovery failed: ' + error.message);
      setRecoveryResults({
        success: false,
        error: error.message
      });
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Digest Recovery</h1>
          <p className="text-slate-600 mt-1">Resend recent digests that were sent in the last 7 days</p>
        </div>

        <Card className="bg-white border-slate-200 mb-6">
          <CardHeader className="border-b border-slate-200">
            <CardTitle className="text-xl font-bold text-slate-900">
              Recovery Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Alert className="bg-blue-50 border-blue-200 mb-6">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                This will resend all digests that were sent in the last 7 days to each team member. 
                Emails will be marked with <strong>[RESENT]</strong> in the subject line.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900">What will be resent?</p>
                  <p className="text-sm text-slate-600 mt-1">
                    All alerts from the last 7 days that were already sent (marked in the <code>sent_to</code> field) 
                    will be resent to the respective team members.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900">Safe to use</p>
                  <p className="text-sm text-slate-600 mt-1">
                    This does not modify any alert records or sent_to fields. It simply resends the emails.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <Button
                onClick={handleRecovery}
                disabled={isRecovering}
                className="bg-emerald-600 hover:bg-emerald-700 text-white w-full md:w-auto"
                size="lg"
              >
                {isRecovering ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Recovering and Resending...
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5 mr-2" />
                    Resend Recent Digests
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {recoveryResults && (
          <Card className={`border-2 ${recoveryResults.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <CardHeader className={`border-b ${recoveryResults.success ? 'border-emerald-200' : 'border-red-200'}`}>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                {recoveryResults.success ? (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    <span className="text-emerald-900">Recovery Complete</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-6 h-6 text-red-600" />
                    <span className="text-red-900">Recovery Failed</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {recoveryResults.success ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-lg border border-emerald-200">
                      <p className="text-sm font-medium text-slate-600">Digests Resent</p>
                      <p className="text-3xl font-bold text-emerald-600">{recoveryResults.digests_resent}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-emerald-200">
                      <p className="text-sm font-medium text-slate-600">Total Alerts</p>
                      <p className="text-3xl font-bold text-emerald-600">{recoveryResults.total_alerts_resent}</p>
                    </div>
                  </div>

                  {recoveryResults.recipients && recoveryResults.recipients.length > 0 && (
                    <div className="bg-white p-4 rounded-lg border border-emerald-200">
                      <p className="text-sm font-semibold text-slate-900 mb-2">Recipients:</p>
                      <ul className="space-y-1">
                        {recoveryResults.recipients.map((email, idx) => (
                          <li key={idx} className="text-sm text-slate-700 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            {email}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {recoveryResults.results && recoveryResults.results.length > 0 && (
                    <div className="bg-white p-4 rounded-lg border border-emerald-200">
                      <p className="text-sm font-semibold text-slate-900 mb-2">Details:</p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {recoveryResults.results.map((result, idx) => (
                          <div key={idx} className="text-sm p-2 bg-emerald-50 rounded border border-emerald-100">
                            <p className="font-medium text-slate-900">{result.owner}</p>
                            <p className="text-slate-600">
                              {result.status === 'resent' 
                                ? `✅ Resent ${result.alerts_resent} alert${result.alerts_resent !== 1 ? 's' : ''}`
                                : `❌ Failed: ${result.error}`
                              }
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Alert className="bg-red-100 border-red-300">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-900">
                    <strong>Error:</strong> {recoveryResults.error || 'Unknown error occurred'}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}