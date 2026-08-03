const particlesArray = [];

class Particle {
  constructor() {
    this.x = bird.x;
    this.y = bird.y - 5;
    this.speedY = Math.random() * 1 - 0.5;
    this.color = "hsla(" + hue + ", 100%, 50%, 0.8)";
  }
  update() {
    this.x -= gamespeed;
    this.y += this.speedY;
  }
  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, 20, 30);
  }
}

function handleParticles() {
  particlesArray.unshift(new Particle());
  for (let i = 0; i < particlesArray.length; i++) {
    particlesArray[i].update();
    particlesArray[i].draw();
  }
  if (particlesArray.length > 200) {
    particlesArray.length = 180;
  }
}

window.__nyanParts = (window.__nyanParts || 0) + 1;
