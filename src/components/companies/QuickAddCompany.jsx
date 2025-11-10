import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  X, 
  Sparkles, 
  Loader2, 
  Globe,
  CheckCircle2,
  AlertCircle,
  Info
} from "lucide-react";

export default function QuickAddCompany({ onSubmit, onCancel, isLoading }) {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const extractCompanyInfo = async () => {
    if (!websiteUrl.trim()) {
      setError('Please enter a company website');
      return;
    }

    setIsExtracting(true);
    setError(null);
    setProgress(10);

    try {
      // Clean up URL
      let cleanUrl = websiteUrl.trim();
      if (!cleanUrl.startsWith('http')) {
        cleanUrl = 'https://' + cleanUrl;
      }

      setProgress(30);

      const prompt = `Extract comprehensive information about the company at ${cleanUrl}. 

Search the web thoroughly and gather:
1. Company name (official name)
2. Primary industry/sector
3. Estimated revenue range (pick one: <10M, 10M-50M, 50M-100M, 100M-500M, 500M+)
4. Employee count estimate (e.g., "50-200", "200-500", "500+")
5. Headquarters location (city, state/country)
6. LinkedIn company page URL
7. Careers/jobs page URL
8. Brief description (2-3 sentences about what they do)
9. Any notable information (awards, recent funding, key executives, etc.)

Be thorough and accurate. Return structured data.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            website: { type: "string" },
            industry: { type: "string" },
            revenue_range: { 
              type: "string",
              enum: ["<10M", "10M-50M", "50M-100M", "100M-500M", "500M+", "unknown"]
            },
            employee_count: { type: "string" },
            location: { type: "string" },
            linkedin_url: { type: "string" },
            careers_page_url: { type: "string" },
            description: { type: "string" },
            notable_info: { type: "string" }
          }
        }
      });

      setProgress(90);

      // Format the extracted data
      const formattedData = {
        name: result.name || '',
        website: cleanUrl.replace(/^https?:\/\//, ''),
        industry: result.industry || '',
        revenue_range: result.revenue_range === 'unknown' ? '' : result.revenue_range,
        employee_count: result.employee_count || '',
        location: result.location || '',
        linkedin_url: result.linkedin_url || '',
        careers_page_url: result.careers_page_url || '',
        notes: `${result.description || ''}\n\n${result.notable_info ? 'Notable: ' + result.notable_info : ''}`.trim(),
        tier: 'tier_1',
        monitoring_active: true
      };

      setProgress(100);
      setExtractedData(formattedData);
      setIsExtracting(false);

    } catch (err) {
      console.error('Error extracting company info:', err);
      setError('Failed to extract company information. Please try again or add manually.');
      setIsExtracting(false);
      setProgress(0);
    }
  };

  const handleSubmit = () => {
    if (extractedData) {
      onSubmit(extractedData);
    }
  };

  const handleReset = () => {
    setExtractedData(null);
    setWebsiteUrl('');
    setError(null);
    setProgress(0);
  };

  return (
    <Card className="mb-6 bg-gradient-to-br from-white to-blue-50 border-blue-200">
      <CardHeader className="border-b border-blue-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-xl font-bold text-slate-900">
              Quick Add Company
            </CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {!extractedData ? (
          <div className="space-y-6">
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                Just paste a company website and we'll automatically extract all the relevant information using web intelligence.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="website">Company Website *</Label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <Input
                      id="website"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="e.g. acmecorp.com or https://acmecorp.com"
                      className="pl-10"
                      disabled={isExtracting}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !isExtracting) {
                          extractCompanyInfo();
                        }
                      }}
                    />
                  </div>
                  <Button
                    onClick={extractCompanyInfo}
                    disabled={isExtracting || !websiteUrl.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Extract Info
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {isExtracting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Searching the web and extracting data...</span>
                    <span className="font-semibold text-slate-900">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm font-semibold text-purple-900 mb-2">
                🔗 Affinity CRM Integration (Coming Soon)
              </p>
              <p className="text-sm text-purple-800 mb-3">
                Want to import companies directly from Affinity? Enable backend functions in Dashboard → Settings and we can build a direct integration.
              </p>
              <p className="text-xs text-purple-700">
                With Affinity integration, you'll be able to sync companies, contacts, and relationship data automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Alert className="bg-emerald-50 border-emerald-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-emerald-900">
                Successfully extracted company information! Review and confirm the details below.
              </AlertDescription>
            </Alert>

            <div className="grid md:grid-cols-2 gap-4 p-4 bg-white rounded-lg border border-slate-200">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Company Name
                </p>
                <p className="text-sm font-semibold text-slate-900">{extractedData.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Website
                </p>
                <p className="text-sm text-slate-900">{extractedData.website}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Industry
                </p>
                <p className="text-sm text-slate-900">{extractedData.industry || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Revenue Range
                </p>
                <p className="text-sm text-slate-900">{extractedData.revenue_range || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Employee Count
                </p>
                <p className="text-sm text-slate-900">{extractedData.employee_count || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Location
                </p>
                <p className="text-sm text-slate-900">{extractedData.location || '-'}</p>
              </div>
              {extractedData.linkedin_url && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    LinkedIn
                  </p>
                  <p className="text-sm text-blue-600 truncate">{extractedData.linkedin_url}</p>
                </div>
              )}
              {extractedData.careers_page_url && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Careers Page
                  </p>
                  <p className="text-sm text-blue-600 truncate">{extractedData.careers_page_url}</p>
                </div>
              )}
              {extractedData.notes && (
                <div className="md:col-span-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Notes
                  </p>
                  <p className="text-sm text-slate-900 whitespace-pre-wrap">{extractedData.notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isLoading}
              >
                Start Over
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Add Company
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}