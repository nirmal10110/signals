
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Copy, RefreshCw, Loader2, CheckCircle2, Globe } from "lucide-react";
import { toast } from "sonner";

export default function ColdEmailGeneratorPage() {
  const [companyUrl, setCompanyUrl] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [context, setContext] = useState("");
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [usedResearch, setUsedResearch] = useState([]);
  const [extractedCompanyInfo, setExtractedCompanyInfo] = useState(null);

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const { data: research = [] } = useQuery({
    queryKey: ['thematicResearch'],
    queryFn: () => base44.entities.ThematicResearch.list(),
  });

  const { data: guidelines = [] } = useQuery({
    queryKey: ['emailGuidelines'],
    queryFn: () => base44.entities.EmailGuidelines.list(),
  });

  const defaultGuideline = guidelines.find(g => g.is_default) || guidelines[0];

  const generateEmail = async () => {
    const targetCompany = selectedCompany ? companies.find(c => c.id === selectedCompany) : null;

    if (!companyUrl && !targetCompany) {
      toast.error("Please enter a company URL or select from your targets");
      return;
    }

    setIsGenerating(true);
    setUsedResearch([]);
    setExtractedCompanyInfo(null);
    
    try {
      let companyName = "";
      let companyWebsite = "";
      let companyIndustry = "";

      // If URL provided, extract company info first
      if (companyUrl) {
        const cleanUrl = companyUrl.trim().startsWith('http') 
          ? companyUrl.trim() 
          : `https://${companyUrl.trim()}`;

        const extractionPrompt = `Extract basic information about the company from this URL: ${cleanUrl}

Please provide:
1. Company name
2. Primary industry/sector
3. Brief description (1-2 sentences)
4. What makes them unique or their key differentiator

Return structured JSON.`;

        const extracted = await base44.integrations.Core.InvokeLLM({
          prompt: extractionPrompt,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              industry: { type: "string" },
              description: { type: "string" },
              unique_selling_point: { type: "string" }
            }
          }
        });

        companyName = extracted.name;
        companyWebsite = cleanUrl.replace(/^https?:\/\//, '');
        companyIndustry = extracted.industry;
        setExtractedCompanyInfo(extracted);
      } else if (targetCompany) {
        companyName = targetCompany.name;
        companyWebsite = targetCompany.website;
        companyIndustry = targetCompany.industry;
      }

      // Step 1: Get recent company news
      const newsPrompt = `Find the most recent news (last 30 days) about ${companyName}${companyWebsite ? ` (${companyWebsite})` : ''}.
      
Focus on:
- Executive hires or leadership changes (especially CFO, CEO, COO)
- Funding rounds or acquisitions
- International expansion
- Industry awards or major recognitions
- Major client wins or partnerships
- Product launches

Return the single most relevant news item only. If no significant news found, return null for headline.`;

      const newsResult = await base44.integrations.Core.InvokeLLM({
        prompt: newsPrompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            headline: { type: "string" },
            summary: { type: "string" },
            date: { type: "string" }
          }
        }
      });

      // Step 2: Find relevant research
      const relevantResearch = research.filter(r => {
        if (!r.is_active || !companyIndustry) return false;
        return r.industries?.some(ind => 
          companyIndustry.toLowerCase().includes(ind.toLowerCase()) ||
          ind.toLowerCase().includes(companyIndustry.toLowerCase())
        );
      });

      setUsedResearch(relevantResearch);

      // Step 3: Build comprehensive prompt with 4-part structure
      let prompt = `You are writing a cold email from Volpi Capital (UK-based PE firm) to ${companyName}.

**Company Context:**
${companyIndustry ? `Industry: ${companyIndustry}` : ''}
${companyWebsite ? `Website: ${companyWebsite}` : ''}
${extractedCompanyInfo?.description ? `About: ${extractedCompanyInfo.description}` : ''}
${extractedCompanyInfo?.unique_selling_point ? `USP: ${extractedCompanyInfo.unique_selling_point}` : ''}
${context ? `Additional Context: ${context}` : ''}

**Recent News:**
${newsResult.headline ? `${newsResult.headline} - ${newsResult.summary}` : 'No recent significant news found'}

**Relevant Volpi Research:**
${relevantResearch.length > 0 ? relevantResearch.map(r => `
- ${r.title}
  Thesis: ${r.investment_thesis}
  Key Stats: ${r.key_statistics?.slice(0, 2).join('; ')}
`).join('\n') : 'No specific Volpi research found for this company/industry.'}

**Tone Guidelines:**
${defaultGuideline ? defaultGuideline.tone_description : 'Brief, witty, short, simple, not over the top'}
${defaultGuideline?.max_word_count ? `Maximum ${defaultGuideline.max_word_count} words` : 'Keep under 150 words'}

**Do's:**
${defaultGuideline?.dos?.length > 0 ? `- ${defaultGuideline.dos?.join('\n- ')}` : '- Lead with genuine curiosity\n- Reference specific company context\n- Keep it short'}

**Don'ts:**
${defaultGuideline?.donts?.length > 0 ? `- ${defaultGuideline.donts?.join('\n- ')}` : '- Avoid corporate jargon\n- Don\'t use buzzwords'}

${defaultGuideline?.example_successful_emails?.length > 0 ? `
**Example emails that worked:**
Subject: ${defaultGuideline.example_successful_emails[0].subject}

${defaultGuideline.example_successful_emails[0].body}

Why it worked: ${defaultGuideline.example_successful_emails[0].why_it_worked}
` : ''}

**CRITICAL: Email MUST follow this 4-part structure:**

1. **Who are you (1 sentence):** Brief intro of Volpi Capital and your role
   - Example: "I'm [name] at Volpi Capital, a UK growth equity firm focused on B2B software and services."

2. **Why do you like the space (2-3 sentences):** Reference relevant Volpi research/thesis
   - Use insights from the research library above
   - Demonstrate sector expertise and understanding of market dynamics
   - Example: "We've been tracking the [industry] space closely—our recent IC paper highlighted [key insight from research]."

3. **Why do you like this company specifically (2-3 sentences):** Company's unique positioning/USP
   - Reference their specific differentiator
   - Optionally tie in recent news if relevant
   - Be genuine and specific, not generic praise
   - Example: "What caught my attention about [Company] is [specific USP]. [Optional: Recent news reference]."

4. **CTA or soft close (1 sentence):** Non-pushy call to action
   - Keep it conversational and low-pressure
   - Example: "Would you be open to a brief chat?" or "I'd love to learn more about what you're building."

**Your Task:**
Write a compelling cold email that:
- Strictly follows the 4-part structure above
- Uses UK English spelling and phrasing
- Sounds authentic and human, NOT salesy or templated
- Feels like it's from a smart, curious investor
- Is ${defaultGuideline?.max_word_count || 150} words or less

Return JSON with "subject" and "body" fields.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            subject: { type: "string" },
            body: { type: "string" }
          }
        }
      });

      const formattedEmail = `Subject: ${result.subject}\n\n${result.body}`;
      setGeneratedEmail(formattedEmail);
      toast.success("Email generated successfully!");

    } catch (error) {
      toast.error("Failed to generate email: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedEmail);
    toast.success("Email copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-purple-600" />
            Cold Email Generator
          </h1>
          <p className="text-slate-600 mt-1">Generate personalized outreach emails using recent news and thematic research</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <Card className="bg-white border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="text-xl font-bold text-slate-900">Email Parameters</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="company-url">Company URL *</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    id="company-url"
                    placeholder="e.g. acmecorp.com or https://acmecorp.com"
                    value={companyUrl}
                    onChange={(e) => {
                      setCompanyUrl(e.target.value);
                      setSelectedCompany(null);
                    }}
                    className="pl-10 text-lg"
                    disabled={!!selectedCompany}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-slate-200" />
                <span className="text-sm text-slate-500">OR</span>
                <div className="flex-1 border-t border-slate-200" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-select">Select from Your Targets</Label>
                <Select 
                  value={selectedCompany || ""} 
                  onValueChange={(value) => {
                    setSelectedCompany(value);
                    setCompanyUrl("");
                  }}
                  disabled={!!companyUrl}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose from your targets..." />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="context">Additional Context (optional)</Label>
                <Textarea
                  id="context"
                  placeholder="e.g. Just raised Series B, expanding to US market, hiring new CFO..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={4}
                />
              </div>

              <Button
                onClick={generateEmail}
                disabled={isGenerating || (!companyUrl && !selectedCompany)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Email
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Output Panel */}
          <Card className="bg-white border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-bold text-slate-900">Generated Email</CardTitle>
                {generatedEmail && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyToClipboard}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateEmail}
                      disabled={isGenerating}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Regenerate
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {!generatedEmail ? (
                <div className="flex flex-col items-center justify-center h-96 text-center text-slate-500">
                  <Sparkles className="w-16 h-16 mb-4 text-slate-300" />
                  <p className="text-lg font-medium">No email generated yet</p>
                  <p className="text-sm mt-2">Enter a company URL and click "Generate Email"</p>
                  
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left w-full">
                    <p className="text-sm font-semibold text-blue-900 mb-2">Email Structure:</p>
                    <ol className="text-xs text-blue-800 space-y-1 list-decimal ml-4">
                      <li><strong>Who are you:</strong> Brief Volpi Capital intro</li>
                      <li><strong>Why the space:</strong> Reference research library insights</li>
                      <li><strong>Why this company:</strong> Their specific USP/differentiator</li>
                      <li><strong>CTA:</strong> Soft, conversational close</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {extractedCompanyInfo && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-semibold text-blue-900 mb-1">
                        📍 Detected Company:
                      </p>
                      <p className="text-sm text-blue-800">
                        <strong>{extractedCompanyInfo.name}</strong> • {extractedCompanyInfo.industry}
                      </p>
                      {extractedCompanyInfo.description && (
                        <p className="text-xs text-blue-700 mt-1">{extractedCompanyInfo.description}</p>
                      )}
                      {extractedCompanyInfo.unique_selling_point && (
                        <p className="text-xs text-blue-700 mt-1">
                          <strong>USP:</strong> {extractedCompanyInfo.unique_selling_point}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <pre className="text-sm text-slate-900 whitespace-pre-wrap font-sans leading-relaxed">
                      {generatedEmail}
                    </pre>
                  </div>
                  
                  {usedResearch.length > 0 && (
                    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-sm font-semibold text-purple-900 mb-2">
                        📚 Research Used:
                      </p>
                      <div className="space-y-1">
                        {usedResearch.map((r, idx) => (
                          <p key={idx} className="text-sm text-purple-800">
                            • {r.title}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Email ready to use! Copy and personalize as needed.</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
