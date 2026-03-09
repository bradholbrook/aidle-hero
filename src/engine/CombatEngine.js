/** Phase 1 stub — foreground combat loop */
const CombatEngine = {
  _interval: null,
  _state: null,
  _onKill: null,
  _onTick: null,

  /**
   * Start the foreground combat loop.
   * @param {object}   gameState - live reference to the game state object
   * @param {Function} onKill    - called with (gold, exp) when enemy dies
   * @param {Function} onTick    - called each tick with updated combat state
   */
  start(gameState, onKill, onTick) {
    this._state  = gameState;
    this._onKill = onKill;
    this._onTick = onTick;
    this._interval = setInterval(() => this._tick(), gameState.combatSpeed ?? 500);
  },

  stop() {
    clearInterval(this._interval);
    this._interval = null;
  },

  _tick() {
    // Phase 1: implemented in main.js until engine is fleshed out
  },
};

export default CombatEngine;
