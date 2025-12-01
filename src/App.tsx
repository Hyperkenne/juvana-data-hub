import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { Navbar } from "./components/Navbar";

import Landing from "./pages/Landing";
import Competitions from "./pages/Competitions";
import CompetitionDetail from "./pages/CompetitionDetail";
import Dashboard from "./pages/Dashboard";
import SubmissionHistory from "./pages/SubmissionHistory";
import NotificationPreferences from "./pages/NotificationPreferences";
import NotFound from "./pages/NotFound";

// ✅ Import your new dataset pages
import Datasets from "./pages/Datasets";
import DatasetDetail from "./pages/DatasetDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>

            {/* Public routes with navbar */}
            <Route path="/" element={<><Navbar /><Landing /></>} />
            <Route path="/competitions" element={<><Navbar /><Competitions /></>} />
            <Route path="/competition/:id" element={<><Navbar /><CompetitionDetail /></>} />

            {/* ✅ NEW DATASET ROUTES */}
            <Route path="/datasets" element={<><Navbar /><Datasets /></>} />
            <Route path="/datasets/:id" element={<><Navbar /><DatasetDetail /></>} />

            <Route path="/dashboard" element={<><Navbar /><Dashboard /></>} />
            <Route path="/submissions" element={<><Navbar /><SubmissionHistory /></>} />
            <Route path="/preferences" element={<><Navbar /><NotificationPreferences /></>} />
            <Route path="*" element={<><Navbar /><NotFound /></>} />

          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
