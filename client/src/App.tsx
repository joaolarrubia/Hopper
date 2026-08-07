import { Navigate, Route, Routes } from "react-router-dom";
import { TvView } from "./views/TvView";
import { PhoneView } from "./views/PhoneView";
import { HomeView } from "./views/HomeView";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeView />} />
      <Route path="/tv" element={<TvView />} />
      <Route path="/phone" element={<PhoneView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
