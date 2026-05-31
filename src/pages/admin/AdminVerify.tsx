import OTPVerifyPage from "@/components/auth/OTPVerifyPage";
import { useTranslation } from "react-i18next";

const AdminVerify = () => {
  const { t } = useTranslation();
  return (
    <OTPVerifyPage
      title={t("auth.verifyIdentity")}
      loginPath="/admin/login"
      redirectMap={{
        admin: "/admin",
        super_admin: "/super-admin",
      }}
    />
  );
};

export default AdminVerify;
