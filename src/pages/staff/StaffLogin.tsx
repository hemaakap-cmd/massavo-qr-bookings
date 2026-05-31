import OTPLoginPage from "@/components/auth/OTPLoginPage";
import { UserCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

const StaffLogin = () => {
  const { t } = useTranslation();
  return (
    <OTPLoginPage
      title={t("auth.staffPortal")}
      subtitle={t("auth.staffSubtitle")}
      allowedRoles={["therapist"]}
      verifyPath="/staff/verify"
      icon={<UserCheck className="w-5 h-5 text-primary flex-shrink-0" />}
    />
  );
};

export default StaffLogin;
