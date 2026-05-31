import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useGymContacts, GymContactFormData } from "@/hooks/useGymContacts";
import { Building2, Phone, Mail, User, Plus, Edit, Trash2, MessageSquare } from "lucide-react";
import type { DeliveryMethod } from "@/types/reporting";
import { useAuth } from "@/hooks/useAuth";
import { useCountryData } from "@/hooks/useCountry";

const AdminGymProfiles = () => {
  const { countryId } = useAuth();
  const { selectedCountry } = useCountryData(countryId);
  const { gymContacts, isLoading, createGymContact, updateGymContact, deleteGymContact } = useGymContacts();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);

  // Fetch gyms without contacts for "Add" dropdown
  const { data: gymsWithoutContacts } = useQuery({
    queryKey: ["gyms-without-contacts", gymContacts, selectedCountry?.id],
    queryFn: async () => {
      let query = supabase
        .from("gyms")
        .select("id, name, address, phone")
        .eq("is_active", true)
        .order("name");
      
      if (selectedCountry?.id) {
        query = query.eq("country_id", selectedCountry.id);
      }

      const { data: gyms, error } = await query;
      if (error) throw error;

      const existingGymIds = new Set(gymContacts?.map(c => c.gym_id) || []);
      return gyms.filter(g => !existingGymIds.has(g.id));
    },
    enabled: !isLoading,
  });

  const handleOpenForm = (contact?: any) => {
    if (contact) {
      setEditingContact(contact);
    } else {
      setEditingContact(null);
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingContact(null);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this gym profile?")) {
      await deleteGymContact.mutateAsync(id);
    }
  };

  const getChannelBadge = (channel: DeliveryMethod) => {
    switch (channel) {
      case "email":
        return <Badge variant="secondary"><Mail className="w-3 h-3 mr-1" />Email</Badge>;
      case "whatsapp":
        return <Badge variant="secondary" className="bg-green-50 text-green-700"><MessageSquare className="w-3 h-3 mr-1" />WhatsApp</Badge>;
      default:
        return <Badge variant="secondary">Both</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Gym Administrative Profiles</h1>
            <p className="text-muted-foreground mt-1">
              Manage contact information and delivery preferences for each gym partner
            </p>
          </div>
          <Button onClick={() => handleOpenForm()} disabled={!gymsWithoutContacts?.length}>
            <Plus className="w-4 h-4 mr-2" />
            Add Gym Profile
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Gym Profiles</CardTitle>
            <CardDescription>
              {gymContacts?.length || 0} profiles configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gym</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Deputy Manager</TableHead>
                    <TableHead>Preferred Channel</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gymContacts?.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{contact.gyms?.name}</div>
                            <div className="text-sm text-muted-foreground">{contact.gyms?.address}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.manager_name ? (
                          <div>
                            <div className="font-medium flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {contact.manager_name}
                            </div>
                            {contact.manager_email && (
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Mail className="w-3 h-3" />{contact.manager_email}
                              </div>
                            )}
                            {contact.manager_phone && (
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />{contact.manager_phone}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.deputy_manager_name ? (
                          <div>
                            <div className="font-medium flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {contact.deputy_manager_name}
                            </div>
                            {contact.deputy_manager_email && (
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Mail className="w-3 h-3" />{contact.deputy_manager_email}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getChannelBadge(contact.preferred_delivery_channel)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenForm(contact)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(contact.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!gymContacts || gymContacts.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No gym profiles configured yet. Add your first gym profile to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Form Dialog */}
        <GymContactFormDialog
          open={isFormOpen}
          onClose={handleCloseForm}
          editingContact={editingContact}
          gymsWithoutContacts={gymsWithoutContacts || []}
          onSave={async (data) => {
            if (editingContact) {
              await updateGymContact.mutateAsync({ id: editingContact.id, ...data });
            } else {
              await createGymContact.mutateAsync(data);
            }
            handleCloseForm();
          }}
          isSaving={createGymContact.isPending || updateGymContact.isPending}
        />
      </div>
    </AdminLayout>
  );
};

interface GymContactFormDialogProps {
  open: boolean;
  onClose: () => void;
  editingContact: any;
  gymsWithoutContacts: { id: string; name: string }[];
  onSave: (data: GymContactFormData) => Promise<void>;
  isSaving: boolean;
}

const GymContactFormDialog = ({ 
  open, 
  onClose, 
  editingContact, 
  gymsWithoutContacts,
  onSave,
  isSaving 
}: GymContactFormDialogProps) => {
  const [formData, setFormData] = useState<GymContactFormData>({
    gym_id: editingContact?.gym_id || "",
    manager_name: editingContact?.manager_name || "",
    manager_email: editingContact?.manager_email || "",
    manager_phone: editingContact?.manager_phone || "",
    deputy_manager_name: editingContact?.deputy_manager_name || "",
    deputy_manager_email: editingContact?.deputy_manager_email || "",
    deputy_manager_phone: editingContact?.deputy_manager_phone || "",
    preferred_delivery_channel: editingContact?.preferred_delivery_channel || "email",
    notes: editingContact?.notes || "",
  });

  // Reset form when dialog opens/closes
  useState(() => {
    if (open) {
      setFormData({
        gym_id: editingContact?.gym_id || "",
        manager_name: editingContact?.manager_name || "",
        manager_email: editingContact?.manager_email || "",
        manager_phone: editingContact?.manager_phone || "",
        deputy_manager_name: editingContact?.deputy_manager_name || "",
        deputy_manager_email: editingContact?.deputy_manager_email || "",
        deputy_manager_phone: editingContact?.deputy_manager_phone || "",
        preferred_delivery_channel: editingContact?.preferred_delivery_channel || "email",
        notes: editingContact?.notes || "",
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingContact ? "Edit Gym Profile" : "Add Gym Profile"}
          </DialogTitle>
          <DialogDescription>
            Configure contact information and delivery preferences
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Gym Selection (only for new) */}
          {!editingContact && (
            <div className="space-y-2">
              <Label>Select Gym</Label>
              <Select
                value={formData.gym_id}
                onValueChange={(v) => setFormData({ ...formData, gym_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a gym" />
                </SelectTrigger>
                <SelectContent>
                  {gymsWithoutContacts.map((gym) => (
                    <SelectItem key={gym.id} value={gym.id}>
                      {gym.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Manager Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Manager</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="manager_name">Name</Label>
                <Input
                  id="manager_name"
                  value={formData.manager_name}
                  onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                  placeholder="Manager name"
                />
              </div>
              <div>
                <Label htmlFor="manager_email">Email</Label>
                <Input
                  id="manager_email"
                  type="email"
                  value={formData.manager_email}
                  onChange={(e) => setFormData({ ...formData, manager_email: e.target.value })}
                  placeholder="manager@gym.com"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="manager_phone">Phone</Label>
                <Input
                  id="manager_phone"
                  type="tel"
                  value={formData.manager_phone}
                  onChange={(e) => setFormData({ ...formData, manager_phone: e.target.value })}
                  placeholder="+49 123 456789"
                />
              </div>
            </div>
          </div>

          {/* Deputy Manager Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Deputy Manager (Optional)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="deputy_name">Name</Label>
                <Input
                  id="deputy_name"
                  value={formData.deputy_manager_name}
                  onChange={(e) => setFormData({ ...formData, deputy_manager_name: e.target.value })}
                  placeholder="Deputy name"
                />
              </div>
              <div>
                <Label htmlFor="deputy_email">Email</Label>
                <Input
                  id="deputy_email"
                  type="email"
                  value={formData.deputy_manager_email}
                  onChange={(e) => setFormData({ ...formData, deputy_manager_email: e.target.value })}
                  placeholder="deputy@gym.com"
                />
              </div>
            </div>
          </div>

          {/* Delivery Channel */}
          <div className="space-y-2">
            <Label>Preferred Delivery Channel</Label>
            <Select
              value={formData.preferred_delivery_channel}
              onValueChange={(v) => setFormData({ ...formData, preferred_delivery_channel: v as DeliveryMethod })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || (!editingContact && !formData.gym_id)}>
              {isSaving ? "Saving..." : "Save Profile"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminGymProfiles;
