/** Animated parallax cloud background for auth screens. */
const CloudBackground = {
  _el: null,

  start() {
    if (!this._el) {
      const bg = document.createElement('div');
      bg.id = 'cloud-bg';

      // clouds-5 folder: file 3=small distant, 4=medium, 5=large foreground
      // clouds-1 file 2 = wide cloud bank for the far horizon
      const layers = [
        { file: 'assets/backgrounds/clouds/clouds-1/2.png', depth: '1' },
        { file: 'assets/backgrounds/clouds/clouds-5/3.png', depth: '3' },
        { file: 'assets/backgrounds/clouds/clouds-5/4.png', depth: '4' },
        { file: 'assets/backgrounds/clouds/clouds-5/5.png', depth: '5' },
      ];
      for (const { file, depth } of layers) {
        const layer = document.createElement('div');
        layer.className = 'cloud-layer';
        layer.dataset.layer = depth;
        layer.style.backgroundImage = `url(${file})`;
        bg.appendChild(layer);
      }

      document.getElementById('game-container').prepend(bg);
      this._el = bg;
    }
    this._el.style.display = '';
  },

  stop() {
    if (this._el) this._el.style.display = 'none';
  },
};

export default CloudBackground;
