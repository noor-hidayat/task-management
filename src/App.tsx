import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Dashboard } from "@/pages/Dashboard";
import { MyTask } from "@/pages/MyTask";
import { CoreWork } from "@/pages/CoreWork";
import { Tasks } from "@/pages/Tasks";
import { TaskDetail } from "@/pages/TaskDetail";
import { Handover } from "@/pages/Handover";
import { Teams } from "@/pages/Teams";
import { Schedule } from "@/pages/Schedule";
import { History } from "@/pages/History";
import { Settings } from "@/pages/Settings";
import { Notes } from "@/pages/Notes";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          {/* Primary sidebar labels */}
          <Route path="my-task" element={<MyTask />} />
          <Route path="inbox" element={<Handover />} />
          <Route path="handover" element={<Navigate to="/inbox" replace />} />
          <Route path="notes" element={<Notes />} />
          <Route path="reporting" element={<History />} />
          <Route path="history" element={<History />} />
          {/* Workspace */}
          <Route path="core-work" element={<CoreWork />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="tasks/:number" element={<TaskDetail />} />
          <Route path="teams" element={<Teams />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
