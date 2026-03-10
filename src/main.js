/**
 * main.js — Bootstrap only.
 *
 * Responsibilities:
 *   1. Init shared UI (tabs, BattleView)
 *   2. Boot Firebase
 *   3. Route to AuthFlow or CharFlow based on saved session
 */

import FirebaseService from "./managers/FirebaseService.js";
import UIManager       from "./ui/UIManager.js";
import BattleView      from "./ui/BattleView.js";
import AuthFlow        from "./app/AuthFlow.js";
import CharFlow        from "./app/CharFlow.js";
import GameSession     from "./app/GameSession.js";

UIManager.bindTabs();
BattleView.init();

function onSignedIn(session) {
  const doLogout = () => {
    GameSession.stop();
    FirebaseService.signOut();
    AuthFlow.show();
  };

  CharFlow.init(session, {
    onCharSelected: (gameState, charId) => {
      GameSession.start(session, charId, gameState, {
        onSwitchChar: () => CharFlow.show(),
        onLogout:     doLogout,
      });
    },
    onLogout: doLogout,
  });
  CharFlow.show();
}

AuthFlow.init({ onSignedIn });

FirebaseService.boot().then(({ session: saved }) => {
  if (saved) {
    onSignedIn(saved);
  } else {
    AuthFlow.show();
  }
}).catch(err => {
  const splashBtn = document.getElementById("btn-start");
  splashBtn.disabled    = false;
  splashBtn.textContent = "Connection failed — tap to retry";
  splashBtn.addEventListener("click", () => location.reload(), { once: true });
  console.error("Boot failed:", err);
});
