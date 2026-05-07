import { Navigate, Route, Routes } from "react-router-dom";
import PublicLayout from "./layouts/PublicLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import HomePage from "./public/home/HomePage";
import AboutPage from "./public/about/AboutPage";
import ManagementTeam from "./public/about/ManagementTeam";
import DivisionsPage from "./public/divisions/DivisionsPage";
import BlogPage from "./public/blog/BlogPage";
import ContactPage from "./public/contact/ContactPage";
import AuthPage from "./modules/auth/AuthPage";
import AdminLoginPage from "./modules/auth/AdminLoginPage";
import DashboardPage from "./modules/dashboard/DashboardPage";
import AcademyPage from "./modules/academy/AcademyPage";
import CoursePage from "./modules/academy/CoursePage";
import EnrolledCoursesPage from "./modules/academy/EnrolledCoursesPage";
import CertificatePage from "./modules/academy/CertificatePage";
import InstructorDashboard from "./modules/academy/InstructorDashboard";
import CourseManagement from "./modules/academy/CourseManagement";
import ForumPage from "./modules/academy/ForumPage";
import NotificationCenter from "./modules/academy/NotificationCenter";
import QuizPage from "./modules/academy/QuizPage";
import StudyGroupBrowser from "./modules/academy/StudyGroupBrowser";
import MentorshipFinder from "./modules/academy/MentorshipFinder";
import AnalyticsDashboard from "./modules/academy/AnalyticsDashboard";
import MarketplacePage from "./modules/marketplace/MarketplacePage";
import ListingDetail from "./modules/marketplace/ListingDetail";
import CreateListing from "./modules/marketplace/CreateListing";
import ProviderDashboard from "./modules/marketplace/ProviderDashboard";
import ProviderOnboarding from "./modules/marketplace/ProviderOnboarding";
import VerificationAdmin from "./modules/marketplace/VerificationAdmin";
import AdvancedSearch from "./modules/marketplace/AdvancedSearch";
import MarketplaceAnalytics from "./modules/marketplace/MarketplaceAnalytics";
import DisputeAdmin from "./modules/marketplace/DisputeAdmin";
import CommissionAdmin from "./modules/marketplace/CommissionAdmin";
import PayoutAdmin from "./modules/marketplace/PayoutAdmin";
import FraudDetectionDashboard from "./modules/marketplace/FraudDetectionDashboard";
import AuditLogsViewer from "./modules/marketplace/AuditLogsViewer";
import MediaPage from "./modules/media/MediaPage";
import CollaborationPage from "./modules/collaboration/CollaborationPage";
import IotPage from "./modules/iot/IotPage";
import AdminPage from "./modules/admin/AdminPage";
import LiveSessionPage from "./pages/LiveSessionPage";
import FloatingWhatsAppButton from "./components/FloatingWhatsAppButton";
import { useAuth } from "./store/auth";

function AdminRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/about/management-team" element={<ManagementTeam />} />
          <Route path="/divisions" element={<DivisionsPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
        </Route>

        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/academy" element={<AcademyPage />} />
          <Route path="/academy/my-courses" element={<EnrolledCoursesPage />} />
          <Route path="/course/:courseId" element={<CoursePage />} />
          <Route path="/course/:courseId/forum" element={<ForumPage />} />
          <Route path="/course/:courseId/quizzes" element={<QuizPage />} />
          <Route path="/course/:courseId/study-groups" element={<StudyGroupBrowser />} />
          <Route path="/certificates" element={<CertificatePage />} />
          <Route path="/instructor-dashboard" element={<InstructorDashboard />} />
          <Route path="/academy/create-course" element={<CourseManagement />} />
          <Route path="/academy/edit-course/:courseId" element={<CourseManagement />} />
          <Route path="/notifications" element={<NotificationCenter />} />
          <Route path="/academy/mentorship" element={<MentorshipFinder />} />
          <Route path="/admin/academy/analytics" element={<AnalyticsDashboard />} />
          <Route path="/live-session" element={<LiveSessionPage />} />
          <Route path="/marketplace" element={<MarketplacePage />} />
          <Route path="/marketplace/search" element={<AdvancedSearch />} />
          <Route path="/marketplace/listing/:listingId" element={<ListingDetail />} />
          <Route path="/marketplace/create" element={<CreateListing />} />
          <Route path="/marketplace/provider" element={<ProviderDashboard />} />
          <Route path="/marketplace/onboarding" element={<ProviderOnboarding />} />
          <Route path="/marketplace/verification-admin" element={<VerificationAdmin />} />
          <Route path="/marketplace/analytics" element={<MarketplaceAnalytics />} />
          <Route path="/marketplace/disputes" element={<DisputeAdmin />} />
          <Route path="/marketplace/commissions" element={<CommissionAdmin />} />
          <Route path="/marketplace/payouts" element={<PayoutAdmin />} />
          <Route path="/marketplace/fraud-detection" element={<FraudDetectionDashboard />} />
          <Route path="/marketplace/audit-logs" element={<AuditLogsViewer />} />
          <Route path="/media" element={<MediaPage />} />
          <Route path="/collaboration" element={<CollaborationPage />} />
          <Route path="/iot" element={<IotPage />} />
          <Route
            path="/admin"
            element={(
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            )}
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <FloatingWhatsAppButton />
    </>
  );
}
