import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Login       from './pages/auth/Login';
import Onboarding  from './pages/auth/Onboarding';

import CoachDashboard from './pages/coach/Dashboard';
import CoachMember    from './pages/coach/Member';
import Builder        from './pages/coach/Builder';
import ExcelImport    from './pages/coach/Import';

import MemberDashboard from './pages/membre/Dashboard';
import MemberProgramme from './pages/membre/Programme';
import SessionLogger   from './pages/membre/Logger';
import Historique      from './pages/membre/Historique';
import Progression     from './pages/membre/Progression';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/"              element={<Login />} />
        <Route path="/onboarding/:step" element={<Onboarding />} />

        {/* Coach */}
        <Route path="/coach"         element={<CoachDashboard />} />
        <Route path="/coach/membre"  element={<CoachMember />} />
        <Route path="/coach/builder" element={<Builder />} />
        <Route path="/coach/import"  element={<ExcelImport />} />
        <Route path="/coach/messages" element={<CoachDashboard />} />

        {/* Membre */}
        <Route path="/membre"              element={<MemberDashboard />} />
        <Route path="/membre/programme"    element={<MemberProgramme />} />
        <Route path="/membre/logger"       element={<SessionLogger />} />
        <Route path="/membre/historique"   element={<Historique />} />
        <Route path="/membre/progression"  element={<Progression />} />
        <Route path="/membre/profil"       element={<MemberDashboard />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
