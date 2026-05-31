import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { User, Phone, MapPin, Calendar, Mail, Home, Hash, Building, ShieldAlert, MessageSquare } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";

export interface ClientInfo {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  salutation: "Herr" | "Frau" | "";
  phone: string;
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  healthConfirmed: boolean;
  isPregnant?: boolean | null;
  notes?: string;
}

interface ClientInfoFormProps {
  clientInfo: ClientInfo;
  onChange: (info: ClientInfo) => void;
}

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPostalCode = (code: string): boolean => {
  return /^\d{5}$/.test(code);
};

const isValidPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 6;
};

const isValidDateOfBirth = (dob: string): boolean => {
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(dob)) return false;
  const [day, month, year] = dob.split('.').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return false;
  }
  const age = calculateAge(dob);
  return age >= 18 && age <= 120;
};

export const calculateAge = (dob: string): number => {
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(dob)) return 0;
  const [day, month, year] = dob.split('.').map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export const inferGender = (salutation: string): "male" | "female" | null => {
  if (salutation === "Herr") return "male";
  if (salutation === "Frau") return "female";
  return null;
};

const formatDateInput = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4, 8)}`;
};

const ClientInfoForm = ({ clientInfo, onChange }: ClientInfoFormProps) => {
  const { t } = useTranslation();

  const updateField = (field: keyof ClientInfo, value: string | boolean | null) => {
    const updated = { ...clientInfo, [field]: value };
    if (field === "salutation" && value !== "Frau") {
      updated.isPregnant = null;
    }
    onChange(updated);
  };

  const emailError = clientInfo.email && !isValidEmail(clientInfo.email);
  const postalCodeError = clientInfo.postalCode && !isValidPostalCode(clientInfo.postalCode);
  const phoneError = clientInfo.phone && !isValidPhone(clientInfo.phone);
  const dobError = clientInfo.dateOfBirth && clientInfo.dateOfBirth.length === 10 && !isValidDateOfBirth(clientInfo.dateOfBirth);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
          {t("clientForm.title")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("clientForm.subtitle")}
        </p>
      </div>

      <div className="space-y-4">
        {/* Salutation */}
        <div className="space-y-2">
          <Label htmlFor="salutation" className="flex items-center gap-2 text-foreground">
            <User className="w-4 h-4 text-primary" />
            {t("clientForm.salutation")} *
          </Label>
          <Select
            value={clientInfo.salutation}
            onValueChange={(value) => updateField("salutation", value as "Herr" | "Frau")}
          >
            <SelectTrigger className="bg-background/50 border-border/50 focus:border-primary">
              <SelectValue placeholder={t("clientForm.salutationPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Herr">{t("clientForm.mr")}</SelectItem>
              <SelectItem value="Frau">{t("clientForm.mrs")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Name Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="flex items-center gap-2 text-foreground">
              {t("clientForm.firstName")} *
            </Label>
            <Input
              id="firstName"
              type="text"
              placeholder={t("clientForm.firstNamePlaceholder")}
              value={clientInfo.firstName}
              onChange={(e) => updateField("firstName", e.target.value)}
              className="bg-background/50 border-border/50 focus:border-primary"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="flex items-center gap-2 text-foreground">
              {t("clientForm.lastName")} *
            </Label>
            <Input
              id="lastName"
              type="text"
              placeholder={t("clientForm.lastNamePlaceholder")}
              value={clientInfo.lastName}
              onChange={(e) => updateField("lastName", e.target.value)}
              className="bg-background/50 border-border/50 focus:border-primary"
              required
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-2 text-foreground">
            <Mail className="w-4 h-4 text-primary" />
            {t("clientForm.email")} *
          </Label>
          <Input
            id="email"
            type="email"
            placeholder={t("clientForm.emailPlaceholder")}
            value={clientInfo.email}
            onChange={(e) => updateField("email", e.target.value)}
            className={`bg-background/50 border-border/50 focus:border-primary ${
              emailError ? "border-destructive focus:border-destructive" : ""
            }`}
            required
          />
          {emailError && (
            <p className="text-xs text-destructive">{t("clientForm.emailError")}</p>
          )}
        </div>

        {/* Date of Birth */}
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth" className="flex items-center gap-2 text-foreground">
            <Calendar className="w-4 h-4 text-primary" />
            {t("clientForm.dob")} *
          </Label>
          <Input
            id="dateOfBirth"
            type="text"
            placeholder={t("clientForm.dobPlaceholder")}
            value={clientInfo.dateOfBirth}
            onChange={(e) => {
              const formatted = formatDateInput(e.target.value);
              updateField("dateOfBirth", formatted);
            }}
            maxLength={10}
            className={`bg-background/50 border-border/50 focus:border-primary ${
              dobError ? "border-destructive focus:border-destructive" : ""
            }`}
            required
          />
          {dobError && (
            <p className="text-xs text-destructive">{t("clientForm.dobError")}</p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-2 text-foreground">
            <Phone className="w-4 h-4 text-primary" />
            {t("clientForm.phone")} *
          </Label>
          <Input
            id="phone"
            type="tel"
            placeholder={t("clientForm.phonePlaceholder")}
            value={clientInfo.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            className={`bg-background/50 border-border/50 focus:border-primary ${
              phoneError ? "border-destructive focus:border-destructive" : ""
            }`}
            required
          />
          {phoneError && (
            <p className="text-xs text-destructive">{t("clientForm.phoneError")}</p>
          )}
        </div>

        {/* Address Section */}
        <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border/50">
          <div className="flex items-center gap-2 text-foreground font-medium mb-2">
            <MapPin className="w-4 h-4 text-primary" />
            {t("clientForm.address")} *
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="street" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Home className="w-3 h-3" />
                {t("clientForm.street")}
              </Label>
              <Input
                id="street"
                type="text"
                placeholder={t("clientForm.streetPlaceholder")}
                value={clientInfo.street}
                onChange={(e) => updateField("street", e.target.value)}
                className="bg-background/50 border-border/50 focus:border-primary"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="houseNumber" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Hash className="w-3 h-3" />
                {t("clientForm.houseNumber")}
              </Label>
              <Input
                id="houseNumber"
                type="text"
                placeholder="123"
                value={clientInfo.houseNumber}
                onChange={(e) => updateField("houseNumber", e.target.value)}
                className="bg-background/50 border-border/50 focus:border-primary"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="postalCode" className="text-sm text-muted-foreground">
                {t("clientForm.postalCode")}
              </Label>
              <Input
                id="postalCode"
                type="text"
                placeholder="12345"
                maxLength={5}
                value={clientInfo.postalCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 5);
                  updateField("postalCode", value);
                }}
                className={`bg-background/50 border-border/50 focus:border-primary ${
                  postalCodeError ? "border-destructive focus:border-destructive" : ""
                }`}
                required
              />
              {postalCodeError && (
                <p className="text-xs text-destructive">{t("clientForm.postalCodeError")}</p>
              )}
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="city" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building className="w-3 h-3" />
                {t("clientForm.city")}
              </Label>
              <Input
                id="city"
                type="text"
                placeholder={t("clientForm.cityPlaceholder")}
                value={clientInfo.city}
                onChange={(e) => updateField("city", e.target.value)}
                className="bg-background/50 border-border/50 focus:border-primary"
                required
              />
            </div>
          </div>
        </div>

        {/* Pregnancy Question */}
        {clientInfo.salutation === "Frau" && (
          <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border/50">
            <Label className="flex items-center gap-2 text-foreground font-medium mb-3">
              <ShieldAlert className="w-4 h-4 text-primary" />
              {t("clientForm.pregnancyQuestion")} *
            </Label>
            <RadioGroup
              value={clientInfo.isPregnant === true ? "yes" : clientInfo.isPregnant === false ? "no" : ""}
              onValueChange={(value) => updateField("isPregnant", value === "yes")}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="not-pregnant" />
                <Label htmlFor="not-pregnant" className="cursor-pointer text-sm">{t("clientForm.no")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="is-pregnant" />
                <Label htmlFor="is-pregnant" className="cursor-pointer text-sm">{t("clientForm.yes")}</Label>
              </div>
            </RadioGroup>
            {clientInfo.isPregnant === true && (
              <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ {t("clientForm.pregnancyWarning")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientInfoForm;
