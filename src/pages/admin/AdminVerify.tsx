import OTPVerifyPage from "@/components/auth/OTPVerifyPage";
import { useTranslation } from "react-i18next";

const AdminVerify = () => {
  const { t } = useTranslation();
  return (
    <OTPVerifyPage
      title={t("auth.verifyIdentity")}
      loginPath="/admin/login"
      redirectMap={{
        super_admin: "/super-admin",
        admin: "/admin",
        therapist: "/staff/dashboard",
      }}
    />
  );
};

export default AdminVerify;
