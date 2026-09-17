import OTPLoginPage from "@/components/auth/OTPLoginPage";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

const StaffLogin = () => {
  const { t } = useTranslation();
  return (
    <OTPLoginPage
      title={t("auth.teamPortal")}
      subtitle={t("auth.teamPortalSubtitle")}
      allowedRoles={["super_admin", "admin", "therapist"]}
      verifyPath="/staff/verify"
      icon={<ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />}
    />
  );
};

export default StaffLogin;
