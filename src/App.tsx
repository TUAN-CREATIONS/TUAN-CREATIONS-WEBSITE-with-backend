import { Navigate, Route, Routes } from "react-router-dom";
import PublicLayout from "./layouts/PublicLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import SupportChatWidget from "./components/support/SupportChatWidget";
import FloatingWhatsAppButton from "./components/FloatingWhatsAppButton";
import AdminRoute from "./routes/AdminRoute";
import { dashboardRoutes, publicRoutes } from "./routes/appRoutes";

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<PublicLayout />}>
          {publicRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Route>

        <Route element={<DashboardLayout />}>
          {dashboardRoutes.map((route) => (
            route.path === "/admin" ? (
              <Route
                key={route.path}
                path={route.path}
                element={(
                  <AdminRoute>
                    {route.element}
                  </AdminRoute>
                )}
              />
            ) : (
              <Route key={route.path} path={route.path} element={route.element} />
            )
          ))}
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SupportChatWidget />
      <FloatingWhatsAppButton />
    </>
  );
}
