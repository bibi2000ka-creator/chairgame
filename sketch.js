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
let recordBtnEl = null;
let playBtnEl = null;
let enterBtnEl = null;

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
  // force a square canvas sized to the container width (keeps layout consistent)
  const size = w;
  const canvas = createCanvas(size, size);
  canvas.parent(frame);

  imageMode(CENTER);
  // wire up on-screen controls (useful for touch devices)
  recordBtnEl = document.getElementById('record-btn');
  playBtnEl = document.getElementById('play-btn');
  enterBtnEl = document.getElementById('enter-btn');

  if (recordBtnEl) {
    recordBtnEl.addEventListener('click', () => {
      userStartAudio();
      if (!recordingMode && !isPlayback) startRecording();
      else if (recordingMode) startPlayback();
    });
  }

  if (playBtnEl) {
    playBtnEl.addEventListener('click', () => {
      userStartAudio();
      if (!isPlayback && recording.length > 0) startPlayback();
      else if (isPlayback) stopPlayback();
    });
  }

  if (enterBtnEl) {
    enterBtnEl.addEventListener('click', () => {
      userStartAudio();
      // If playing, stop playback. Otherwise mirror ENTER key behavior:
      // if not recording and not playing, start recording; if currently recording, start playback.
      if (isPlayback) {
        stopPlayback();
      } else if (!recordingMode && !isPlayback) startRecording();
      else if (recordingMode) startPlayback();
    });
  }

  // Use a slightly larger radius on narrow screens so chairs sit nearer the canvas edges
  // On narrow screens use a smaller radius and slightly smaller chairs
  // so chairs cluster a bit closer to the center and don't touch the border.
  let radiusRatio = width < 520 ? 0.28 : 0.33;
  radius = min(width, height) * radiusRatio * 1.1; // 10% larger radius

  // Reduce chair scale on small screens so they fit comfortably
  scaleFactor = width < 520 ? 0.18 : 0.22;

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
  const size = w;
  resizeCanvas(size, size);
  // recompute radius after resize (keep it 10% larger)
  let radiusRatio = width < 520 ? 0.28 : 0.33;
  radius = min(width, height) * radiusRatio * 1.1;
}

// Touch handler for mobile: unlock audio and behave like mousePressed
function touchStarted() {
  userStartAudio();
  started = true;

  if (autoRotate || isPlayback) return false;

  // use the first touch point
  let tx = touches && touches[0] ? touches[0].x : mouseX;
  let ty = touches && touches[0] ? touches[0].y : mouseY;

  let mx = tx - width / 2;
  let my = ty - height / 2;

  for (let c of chairs) {
    let x = cos(c.angle) * radius;
    let y = sin(c.angle) * radius;
    if (dist(mx, my, x, y) < 60) {
      triggerNote(c.note, 180);
      if (recordingMode) recordNote(c.note, 180);
      break;
    }
  }

  // returning false prevents emulated mouse events on some browsers
  return false;
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
        // don't visually pulse chairs while auto-rotation is active
        if (!autoRotate) chairs[r.note].pulse = 0.15;
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
  if (recordBtnEl) recordBtnEl.textContent = 'Stop & Play';
  if (playBtnEl) playBtnEl.disabled = true;
  if (enterBtnEl) enterBtnEl.textContent = 'STOP & PLAY';
}

function startPlayback() {
  recordingMode = false;
  isPlayback = true;
  autoRotate = true;
  playbackStartTime = millis();
  // ensure there are no lingering visual pulses while rotation is running
  for (let c of chairs) c.pulse = 0;
  if (playBtnEl) playBtnEl.textContent = 'Stop';
  if (recordBtnEl) recordBtnEl.disabled = true;
  if (enterBtnEl) enterBtnEl.textContent = 'Stop';
}

function stopPlayback() {
  isPlayback = false;
  autoRotate = false;
  for (let o of oscs) o.amp(0, 0.2);
  if (playBtnEl) playBtnEl.textContent = 'Play';
  if (recordBtnEl) {
    recordBtnEl.textContent = 'Record';
    recordBtnEl.disabled = false;
  }
  if (enterBtnEl) {
    enterBtnEl.textContent = 'ENTER';
    enterBtnEl.disabled = false;
  }
}
