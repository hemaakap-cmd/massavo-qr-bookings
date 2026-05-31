import OTPLoginPage from "@/components/auth/OTPLoginPage";
import { Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

const AdminLogin = () => {
  const { t } = useTranslation();
  return (
    <OTPLoginPage
      title={t("auth.adminPortal")}
      subtitle={t("auth.adminSubtitle")}
      allowedRoles={["admin", "super_admin"]}
      verifyPath="/admin/verify"
      icon={<Shield className="w-5 h-5 text-primary flex-shrink-0" />}
    />
  );
};

export default AdminLogin;
