let bg;
let chairImages = [];
let chairs = [];

let radius;
let rotationSpeed = 0.01;
let scaleFactor = 0.22;

// SOUND
let oscs = [];
let notes = [220, 261.63, 293.66, 329.63, 392, 440, 493.88];

// STATE
let started = false;
let autoRotate = false;
let recordingMode = false;
let isPlayback = false;

// RECORDING
let recording = [];
let recordStartTime = 0;
let playbackStartTime = 0;

function preload() {
  bg = loadImage('images/background.png');
  for (let i = 0; i < 7; i++) {
    chairImages[i] = loadImage(`images/chair${i + 1}.png`);
  }
}

function setup() {
  const frame = document.querySelector('.game-canvas');
  const rect = frame.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  // If the computed height is 0 (some Safari setups with CSS aspect-ratio),
  // fall back to a square canvas using the width so the game remains visible.
  const h = Math.max(1, Math.round(rect.height) || w);
  const canvas = createCanvas(w, h);
  canvas.parent(frame);

  imageMode(CENTER);

  radius = min(width, height) * 0.33;

  // Oscillators (soft, non-piercing)
  for (let i = 0; i < notes.length; i++) {
    let osc = new p5.Oscillator('triangle');
    osc.freq(notes[i]);
    osc.amp(0);
    osc.start();
    oscs.push(osc);
  }

  // Chairs
  for (let i = 0; i < 7; i++) {
    chairs.push({
      img: chairImages[i],
      angle: (TWO_PI / 7) * i,
      note: i,
      pulse: 0
    });
  }
}

function windowResized() {
  const frame = document.querySelector('.game-canvas');
  const rect = frame.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height) || w);
  resizeCanvas(w, h);
}

function draw() {
  background(20);
  image(bg, width / 2, height / 2, width, height);

  translate(width / 2, height / 2);

  for (let c of chairs) {
    if (autoRotate) c.angle += rotationSpeed;

    let x = cos(c.angle) * radius;
    let y = sin(c.angle) * radius;

    let s = 1 + c.pulse;
    image(
      c.img,
      x,
      y,
      c.img.width * scaleFactor * s,
      c.img.height * scaleFactor * s
    );

    c.pulse *= 0.88; // subtle decay
  }

  // Playback
  if (isPlayback) {
    let t = millis() - playbackStartTime;

    for (let r of recording) {
      if (t >= r.start && t < r.end) {
        oscs[r.note].amp(0.18, 0.05);
        chairs[r.note].pulse = 0.15;
      } else {
        oscs[r.note].amp(0, 0.1);
      }
    }

    let last = recording[recording.length - 1];
    if (t > last.end + 300) {
      stopPlayback();
    }
  }
}

/* ---------------- INPUT ---------------- */

function mousePressed() {
  userStartAudio();
  started = true;

  if (autoRotate || isPlayback) return;

  let mx = mouseX - width / 2;
  let my = mouseY - height / 2;

  for (let c of chairs) {
    let x = cos(c.angle) * radius;
    let y = sin(c.angle) * radius;
    if (dist(mx, my, x, y) < 60) {
      triggerNote(c.note, 180);
      if (recordingMode) recordNote(c.note, 180);
      break;
    }
  }
}

function keyPressed() {
  // allow keys to also unlock audio in browsers that require a user gesture
  userStartAudio();
  if (!started) return;

  if (key >= '1' && key <= '7') {
    let i = int(key) - 1;
    triggerNote(i, 250);
    if (recordingMode) recordNote(i, 250);
  }

  if (keyCode === ENTER) {
    if (!recordingMode && !isPlayback) startRecording();
    else if (recordingMode) startPlayback();
  }
}

function doubleClicked() {
  autoRotate = false;
}

/* ---------------- SOUND HELPERS ---------------- */

function triggerNote(i, duration) {
  oscs[i].amp(0.18, 0.03);
  chairs[i].pulse = 0.18;
  setTimeout(() => oscs[i].amp(0, 0.15), duration);
}

function recordNote(i, duration) {
  let now = millis() - recordStartTime;
  recording.push({
    note: i,
    start: now,
    end: now + duration
  });
}

function startRecording() {
  recording = [];
  recordStartTime = millis();
  recordingMode = true;
  autoRotate = false;
}

function startPlayback() {
  recordingMode = false;
  isPlayback = true;
  autoRotate = true;
  playbackStartTime = millis();
}

function stopPlayback() {
  isPlayback = false;
  autoRotate = false;
  for (let o of oscs) o.amp(0, 0.2);
}
