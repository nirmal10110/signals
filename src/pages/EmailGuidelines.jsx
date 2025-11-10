import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Star, Trash2, X, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function EmailGuidelinesPage() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    tone_description: "",
    dos: "",
    donts: "",
    max_word_count: 150,
    example_emails: [{ subject: "", body: "", why_it_worked: "" }]
  });

  const queryClient = useQueryClient();

  const { data: guidelines = [] } = useQuery({
    queryKey: ['emailGuidelines'],
    queryFn: () => base44.entities.EmailGuidelines.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.EmailGuidelines.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailGuidelines'] });
      toast.success('Guidelines added');
      setShowForm(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EmailGuidelines.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailGuidelines'] });
      toast.success('Guidelines deleted');
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id) => {
      // First, unset all other defaults
      const updates = guidelines.map(g => 
        base44.entities.EmailGuidelines.update(g.id, { is_default: g.id === id })
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emailGuidelines'] });
      toast.success('Default guideline updated');
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      tone_description: "",
      dos: "",
      donts: "",
      max_word_count: 150,
      example_emails: [{ subject: "", body: "", why_it_worked: "" }]
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      dos: formData.dos.split('\n').filter(Boolean),
      donts: formData.donts.split('\n').filter(Boolean),
      example_successful_emails: formData.example_emails.filter(e => e.subject && e.body)
    };

    createMutation.mutate(payload);
  };

  const addExampleEmail = () => {
    setFormData({
      ...formData,
      example_emails: [...formData.example_emails, { subject: "", body: "", why_it_worked: "" }]
    });
  };

  const updateExampleEmail = (index, field, value) => {
    const updated = [...formData.example_emails];
    updated[index][field] = value;
    setFormData({ ...formData, example_emails: updated });
  };

  const removeExampleEmail = (index) => {
    const updated = formData.example_emails.filter((_, i) => i !== index);
    setFormData({ ...formData, example_emails: updated });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Email Guidelines</h1>
            <p className="text-slate-600 mt-1">Define tone, style, and provide examples of successful emails</p>
          </div>
          <Button 
            onClick={() => setShowForm(!showForm)}
            className="bg-slate-900 hover:bg-slate-800"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Guideline
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6 bg-white border-slate-200">
            <CardHeader className="border-b border-slate-200">
              <div className="flex justify-between items-center">
                <CardTitle>New Email Guideline</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Guideline Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Volpi Standard Tone"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tone">Tone Description *</Label>
                  <Textarea
                    id="tone"
                    value={formData.tone_description}
                    onChange={(e) => setFormData({...formData, tone_description: e.target.value})}
                    placeholder="Brief, witty, short, simple, not over the top..."
                    rows={3}
                    required
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="dos">Do's (one per line)</Label>
                    <Textarea
                      id="dos"
                      value={formData.dos}
                      onChange={(e) => setFormData({...formData, dos: e.target.value})}
                      placeholder="Lead with genuine curiosity&#10;Reference specific company context&#10;Keep it under 150 words"
                      rows={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="donts">Don'ts (one per line)</Label>
                    <Textarea
                      id="donts"
                      value={formData.donts}
                      onChange={(e) => setFormData({...formData, donts: e.target.value})}
                      placeholder="Avoid corporate jargon&#10;Don't use buzzwords&#10;Never use 'synergy' or 'disruptive'"
                      rows={5}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_words">Maximum Word Count</Label>
                  <Input
                    id="max_words"
                    type="number"
                    value={formData.max_word_count}
                    onChange={(e) => setFormData({...formData, max_word_count: parseInt(e.target.value)})}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>Example Successful Emails</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addExampleEmail}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Example
                    </Button>
                  </div>

                  {formData.example_emails.map((email, index) => (
                    <Card key={index} className="bg-slate-50 border-slate-200">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-semibold text-slate-700">Example {index + 1}</p>
                          {formData.example_emails.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeExampleEmail(index)}
                              className="h-6 w-6"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <Input
                          value={email.subject}
                          onChange={(e) => updateExampleEmail(index, 'subject', e.target.value)}
                          placeholder="Subject line"
                        />
                        <Textarea
                          value={email.body}
                          onChange={(e) => updateExampleEmail(index, 'body', e.target.value)}
                          placeholder="Email body"
                          rows={4}
                        />
                        <Input
                          value={email.why_it_worked}
                          onChange={(e) => updateExampleEmail(index, 'why_it_worked', e.target.value)}
                          placeholder="Why did this email get a response?"
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="bg-slate-900 hover:bg-slate-800"
                  >
                    Save Guidelines
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {guidelines.map((guideline) => (
            <Card key={guideline.id} className="bg-white border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-bold">{guideline.name}</CardTitle>
                      {guideline.is_default && (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                          <Star className="w-3 h-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-2">{guideline.tone_description}</p>
                  </div>
                  <div className="flex gap-2">
                    {!guideline.is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDefaultMutation.mutate(guideline.id)}
                        title="Set as default"
                      >
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(guideline.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  {guideline.dos && guideline.dos.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Do's
                      </p>
                      <ul className="text-sm text-slate-700 space-y-1">
                        {guideline.dos.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-emerald-600 mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {guideline.donts && guideline.donts.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        Don'ts
                      </p>
                      <ul className="text-sm text-slate-700 space-y-1">
                        {guideline.donts.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-red-600 mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Max Word Count: {guideline.max_word_count || 150}
                  </p>
                </div>

                {guideline.example_successful_emails && guideline.example_successful_emails.length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      {guideline.example_successful_emails.length} Successful Example{guideline.example_successful_emails.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {guidelines.length === 0 && !showForm && (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-600">No email guidelines yet. Add your first guideline to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}