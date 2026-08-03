const nyancatimg = new Image();
nyancatimg.src = "/assets/cat.png";

class Bird {
  constructor() {
    // Collision box, fixed. It is deliberately independent of the sprite's pixel
    // size so re-cutting the art (tools/make-assets.mjs) cannot change how the
    // game plays.
    this.width = 40;
    this.height = 25;
    this.weight = 0.5;
    this.reset();
  }
  reset() {
    this.x = 150;
    this.y = 200;
    this.vy = 0;
  }
  update() {
    const curve = Math.sin(angle) * 20;
    if (this.y > canvas.height - this.height * 3 + curve) {
      this.y = canvas.height - this.height * 3 + curve;
      this.vy = 0;
    } else {
      this.vy += this.weight;
      this.vy *= 0.9;
      this.y += this.vy;
    }
    if (this.y < 0 - this.height) {
      this.y = 0 + this.height;
      this.vy = 0;
    }
    if (spacePresssed && this.y > this.height * 3) this.flap();
  }
  draw() {
    // Source rect comes from the file itself, so swapping in a differently sized
    // sprite needs no code change. Nothing to draw until it has decoded.
    const sw = nyancatimg.naturalWidth;
    const sh = nyancatimg.naturalHeight;
    if (!sw || !sh) return;

    ctx.imageSmoothingEnabled = false; // pixel art: never interpolate
    ctx.drawImage(
      nyancatimg,
      0,
      0,
      sw,
      sh,
      this.x + 12,
      this.y - 8,
      this.width * 1.7,
      this.height * 1.7
    );
  }
  flap() {
    this.vy -= 1;
  }
}

const bird = new Bird();
window.__nyanParts = (window.__nyanParts || 0) + 1;
