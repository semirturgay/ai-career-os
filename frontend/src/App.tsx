import { BrowserRouter, HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { CaptureSuctionOverlay } from "./components/CaptureSuctionOverlay";
import { ExtensionBootstrap, ExtensionRouteSync } from "./components/ExtensionBootstrap";
import { RequireProfileLayout } from "./components/RequireProfileLayout";
import { AiProviderPage } from "./pages/AiProviderPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { DiscoverRunPage } from "./pages/DiscoverRunPage";
import { HomePage } from "./pages/HomePage";
import { JobDetailPage } from "./pages/JobDetailPage";
import { JobNewPage } from "./pages/JobNewPage";
import { JobReviewPage } from "./pages/JobReviewPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ReviewPage } from "./pages/ReviewPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WelcomePage } from "./pages/WelcomePage";
import { IS_EXTENSION } from "./lib/extensionRuntime";

const Router = IS_EXTENSION ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <Router>
      <ExtensionBootstrap>
        <CaptureSuctionOverlay />
        <ExtensionRouteSync />
        <Routes>
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/onboarding" element={<Navigate to="/onboarding/ai" replace />} />
          <Route path="/onboarding/ai" element={<AiProviderPage />} />
          <Route path="/onboarding/upload" element={<OnboardingPage />} />
          <Route path="/onboarding/review" element={<ReviewPage />} />

          <Route element={<RequireProfileLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/discover/:runId" element={<DiscoverRunPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/jobs/new" element={<JobNewPage />} />
            <Route path="/jobs/new/review" element={<JobReviewPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ExtensionBootstrap>
    </Router>
  );
}
