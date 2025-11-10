import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Building2, 
  ExternalLink,
  Pencil,
  Trash2,
  Search,
  Filter,
  Globe,
  Mail
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

import CompanyForm from "../components/companies/CompanyForm";
import QuickAddCompany from "../components/companies/QuickAddCompany";
import BulkAddCompanies from "../components/companies/BulkAddCompanies";

export default function TopTargetsPage() {
  const [showForm, setShowForm] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [tierFilter, setTierFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list('-created_date'),
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => base44.entities.Alert.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Company.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setShowForm(false);
      setShowQuickAdd(false);
      setEditingCompany(null);
      toast.success('Company added successfully');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Company.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setShowForm(false);
      setEditingCompany(null);
      toast.success('Company updated successfully');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Company.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Company deleted successfully');
    },
  });

  const handleSubmit = (data) => {
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = async (companyId) => {
    if (confirm('Are you sure you want to delete this company? This will also delete all associated alerts.')) {
      deleteMutation.mutate(companyId);
    }
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setShowForm(true);
  };

  const filteredCompanies = companies
    .filter(company => {
      const tierMatch = tierFilter === "all" || company.tier === tierFilter;
      const searchMatch = !searchQuery || 
        company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (company.website && company.website.toLowerCase().includes(searchQuery.toLowerCase()));
      return tierMatch && searchMatch;
    });

  const getCompanyAlertCount = (companyId) => {
    return alerts.filter(a => a.company_id === companyId && a.status === 'new').length;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Top Targets</h1>
            <p className="text-slate-600 mt-1">Manage your target company portfolio</p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => setShowQuickAdd(true)}
              variant="outline"
              className="bg-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Quick Add
            </Button>
            <Button 
              onClick={() => setShowBulkAdd(true)}
              variant="outline"
              className="bg-white"
            >
              <Building2 className="w-4 h-4 mr-2" />
              Bulk Import
            </Button>
            <Button 
              onClick={() => {
                setEditingCompany(null);
                setShowForm(true);
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Company
            </Button>
          </div>
        </div>

        {showQuickAdd && (
          <QuickAddCompany
            onSubmit={handleSubmit}
            onCancel={() => setShowQuickAdd(false)}
            isLoading={createMutation.isPending}
          />
        )}

        {showBulkAdd && (
          <BulkAddCompanies
            onClose={() => setShowBulkAdd(false)}
          />
        )}

        {showForm && (
          <CompanyForm
            company={editingCompany}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingCompany(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-40 bg-white">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="tier_1">Tier 1</SelectItem>
                <SelectItem value="tier_2">Tier 2</SelectItem>
                <SelectItem value="tier_3">Tier 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompanies.map((company) => {
            const alertCount = getCompanyAlertCount(company.id);
            
            return (
              <Card key={company.id} className="bg-white border-slate-200 hover:shadow-md transition-shadow duration-200">
                <CardHeader className="border-b border-slate-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-bold text-slate-900 mb-2">
                        {company.name}
                      </CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={
                          company.tier === 'tier_1' ? "bg-red-100 text-red-800 border-red-200" :
                          company.tier === 'tier_2' ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                          "bg-blue-100 text-blue-800 border-blue-200"
                        }>
                          {company.tier?.replace('_', ' ').toUpperCase() || 'TIER 1'}
                        </Badge>
                        {company.monitoring_active && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                            Active
                          </Badge>
                        )}
                        {alertCount > 0 && (
                          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                            {alertCount} alerts
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {company.website && (
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="w-4 h-4 text-slate-400" />
                        <a 
                          href={`https://${company.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 truncate flex-1"
                        >
                          {company.website}
                        </a>
                      </div>
                    )}
                    
                    {company.relationship_owners && company.relationship_owners.length > 0 && (
                      <div className="flex items-start gap-2 text-sm">
                        <Mail className="w-4 h-4 text-slate-400 mt-0.5" />
                        <div className="flex-1">
                          {company.relationship_owners.map((owner, idx) => (
                            <div key={idx} className="text-slate-700">
                              {owner.name} {owner.email && `(${owner.email})`}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {company.industry && (
                      <div className="text-sm text-slate-600">
                        <span className="font-medium">Industry:</span> {company.industry}
                      </div>
                    )}

                    {company.notes && (
                      <div className="text-sm text-slate-600">
                        <p className="line-clamp-2">{company.notes}</p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-4 border-t border-slate-200">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(company)}
                        className="flex-1 bg-white"
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(company.id)}
                        className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredCompanies.length === 0 && !showForm && !showQuickAdd && !showBulkAdd && (
          <div className="text-center py-12 text-slate-500 bg-white rounded-lg border border-slate-200">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>No companies found. Add your first target company to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}