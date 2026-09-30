import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Dashboard } from "@/pages/Dashboard";
import { MyWork } from "@/pages/MyWork";
import { CoreWork } from "@/pages/CoreWork";
import { Issues } from "@/pages/Issues";
import { IssueDetail } from "@/pages/IssueDetail";
import { Tasks } from "@/pages/Tasks";
import { TaskDetail } from "@/pages/TaskDetail";
import { Report } from "@/pages/Report";
import { Teams } from "@/pages/Teams";
import { TeamDetail } from "@/pages/TeamDetail";
import { Settings } from "@/pages/Settings";
import { Users } from "@/pages/Users";
import { Login } from "@/pages/Login";

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function ProtectedRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        {/* Primary sidebar labels */}
        <Route path="my-work" element={<MyWork />} />
        <Route path="my-task" element={<Navigate to="/my-work" replace />} />
        <Route path="reporting" element={<Report />} />
        {/* Workspace */}
        <Route path="core-work" element={<CoreWork />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="tasks/:number" element={<TaskDetail />} />
        <Route path="issues" element={<Issues />} />
        <Route path="issues/:number" element={<IssueDetail />} />
        <Route path="teams" element={<Teams />} />
        <Route path="teams/:id" element={<TeamDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route
          path="users"
          element={
            <AdminRoute>
              <Users />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
