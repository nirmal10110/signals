
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Building2, 
  Plus, 
  Search, 
  ExternalLink,
  Edit,
  MoreVertical,
  Sparkles,
  Loader2,
  Upload
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import CompanyForm from "../components/companies/CompanyForm";
import QuickAddCompany from "../components/companies/QuickAddCompany";
import BulkAddCompanies from "../components/companies/BulkAddCompanies";

export default function CompaniesPage() {
  const [showForm, setShowForm] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  const queryClient = useQueryClient();

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Company.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setShowForm(false);
      setShowQuickAdd(false);
      setEditingCompany(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Company.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setShowForm(false);
      setEditingCompany(null);
    },
  });

  const handleSubmit = (data) => {
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setShowForm(true);
    setShowQuickAdd(false);
    setShowBulkAdd(false);
  };

  const handleBulkComplete = (results) => {
    queryClient.invalidateQueries({ queryKey: ['companies'] });
    setShowBulkAdd(false);
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.industry?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Target Companies</h1>
            <p className="text-slate-600 mt-1">Manage your tier 1 deal pipeline</p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => {
                setEditingCompany(null);
                setShowForm(false);
                setShowQuickAdd(false);
                setShowBulkAdd(true);
              }}
              variant="outline"
              className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 hover:from-purple-100 hover:to-pink-100"
            >
              <Upload className="w-4 h-4 mr-2 text-purple-600" />
              Bulk Import
            </Button>
            <Button 
              onClick={() => {
                setEditingCompany(null);
                setShowForm(false);
                setShowQuickAdd(true);
                setShowBulkAdd(false);
              }}
              variant="outline"
              className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 hover:from-blue-100 hover:to-purple-100"
            >
              <Sparkles className="w-4 h-4 mr-2 text-blue-600" />
              Quick Add
            </Button>
            <Button 
              onClick={() => {
                setEditingCompany(null);
                setShowForm(true);
                setShowQuickAdd(false);
                setShowBulkAdd(false);
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Manually
            </Button>
          </div>
        </div>

        {showBulkAdd && (
          <BulkAddCompanies
            onComplete={handleBulkComplete}
            onCancel={() => setShowBulkAdd(false)}
          />
        )}

        {showQuickAdd && (
          <QuickAddCompany
            onSubmit={handleSubmit}
            onCancel={() => setShowQuickAdd(false)}
            isLoading={createMutation.isPending}
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

        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold">Company</TableHead>
                <TableHead className="font-semibold">Industry</TableHead>
                <TableHead className="font-semibold">Revenue</TableHead>
                <TableHead className="font-semibold">Tier</TableHead>
                <TableHead className="font-semibold">Owners</TableHead> {/* Changed from "Owner" to "Owners" */}
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.map((company) => (
                <TableRow key={company.id} className="hover:bg-slate-50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{company.name}</p>
                        {company.website && (
                          <a 
                            href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                          >
                            {company.website.replace(/^https?:\/\//, '')}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">{company.industry || '-'}</TableCell>
                  <TableCell className="text-slate-600">{company.revenue_range || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      company.tier === 'tier_1' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      company.tier === 'tier_2' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-slate-50 text-slate-700 border-slate-200'
                    }>
                      {company.tier?.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {company.relationship_owners && company.relationship_owners.length > 0 ? (
                      <div className="space-y-1">
                        {company.relationship_owners.map((owner, idx) => (
                          <div key={idx} className="text-xs">
                            <p className="font-medium text-slate-900">{owner.name}</p>
                            <p className="text-slate-500">{owner.email}</p>
                          </div>
                        ))}
                      </div>
                    ) : company.relationship_owner_email ? (
                      <div className="text-xs">
                        <p className="text-slate-900">{company.relationship_owner || 'Owner'}</p>
                        <p className="text-slate-500">{company.relationship_owner_email}</p>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      company.monitoring_active
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }>
                      {company.monitoring_active ? 'Active' : 'Paused'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(company)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredCompanies.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No companies found. Add your first target company to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
