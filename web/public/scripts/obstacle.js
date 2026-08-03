const obstaclesArray = [];

class Obstacle {
  constructor() {
    // Vertical gap between the two columns.
    this.top = (Math.random() * canvas.height) / 3;
    this.bottom = (Math.random() * canvas.height) / 3;
    this.x = canvas.width;
    this.width = 20;
    this.color = "hsla(" + hue + ", 100%, 50%, 1)";
    this.counted = false;
  }
  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, 0, this.width, this.top);
    ctx.fillRect(this.x, canvas.height - this.bottom, this.width, this.bottom);
  }
  update() {
    this.x -= gamespeed;
    if (!this.counted && this.x < bird.x) {
      score++;
      this.counted = true;
    }
    this.draw();
  }
}

function handleObstacles() {
  // Horizontal gap between consecutive columns.
  if (frame % 80 === 0) {
    obstaclesArray.unshift(new Obstacle());
  }
  for (let i = 0; i < obstaclesArray.length; i++) {
    obstaclesArray[i].update();
  }
  // Drop columns once they are off-screen. The upstream build compared the array
  // itself to 20, so this never fired and the array grew for the whole run.
  while (
    obstaclesArray.length > 0 &&
    obstaclesArray[obstaclesArray.length - 1].x + obstaclesArray[obstaclesArray.length - 1].width < 0
  ) {
    obstaclesArray.pop();
  }
}

window.__nyanParts = (window.__nyanParts || 0) + 1;
