function setup() {
  // Make the canvas big inside the left container
  let canvas = createCanvas(800, 800); // bigger canvas
  canvas.parent(document.querySelector('.game-container'));
  imageMode(CENTER);

  userStartAudio(); // unlock audio on mobile

  // --- OSCILLATORS for each note ---
  for (let i = 0; i < notes.length; i++) {
    let osc = new p5.Oscillator('sine');
    osc.freq(notes[i]);
    osc.start();
    osc.amp(0); 
    oscs.push(osc);
  }

  // Chairs
  for (let i = 0; i < chairImages.length; i++) {
    let angle = (TWO_PI / chairImages.length) * i;
    chairs.push({
      img: chairImages[i],
      angle: angle,
      noteIndex: i,
      pulse: 0
    });
  }
}

// Optional: make canvas resize with window
function windowResized() {
  let leftWidth = document.querySelector('.left').clientWidth;
  let leftHeight = document.querySelector('.left').clientHeight;
  resizeCanvas(leftWidth * 0.95, leftHeight * 0.95);
}
