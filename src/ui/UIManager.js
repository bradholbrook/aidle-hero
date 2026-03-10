const SCREENS = ["splash", "auth", "sign-in", "create-account", "char-select", "char-create", "main"];

const UIManager = {
  showScreen(name) {
    SCREENS.forEach(id => {
      const el = document.getElementById(`screen-${id}`);
      if (el) el.classList.toggle("active", id === name);
    });
  },

  showTab(tabName) {
    document.querySelectorAll(".tab-view").forEach(el => {
      el.classList.toggle("active-tab", el.id === `tab-${tabName}`);
    });
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
  },

  bindTabs() {
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => this.showTab(btn.dataset.tab));
    });
  },

  showOverlay(id) {
    document.getElementById(id)?.classList.remove("hidden");
  },

  hideOverlay(id) {
    document.getElementById(id)?.classList.add("hidden");
  },

  /**
   * Show a confirmation dialog.
   * @param {string}   message  - Body text
   * @param {Function} onConfirm - Called if user taps Delete/confirm
   */
  confirm(message, onConfirm) {
    document.getElementById("confirm-msg").textContent = message;
    this.showOverlay("confirm-overlay");

    // Always replace buttons first to drop any stale listeners from a previous
    // call that was dismissed by tapping outside (without clicking yes/no).
    const oldYes = document.getElementById("confirm-yes");
    const oldNo  = document.getElementById("confirm-no");
    const yes    = oldYes.cloneNode(true);
    const no     = oldNo.cloneNode(true);
    oldYes.replaceWith(yes);
    oldNo.replaceWith(no);

    const cleanup = () => this.hideOverlay("confirm-overlay");
    yes.addEventListener("click", () => { cleanup(); onConfirm(); }, { once: true });
    no.addEventListener("click",  () => { cleanup(); },             { once: true });
  },
};

export default UIManager;
