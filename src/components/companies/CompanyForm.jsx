
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
import { X, Plus, Trash2 } from "lucide-react";

export default function CompanyForm({ company, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState(company || {
    name: '',
    website: '',
    industry: '',
    revenue_range: '',
    employee_count: '',
    location: '',
    tier: 'tier_1',
    relationship_owners: [{ name: 'Thomas Mears-Alcaide', email: 'tom@volpicapital.com', digest_frequency: 'daily' }],
    notes: '',
    monitoring_active: true,
    investment_date: '',
    founder_age: '',
    linkedin_url: '',
    careers_page_url: ''
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleOwnerChange = (index, field, value) => {
    const newOwners = [...(formData.relationship_owners || [])];
    newOwners[index] = { ...newOwners[index], [field]: value };
    setFormData(prev => ({ ...prev, relationship_owners: newOwners }));
  };

  const addOwner = () => {
    const newOwners = [...(formData.relationship_owners || []), { name: '', email: '', digest_frequency: 'daily' }];
    setFormData(prev => ({ ...prev, relationship_owners: newOwners }));
  };

  const removeOwner = (index) => {
    const newOwners = (formData.relationship_owners || []).filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, relationship_owners: newOwners }));
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
            {company ? 'Edit Company' : 'Add Company Manually'}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. Acme Corporation"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder="e.g. acmecorp.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={formData.industry}
                onChange={(e) => handleChange('industry', e.target.value)}
                placeholder="e.g. SaaS, Healthcare, Manufacturing"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="revenue_range">Revenue Range</Label>
              <Select
                value={formData.revenue_range}
                onValueChange={(value) => handleChange('revenue_range', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="<10M">&lt;$10M</SelectItem>
                  <SelectItem value="10M-50M">$10M-$50M</SelectItem>
                  <SelectItem value="50M-100M">$50M-$100M</SelectItem>
                  <SelectItem value="100M-500M">$100M-$500M</SelectItem>
                  <SelectItem value="500M+">$500M+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee_count">Employee Count</Label>
              <Input
                id="employee_count"
                value={formData.employee_count}
                onChange={(e) => handleChange('employee_count', e.target.value)}
                placeholder="e.g. 50-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="e.g. London, UK"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tier">Priority Tier</Label>
              <Select
                value={formData.tier}
                onValueChange={(value) => handleChange('tier', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tier_1">Tier 1 (Highest Priority)</SelectItem>
                  <SelectItem value="tier_2">Tier 2</SelectItem>
                  <SelectItem value="tier_3">Tier 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-semibold text-purple-900">
                👤 Relationship Owners & Alert Recipients
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addOwner}
                className="bg-white"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Owner
              </Button>
            </div>
            <p className="text-xs text-purple-700 mb-3">
              These people will receive email alerts for this company
            </p>
            
            <div className="space-y-3">
              {(formData.relationship_owners || [{ name: 'Thomas Mears-Alcaide', email: 'tom@volpicapital.com', digest_frequency: 'daily' }]).map((owner, index) => (
                <div key={index} className="bg-white p-3 rounded-lg border border-purple-200">
                  <div className="grid md:grid-cols-3 gap-3 mb-2">
                    <Input
                      placeholder="Name (e.g. Thomas Mears-Alcaide)"
                      value={owner.name || ''}
                      onChange={(e) => handleOwnerChange(index, 'name', e.target.value)}
                    />
                    <Input
                      type="email"
                      placeholder="Email (e.g. tom@volpicapital.com)"
                      value={owner.email || ''}
                      onChange={(e) => handleOwnerChange(index, 'email', e.target.value)}
                    />
                    <Select
                      value={owner.digest_frequency || 'daily'}
                      onValueChange={(value) => handleOwnerChange(index, 'digest_frequency', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily Digest</SelectItem>
                        <SelectItem value="weekly">Weekly Digest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(formData.relationship_owners || []).length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeOwner(index)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50 w-full"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove Owner
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-semibold text-blue-900 mb-3">
              📊 Enhanced Monitoring Fields (Optional)
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="linkedin_url">LinkedIn Company URL</Label>
                <Input
                  id="linkedin_url"
                  value={formData.linkedin_url}
                  onChange={(e) => handleChange('linkedin_url', e.target.value)}
                  placeholder="e.g. linkedin.com/company/acme"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="careers_page_url">Careers Page URL</Label>
                <Input
                  id="careers_page_url"
                  value={formData.careers_page_url}
                  onChange={(e) => handleChange('careers_page_url', e.target.value)}
                  placeholder="e.g. acmecorp.com/careers"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="investment_date">Investment Date (if applicable)</Label>
                <Input
                  id="investment_date"
                  type="date"
                  value={formData.investment_date}
                  onChange={(e) => handleChange('investment_date', e.target.value)}
                />
                <p className="text-xs text-blue-700">For tracking 3-5 year investment horizon</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="founder_age">Founder Age</Label>
                <Input
                  id="founder_age"
                  type="number"
                  value={formData.founder_age}
                  onChange={(e) => handleChange('founder_age', e.target.value)}
                  placeholder="e.g. 58"
                />
                <p className="text-xs text-blue-700">For 55+ succession planning signals</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Internal Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Add any relevant notes about this target..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <Label htmlFor="monitoring_active" className="text-base font-semibold">
                Active Monitoring
              </Label>
              <p className="text-sm text-slate-600 mt-1">
                Automatically check for news and updates
              </p>
            </div>
            <Switch
              id="monitoring_active"
              checked={formData.monitoring_active}
              onCheckedChange={(checked) => handleChange('monitoring_active', checked)}
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
              {isLoading ? 'Saving...' : company ? 'Update Company' : 'Add Company'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
