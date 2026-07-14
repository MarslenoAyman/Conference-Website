import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Navbar from "./components/Navbar.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Home from "./pages/Home.jsx";
import Instructions from "./pages/Instructions.jsx";
import Timeline from "./pages/Timeline.jsx";
import Topics from "./pages/Topics.jsx";
import Games from "./pages/Games.jsx";
import GameDetail from "./pages/GameDetail.jsx";
import Teams from "./pages/Teams.jsx";
import Bonuses from "./pages/Bonuses.jsx";
import Settings from "./pages/Settings.jsx";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function FullOnly({ children }) {
  const { user } = useAuth();
  if (user?.role !== "full") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading-screen">Loading…</div>;

  return (
    <div className="app-shell">
      {user && <Navbar />}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/signup" element={user ? <Navigate to="/" replace /> : <Signup />} />
        <Route
          path="/"
          element={
            <Protected>
              <Home />
            </Protected>
          }
        />
        <Route
          path="/instructions"
          element={
            <Protected>
              <Instructions />
            </Protected>
          }
        />
        <Route
          path="/timeline"
          element={
            <Protected>
              <Timeline />
            </Protected>
          }
        />
        <Route
          path="/topics"
          element={
            <Protected>
              <Topics />
            </Protected>
          }
        />
        <Route
          path="/games"
          element={
            <Protected>
              <Games />
            </Protected>
          }
        />
        <Route
          path="/games/:id"
          element={
            <Protected>
              <GameDetail />
            </Protected>
          }
        />
        <Route
          path="/teams"
          element={
            <Protected>
              <Teams />
            </Protected>
          }
        />
        <Route
          path="/bonuses"
          element={
            <Protected>
              <FullOnly>
                <Bonuses />
              </FullOnly>
            </Protected>
          }
        />
        <Route
          path="/settings"
          element={
            <Protected>
              <Settings />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
