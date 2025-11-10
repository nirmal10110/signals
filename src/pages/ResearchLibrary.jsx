import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  FileText, 
  Upload, 
  Loader2, 
  Trash2,
  Link as LinkIcon,
  Sparkles,
  CheckCircle2,
  X
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ResearchLibraryPage() {
  const [showForm, setShowForm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    url: "",
    file: null,
    industries: "",
    key_topics: ""
  });

  const queryClient = useQueryClient();

  const { data: research = [], isLoading } = useQuery({
    queryKey: ['thematicResearch'],
    queryFn: () => base44.entities.ThematicResearch.list('-created_date'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ThematicResearch.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thematicResearch'] });
      toast.success('Research deleted');
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      let fileUrl = null;
      let extractedContent = null;

      // If file uploaded, process it first
      if (formData.file) {
        const uploadResult = await base44.integrations.Core.UploadFile({
          file: formData.file
        });
        fileUrl = uploadResult.file_url;

        // Extract content from the file
        const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url: fileUrl,
          json_schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              investment_thesis: { type: "string" },
              key_statistics: { 
                type: "array",
                items: { type: "string" }
              }
            }
          }
        });

        if (extractResult.status === 'success') {
          extractedContent = extractResult.output;
        }
      }

      // If URL provided, use LLM to extract insights
      if (formData.url && !formData.file) {
        const prompt = `Extract key insights from this research document/page: ${formData.url}

Please provide:
1. A concise summary (2-3 sentences)
2. The core investment thesis
3. 3-5 key statistics or data points that would be compelling in a cold email

Return structured JSON.`;

        const llmResult = await base44.integrations.Core.InvokeLLM({
          prompt,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              investment_thesis: { type: "string" },
              key_statistics: {
                type: "array",
                items: { type: "string" }
              }
            }
          }
        });

        extractedContent = llmResult;
      }

      // Create research record
      await base44.entities.ThematicResearch.create({
        title: formData.title,
        url: formData.url || null,
        file_url: fileUrl,
        content_summary: extractedContent?.summary || "",
        investment_thesis: extractedContent?.investment_thesis || "",
        key_statistics: extractedContent?.key_statistics || [],
        industries: formData.industries.split(',').map(s => s.trim()).filter(Boolean),
        key_topics: formData.key_topics.split(',').map(s => s.trim()).filter(Boolean),
        is_active: true
      });

      toast.success('Research added successfully!');
      queryClient.invalidateQueries({ queryKey: ['thematicResearch'] });
      setShowForm(false);
      setFormData({
        title: "",
        url: "",
        file: null,
        industries: "",
        key_topics: ""
      });

    } catch (error) {
      toast.error('Failed to process research: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Research Library</h1>
            <p className="text-slate-600 mt-1">Upload thematic research to personalize cold emails</p>
          </div>
          <Button 
            onClick={() => setShowForm(!showForm)}
            className="bg-slate-900 hover:bg-slate-800"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Research
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6 bg-gradient-to-br from-white to-purple-50 border-purple-200">
            <CardHeader className="border-b border-purple-200">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-bold">Add Thematic Research</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <Alert className="bg-blue-50 border-blue-200">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-900">
                    Upload a PDF or provide a URL. We'll automatically extract key insights, statistics, and investment thesis to use in personalized emails.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="title">Research Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="e.g. SAP Implementation Services Market Research"
                    required
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="url">Research URL</Label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="url"
                        value={formData.url}
                        onChange={(e) => setFormData({...formData, url: e.target.value})}
                        placeholder="https://..."
                        className="pl-10"
                        disabled={!!formData.file}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="file">Or Upload PDF</Label>
                    <div className="relative">
                      <Input
                        id="file"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => setFormData({...formData, file: e.target.files[0]})}
                        disabled={!!formData.url}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="industries">Industries (comma-separated)</Label>
                    <Input
                      id="industries"
                      value={formData.industries}
                      onChange={(e) => setFormData({...formData, industries: e.target.value})}
                      placeholder="SAP, ERP, Manufacturing Software"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="topics">Key Topics (comma-separated)</Label>
                    <Input
                      id="topics"
                      value={formData.key_topics}
                      onChange={(e) => setFormData({...formData, key_topics: e.target.value})}
                      placeholder="Market consolidation, Vertical integration"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isProcessing || (!formData.url && !formData.file)}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Process & Add
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {research.map((item) => (
            <Card key={item.id} className="bg-white border-slate-200 hover:shadow-md transition-shadow">
              <CardHeader className="border-b border-slate-200">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg font-bold text-slate-900 flex-1">
                    {item.title}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(item.id)}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {item.industries?.map((industry, idx) => (
                    <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-700">
                      {industry}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {item.content_summary && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      Summary
                    </p>
                    <p className="text-sm text-slate-700 line-clamp-3">{item.content_summary}</p>
                  </div>
                )}

                {item.investment_thesis && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      Investment Thesis
                    </p>
                    <p className="text-sm text-slate-700 line-clamp-2">{item.investment_thesis}</p>
                  </div>
                )}

                {item.key_statistics && item.key_statistics.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      Key Statistics
                    </p>
                    <ul className="text-sm text-slate-700 space-y-1">
                      {item.key_statistics.slice(0, 2).map((stat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{stat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(item.url || item.file_url) && (
                  <a
                    href={item.url || item.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <LinkIcon className="w-3 h-3" />
                    View Source
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {research.length === 0 && !showForm && (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-600">No research documents yet. Add your first thematic research to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}