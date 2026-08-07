import { Navigate, Route, Routes } from "react-router-dom";
import { TvView } from "./views/TvView";
import { PhoneView } from "./views/PhoneView";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/tv" replace />} />
      <Route path="/tv" element={<TvView />} />
      <Route path="/phone" element={<PhoneView />} />
    </Routes>
  );
}
