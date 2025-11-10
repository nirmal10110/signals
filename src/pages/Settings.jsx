import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings as SettingsIcon, Users, Mail, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [editedPreferences, setEditedPreferences] = useState({});
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
  });

  const updateCompaniesMutation = useMutation({
    mutationFn: async ({ userEmail, newFrequency, companyIds }) => {
      // Update all companies for this user
      for (const companyId of companyIds) {
        const company = companies.find(c => c.id === companyId);
        const updatedOwners = company.relationship_owners.map(owner => {
          if (owner.email === userEmail) {
            return { ...owner, digest_frequency: newFrequency };
          }
          return owner;
        });
        await base44.entities.Company.update(companyId, { relationship_owners: updatedOwners });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Digest preferences updated for all companies');
      setEditedPreferences({});
    },
  });

  // Extract all unique users with their preferences
  const allUsers = {};
  companies.forEach(company => {
    (company.relationship_owners || []).forEach(owner => {
      if (owner.email && owner.email.endsWith('@volpicapital.com')) {
        if (!allUsers[owner.email]) {
          allUsers[owner.email] = {
            name: owner.name || owner.email.split('@')[0],
            email: owner.email,
            companies: [],
            // Determine the most common frequency (or first found)
            frequency: owner.digest_frequency || 'daily'
          };
        }
        allUsers[owner.email].companies.push({
          companyId: company.id,
          companyName: company.name,
          frequency: owner.digest_frequency || 'daily'
        });
      }
    });
  });

  const isAdmin = currentUser?.role === 'admin';
  const sortedUsers = Object.values(allUsers).sort((a, b) => 
    a.name.localeCompare(b.name)
  );

  const handleFrequencyChange = (userEmail, newFrequency) => {
    setEditedPreferences(prev => ({
      ...prev,
      [userEmail]: newFrequency
    }));
  };

  const savePreferences = async (userEmail) => {
    const newFrequency = editedPreferences[userEmail];
    
    if (!newFrequency) {
      toast.info('No changes to save');
      return;
    }

    const user = allUsers[userEmail];
    const companyIds = user.companies.map(c => c.companyId);

    await updateCompaniesMutation.mutateAsync({
      userEmail,
      newFrequency,
      companyIds
    });
  };

  const getDisplayFrequency = (userEmail) => {
    if (editedPreferences[userEmail]) {
      return editedPreferences[userEmail];
    }
    // Get the most common frequency for this user across all companies
    const user = allUsers[userEmail];
    const frequencies = user.companies.map(c => c.frequency);
    const dailyCount = frequencies.filter(f => f === 'daily').length;
    const weeklyCount = frequencies.filter(f => f === 'weekly').length;
    return dailyCount >= weeklyCount ? 'daily' : 'weekly';
  };

  const hasUnsavedChanges = (userEmail) => {
    return editedPreferences[userEmail] !== undefined;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <SettingsIcon className="w-8 h-8 text-slate-700" />
            <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          </div>
          <p className="text-slate-600">Manage digest preferences and notifications</p>
        </div>

        <Card className="bg-white border-slate-200">
          <CardHeader className="border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-slate-700" />
              <CardTitle className="text-xl font-bold text-slate-900">
                Digest Frequency Preferences
              </CardTitle>
            </div>
            <p className="text-sm text-slate-600 mt-2">
              {isAdmin 
                ? 'As an admin, you can view and edit digest preferences for all users. Each setting applies to all companies for that user.'
                : 'Choose how often you receive intelligence digests. This setting applies to all companies you monitor.'}
            </p>
          </CardHeader>
          <CardContent className="p-6">
            {sortedUsers.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No users found with digest preferences</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedUsers.map(user => {
                  const canEdit = isAdmin || user.email === currentUser?.email;
                  const currentFrequency = getDisplayFrequency(user.email);

                  return (
                    <div key={user.email} className="border border-slate-200 rounded-lg p-5 bg-slate-50">
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-900">{user.name}</h3>
                          <p className="text-sm text-slate-600 mb-2">{user.email}</p>
                          <p className="text-xs text-slate-500">
                            Monitoring {user.companies.length} {user.companies.length === 1 ? 'company' : 'companies'}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          {canEdit ? (
                            <Select
                              value={currentFrequency}
                              onValueChange={(value) => handleFrequencyChange(user.email, value)}
                            >
                              <SelectTrigger className="w-48">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily Digest</SelectItem>
                                <SelectItem value="weekly">Weekly Digest (Mondays)</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="text-base px-4 py-2">
                              {currentFrequency === 'daily' ? 'Daily Digest' : 'Weekly Digest'}
                            </Badge>
                          )}

                          {canEdit && hasUnsavedChanges(user.email) && (
                            <Button
                              onClick={() => savePreferences(user.email)}
                              disabled={updateCompaniesMutation.isPending}
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              {updateCompaniesMutation.isPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4 mr-2" />
                                  Save
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      {hasUnsavedChanges(user.email) && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                          This will update the digest frequency for all {user.companies.length} companies to <strong>{editedPreferences[user.email]}</strong>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}