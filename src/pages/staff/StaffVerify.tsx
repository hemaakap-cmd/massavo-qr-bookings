import OTPVerifyPage from "@/components/auth/OTPVerifyPage";
import { useTranslation } from "react-i18next";

const StaffVerify = () => {
  const { t } = useTranslation();
  return (
    <OTPVerifyPage
      title={t("auth.verifyIdentity")}
      loginPath="/staff/login"
      redirectMap={{
        therapist: "/staff/dashboard",
      }}
    />
  );
};

export default StaffVerify;
