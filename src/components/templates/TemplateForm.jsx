
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

const triggerOptions = [
  { value: "cfo_hiring", label: "CFO Hiring" },
  { value: "ceo_hiring", label: "CEO Hiring" },
  { value: "board_member_hired", label: "Board Member Hired" },
  { value: "head_of_sales_hiring", label: "Head of Sales Hiring" },
  { value: "head_of_delivery_hiring", label: "Head of Delivery Hiring" },
  { value: "executive_hiring", label: "Other Executive Hiring" },
  { value: "acquisition_announced", label: "Acquisition Announced" },
  { value: "international_expansion", label: "International Expansion" },
  { value: "new_office_opened", label: "New Office Opened" },
  { value: "job_posting_leadership", label: "Leadership Job Posting" },
  { value: "industry_award", label: "Industry Award" },
  { value: "event_attendance", label: "Event Attendance" },
  { value: "culture_initiative", label: "Culture Initiative" },
  { value: "funding_round", label: "Funding Round" },
  { value: "new_product_launch", label: "New Product Launch" },
  { value: "partnership", label: "Partnership" },
  { value: "financial_results", label: "Financial Results" },
  { value: "other", label: "Other" },
];

export default function TemplateForm({ template, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState(template || {
    name: '',
    trigger_type: '',
    subject_line: '',
    email_body: '',
    is_active: true
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="mb-6 bg-white border-slate-200">
      <CardHeader className="border-b border-slate-200">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-bold text-slate-900">
            {template ? 'Edit Template' : 'Create New Template'}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            Use placeholders: <code className="bg-blue-100 px-1 rounded">{'{{company_name}}'}</code> and <code className="bg-blue-100 px-1 rounded">{'{{trigger_details}}'}</code> in your template
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. CFO Hiring Outreach"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trigger_type">Trigger Type *</Label>
              <Select
                value={formData.trigger_type}
                onValueChange={(value) => handleChange('trigger_type', value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select trigger" />
                </SelectTrigger>
                <SelectContent>
                  {triggerOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject_line">Email Subject Line *</Label>
            <Input
              id="subject_line"
              value={formData.subject_line}
              onChange={(e) => handleChange('subject_line', e.target.value)}
              placeholder="e.g. Congratulations on the CFO search at {{company_name}}"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_body">Email Body *</Label>
            <Textarea
              id="email_body"
              value={formData.email_body}
              onChange={(e) => handleChange('email_body', e.target.value)}
              placeholder="Dear [Name],&#10;&#10;I noticed {{company_name}} is {{trigger_details}}...&#10;&#10;Best regards"
              rows={10}
              required
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <Label htmlFor="is_active" className="text-base font-semibold">
                Active Template
              </Label>
              <p className="text-sm text-slate-600 mt-1">
                Use this template for automatic alerts
              </p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleChange('is_active', checked)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              {isLoading ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
