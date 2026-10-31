import { Route, Routes } from "react-router-dom";
import { Header } from "./components/Header.tsx";
import { Home } from "./pages/Home.tsx";
import { Talk } from "./pages/Talk.tsx";
import { SessionDetail } from "./pages/SessionDetail.tsx";
import { Journal } from "./pages/Journal.tsx";

export function App() {
  return (
    <div className="app">
      <div className="bg-glow" aria-hidden />
      <Header />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/talk/:modeId" element={<Talk />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <footer className="footer">
        <span>Disha is an AI coach, not a therapist. In crisis? In India call Tele-MANAS <b>14416</b> or your local emergency number.</span>
        <span className="footer-powered">Voice by Bolna AI</span>
      </footer>
    </div>
  );
}
