import { useState } from "react";
import { useNavigate } from "react-router";
import { finishWelcome, locateStart } from "../state/appState";
import { Button } from "../ui/Controls";
import { WelcomeHero } from "./welcome/WelcomeHero";
import "./welcome/welcome.css";

/** First launch: the pitch and the location ask, with a typed fallback (Views/WelcomeView.swift). */
export default function WelcomeScreen() {
  const navigate = useNavigate();
  const [isLocating, setIsLocating] = useState(false);

  const leave = () => {
    finishWelcome();
    navigate("/", { replace: true });
  };

  const locate = async () => {
    setIsLocating(true);
    // Today shows the typed prompt if location is refused or unavailable.
    await locateStart();
    setIsLocating(false);
    leave();
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-scroll scroll-y">
        <WelcomeHero />
        <div className="welcome-text">
          {/* Two hair spaces keep the italic y's tail off the upright "?". */}
          <h1 className="welcome-question t-large-title">
            Where should you fish <span className="welcome-today">today</span>
            {"\u200A\u200A?"}
          </h1>
          <p className="welcome-pitch t-body">Nearest spots, ready to fish. Prep and learn before you go.</p>
        </div>
      </div>
      <div className="welcome-actions">
        <Button variant="primary" loading={isLocating} onClick={locate}>
          Use my location
        </Button>
        <Button variant="plain" onClick={leave}>
          Enter a city or ZIP instead
        </Button>
      </div>
    </div>
  );
}
