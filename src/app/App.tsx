import { useState, useEffect } from "react";
import { Routes, Route, useNavigate, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { SignupPage } from "@/app/components/Signuppage";
import { LandingPage } from "@/app/components/LandingPage";
import { LoginPage } from "@/app/components/LoginPage";
import { ForgetPasswordPage } from "@/app/components/ForgetPasswordPage";
import { VerifyOTPPage } from "@/app/components/VerifyOTPPage";
import { ResetPasswordPage } from "@/app/components/ResetPasswordPage";
import { DashboardPage } from "@/app/components/DashboardPage";
import { UploadExcelPage } from "@/app/components/UploadExcelPage";
import { UploadTemplatePage } from "@/app/components/UploadTemplatePage";
import {
  NamePlacementEditor,
  ImageConfig,
} from "@/app/components/NamePlacementEditor";
import {
  MergeSettingsPage,
  MergeSettings,
} from "@/app/components/MergeSettingsPage";
import { PaymentPage } from "@/app/components/PaymentPage";
import { ProcessingPage } from "@/app/components/ProcessingPage";
import { NamePreviewPage } from "@/app/components/NamePreviewPage";
import apiCall from "@/app/utils/api";

/* ---------------- PAGE TYPE ---------------- */

type Page =
  | "landing"
  | "login"
  | "signup"
  | "forget-password"
  | "verify-otp"
  | "reset-password"
  | "dashboard"
  | "upload-excel"
  | "upload-template"
  | "name-placement"
  | "name-preview"
  | "merge-settings"
  | "payment"
  | "processing";

/* ---------------- DATA TYPE ---------------- */

interface ProjectData {
  names: string[];
  pdfPages: string[];
  imageConfigs?: ImageConfig[];
  mergeSettings?: MergeSettings;
  selectedPlan?: string;
}

/* ---------------- APP ---------------- */

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, login, logout, loading } = useAuth();
  const [projectData, setProjectData] = useState<ProjectData>({
    names: [],
    pdfPages: [],
  });
  const [resetEmail, setResetEmail] = useState<string | null>(() => {
    return localStorage.getItem('resetEmail');
  });
  const [resetFlowStep, setResetFlowStep] = useState<
    'none' | 'otp-sent' | 'otp-verified'
  >(() => {
    const step = localStorage.getItem('resetFlowStep') as
      | 'none'
      | 'otp-sent'
      | 'otp-verified'
      | null;
    if (step) return step;
    return localStorage.getItem('resetEmail') ? 'otp-sent' : 'none';
  });

  useEffect(() => {
    const flowPaths = ['/forget-password', '/verify-otp', '/reset-password'];
    if (!flowPaths.includes(location.pathname)) {
      localStorage.removeItem('resetEmail');
      localStorage.removeItem('resetFlowStep');
      localStorage.removeItem('otpExpireAt');
      sessionStorage.removeItem('otpVerified');
      setResetEmail(null);
      setResetFlowStep('none');
    }
  }, [location.pathname]);



  /* -------- FLOW HANDLERS -------- */

  const handleCreateNew = () => {
    setProjectData({ names: [], pdfPages: [] });
    navigate("/upload-excel");
  };

  const handleExcelUpload = (names: string[]) => {
    setProjectData((prev) => ({ ...prev, names }));
    navigate("/upload-template");
  };

  const handlePdfUpload = (pdfPages: string[]) => {
    setProjectData((prev) => ({ ...prev, pdfPages }));
    navigate("/name-placement");
  };

  const handleNamePlacement = (imageConfigs: ImageConfig[]) => {
    setProjectData((prev) => ({ ...prev, imageConfigs }));
    navigate("/name-preview");
  };

  const handleNamePreview = () => {
    navigate("/merge-settings");
  };

  const handleMergeSettings = (mergeSettings: MergeSettings) => {
    setProjectData((prev) => ({ ...prev, mergeSettings }));
    navigate("/payment");
  };

  const handlePayment = (selectedPlan: string) => {
    setProjectData((prev) => ({ ...prev, selectedPlan }));
    navigate("/processing");
  };

  const handleLogin = (token: string, user: { id: string; email: string }) => {
    login(token, user);
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const handleForgetPassword = async (email: string) => {
    try {
      const response = await fetch("http://localhost:5000/api/auth/forgot-password/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        sessionStorage.removeItem('otpVerified');
        // Store email in localStorage for OTP verification
        localStorage.setItem('resetEmail', email);
        setResetEmail(email);
        localStorage.setItem('resetFlowStep', 'otp-sent');
        // store OTP expiry timestamp (2 minutes from now) so timer survives refresh
        localStorage.setItem('otpExpireAt', String(Date.now() + 120000));
        setResetFlowStep('otp-sent');
        navigate("/verify-otp", { replace: true });
      } else {
        alert(data.error || data.message);
      }
    } catch (error) {
      alert("Network error. Please try again.");
    }
  };

  const handleVerifyOTP = async (otp: string) => {
    const email = resetEmail || localStorage.getItem('resetEmail');
    if (!email) {
      alert("Email not found. Please try again.");
      navigate("/forget-password", { replace: true });
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/api/auth/forgot-password/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('resetFlowStep', 'otp-verified');
        setResetFlowStep('otp-verified');
        sessionStorage.setItem('otpVerified', 'true');
        // also pass email in navigation state as a fallback
        navigate("/reset-password", { replace: true, state: { from: 'verify-otp', email } });
      } else {
        alert(data.error || data.message);
      }
    } catch (error) {
      alert("Network error. Please try again.");
    }
  };

  const handleResetPassword = async (password: string) => {
    const email = resetEmail || localStorage.getItem('resetEmail');
    if (!email) {
      alert("Email not found. Please try again.");
      navigate("/forget-password", { replace: true });
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/api/auth/forgot-password/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, newPassword: password }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Password reset successfully! Please login with your new password.");
        sessionStorage.removeItem('otpVerified');
        localStorage.removeItem('resetEmail');
        localStorage.removeItem('resetFlowStep');
        localStorage.removeItem('otpExpireAt');
        setResetEmail(null);
        setResetFlowStep('none');
        window.location.replace('/login');
      } else {
        alert(data.error || data.message);
      }
    } catch (error) {
      alert("Network error. Please try again.");
    }
  };

  const enabledPagesCount =
    projectData.imageConfigs?.filter((c) => c.enabled).length || 0;

  /* ---------------- RENDER ---------------- */

  if (loading) {
    return <div>Loading...</div>; // Or a proper loading component
  }

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={handleLogin} />} />
      <Route path="/signup" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <SignupPage />} />
      <Route path="/forget-password" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgetPasswordPage onNext={handleForgetPassword} onBack={() => navigate("/login")} />} />
      <Route
        path="/verify-otp"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : !localStorage.getItem('resetEmail') ? (
            <Navigate to="/login" replace />
          ) : localStorage.getItem('resetFlowStep') === 'otp-sent' ? (
            <VerifyOTPPage onNext={handleVerifyOTP} onBack={() => navigate("/forget-password")} />
          ) : localStorage.getItem('resetFlowStep') === 'otp-verified' ? (
            <Navigate to="/reset-password" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/reset-password"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : localStorage.getItem('resetFlowStep') === 'otp-verified' &&
            Boolean(localStorage.getItem('resetEmail')) ? (
            <ResetPasswordPage onNext={handleResetPassword} onBack={() => navigate(-1)} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/dashboard" element={isAuthenticated ? <DashboardPage onCreateNew={handleCreateNew} onLogout={handleLogout} userEmail={user?.email || ''} userId={user?.id || ''} /> : <Navigate to="/login" replace />} />
      <Route path="/upload-excel" element={isAuthenticated ? <UploadExcelPage onNext={handleExcelUpload} onBack={() => navigate('/dashboard')} /> : <Navigate to="/login" replace />} />
      <Route path="/upload-template" element={isAuthenticated ? <UploadTemplatePage onNext={handlePdfUpload} onBack={() => navigate('/upload-excel')} /> : <Navigate to="/login" replace />} />
      <Route path="/name-placement" element={isAuthenticated ? (projectData.pdfPages.length > 0 ? <NamePlacementEditor pdfs={projectData.pdfPages} names={projectData.names} onNext={handleNamePlacement} onBack={() => navigate('/upload-template')} /> : null) : <Navigate to="/login" replace />} />
      <Route path="/name-preview" element={isAuthenticated ? (projectData.imageConfigs ? <NamePreviewPage names={projectData.names} pdfs={projectData.pdfPages} imageConfigs={projectData.imageConfigs} onNext={handleNamePreview} onBack={() => navigate('/name-placement')} /> : null) : <Navigate to="/login" replace />} />
      <Route path="/merge-settings" element={isAuthenticated ? <MergeSettingsPage namesCount={projectData.names.length} pageCount={enabledPagesCount} onNext={handleMergeSettings} onBack={() => navigate('/name-preview')} /> : <Navigate to="/login" replace />} />
      <Route path="/payment" element={isAuthenticated ? <PaymentPage namesCount={projectData.names.length} onNext={handlePayment} onBack={() => navigate('/merge-settings')} /> : <Navigate to="/login" replace />} />
      <Route path="/processing" element={isAuthenticated ? <ProcessingPage names={projectData.names} pdfs={projectData.pdfPages} imageConfigs={projectData.imageConfigs || []} onComplete={() => navigate('/dashboard')} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}
