
import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  X, 
  Upload, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  Info,
  Download
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function BulkAddCompanies({ onComplete, onCancel }) {
  const [websiteList, setWebsiteList] = useState('');
  const [defaultOwners, setDefaultOwners] = useState('tom@volpicapital.com'); // New state for default owners
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentCompany, setCurrentCompany] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  const processCompanies = async () => {
    // Parse URLs from textarea (split by newlines or commas)
    const urls = websiteList
      .split(/[\n,]/)
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urls.length === 0) {
      return;
    }

    // Parse default owners
    const ownerEmails = defaultOwners
      .split(/[\n,;]/)
      .map(email => email.trim())
      .filter(email => email.length > 0 && email.includes('@'));

    setIsProcessing(true);
    setProgress(0);
    setResults([]);
    setShowResults(false);

    const processedResults = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      setCurrentCompany(url);
      setProgress(((i + 1) / urls.length) * 100);

      try {
        // Clean up URL
        let cleanUrl = url.trim();
        if (!cleanUrl.startsWith('http')) {
          cleanUrl = 'https://' + cleanUrl;
        }

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
              description: { type: "string" }
            }
          }
        });

        const companyData = {
          name: result.name || url,
          website: cleanUrl.replace(/^https?:\/\//, ''),
          industry: result.industry || '',
          revenue_range: result.revenue_range === 'unknown' ? '' : result.revenue_range,
          employee_count: result.employee_count || '',
          location: result.location || '',
          linkedin_url: result.linkedin_url || '',
          careers_page_url: result.careers_page_url || '',
          notes: result.description || `Bulk imported on ${new Date().toLocaleDateString()}`,
          tier: 'tier_1',
          monitoring_active: true,
          relationship_owners: ownerEmails.map(email => ({ // New field for owners
            name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            email: email
          }))
        };

        // Check if company already exists by website
        const existingCompanies = await base44.entities.Company.filter({
          website: companyData.website
        });

        let savedCompany;
        if (existingCompanies.length > 0) {
          savedCompany = await base44.entities.Company.update(
            existingCompanies[0].id,
            companyData
          );
          processedResults.push({
            status: 'updated',
            company: result.name || url,
            data: companyData,
            owners: ownerEmails // Include owners in results
          });
        } else {
          savedCompany = await base44.entities.Company.create(companyData);
          processedResults.push({
            status: 'created',
            company: result.name || url,
            data: companyData,
            owners: ownerEmails // Include owners in results
          });
        }

      } catch (error) {
        console.error(`Error processing ${url}:`, error);
        processedResults.push({
          status: 'error',
          company: url,
          error: error.message
        });
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    setResults(processedResults);
    setShowResults(true);
    setIsProcessing(false);
    setCurrentCompany('');
  };

  const handleFinish = () => {
    onComplete(results);
  };

  const successCount = results.filter(r => r.status === 'created' || r.status === 'updated').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return (
    <Card className="mb-6 bg-white border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-xl font-bold text-slate-900">
              Bulk Add Companies
            </CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {!showResults ? (
          <div className="space-y-6">
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                Paste a list of company websites (one per line or comma-separated). We'll automatically extract company information for each one and assign them to the specified owners.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Default Alert Recipients (Emails)
              </label>
              <Textarea
                value={defaultOwners}
                onChange={(e) => setDefaultOwners(e.target.value)}
                placeholder="tom@volpicapital.com&#10;john@volpicapital.com&#10;sarah@volpicapital.com"
                rows={3}
                disabled={isProcessing}
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                Separate multiple emails with commas, semicolons, or new lines. These people will receive alerts for all imported companies.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Company Websites
              </label>
              <Textarea
                value={websiteList}
                onChange={(e) => setWebsiteList(e.target.value)}
                placeholder="acmecorp.com&#10;example.com&#10;another-company.co.uk"
                rows={10}
                disabled={isProcessing}
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                {websiteList.split(/[\n,]/).filter(url => url.trim().length > 0).length} companies detected
              </p>
            </div>

            {isProcessing && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700">
                      Processing: <span className="font-semibold">{currentCompany}</span>
                    </span>
                    <span className="font-semibold text-slate-900">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                <p className="text-sm text-slate-600">
                  Extracting company information from the web...
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={processCompanies}
                disabled={isProcessing || websiteList.trim().length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Start Import
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Alert className={successCount > 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}>
              {successCount > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={successCount > 0 ? "text-emerald-900" : "text-red-900"}>
                Import complete! {successCount} companies added/updated{errorCount > 0 && `, ${errorCount} failed`}.
              </AlertDescription>
            </Alert>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Company</TableHead>
                    <TableHead className="font-semibold">Industry</TableHead>
                    <TableHead className="font-semibold">Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {result.status === 'created' && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                            Created
                          </Badge>
                        )}
                        {result.status === 'updated' && (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                            Updated
                          </Badge>
                        )}
                        {result.status === 'error' && (
                          <Badge className="bg-red-100 text-red-800 border-red-200">
                            Error
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {result.company}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {result.data?.industry || result.error || '-'}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {result.data?.location || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleFinish}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Done
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
