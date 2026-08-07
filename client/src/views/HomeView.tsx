import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export function HomeView() {
  return (
    <main className="home-shell">
      <div className="home-bg home-bg-a" />
      <div className="home-bg home-bg-b" />
      <motion.section
        className="home-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
      >
        <p className="eyebrow">Dual-Screen Party Flight Game</p>
        <h1>Hopper</h1>
        <p>
          One screen runs the globe theater. Phones run sector launchpads. Draw routes, pass flights,
          and race for score before the round clock runs out.
        </p>
        <div className="home-actions">
          <Link to="/tv" className="home-button primary">
            Host on Big Screen
          </Link>
          <Link to="/phone" className="home-button secondary">
            Join from Phone
          </Link>
        </div>
      </motion.section>
    </main>
  );
}
