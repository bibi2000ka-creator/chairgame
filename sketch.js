let bg;
let chairImages = [];
let chairs = [];

let radius = 120;
let rotationSpeed = 0.02; 
let scaleFactor = 0.20;

// SOUND
let oscs = [];       

// GAME STATE
let started = false;   
let autoPlay = false;  
let recordingMode = false; 
let isPlayback = false;

// Active keyboard notes
let activeNotes = [];

// Recording storage with durations
let recording = [];
let recordStartTime = 0;
let playbackStartTime = 0;

// Fixed 7-note scale
let notes = [220, 261.63, 293.66, 329.63, 392, 440, 493.88]; 

function preload() {
  bg = loadImage('images/background.png');

  for (let i = 0; i < 7; i++) {
    chairImages[i] = loadImage(`images/chair${i + 1}.png`);
  }
}

function setup() {
  // Attach canvas to the left-side container
  let canvas = createCanvas(400, 400);
  canvas.parent(document.querySelector('.game-container'));

  imageMode(CENTER);

  userStartAudio(); // unlock audio for mobile

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

function draw() {
  background(220);
  image(bg, width / 2, height / 2, width, height);

  translate(width / 2, height / 2);

  // Draw chairs + subtle pulse
  for (let chair of chairs) {
    if (autoPlay) chair.angle += rotationSpeed;

    let x = radius * cos(chair.angle);
    let y = radius * sin(chair.angle);

    let sizeMultiplier = 1 + chair.pulse;
    image(
      chair.img,
      x,
      y,
      chair.img.width * scaleFactor * sizeMultiplier,
      chair.img.height * scaleFactor * sizeMultiplier
    );

    // Fade pulse only when not rotating
    if (!autoPlay) chair.pulse *= 0.9;
  }

  // --- Playback mode ---
  if (isPlayback && recording.length > 0) {
    let currentTime = millis() - playbackStartTime;

    for (let noteObj of recording) {
      if (currentTime >= noteObj.startTime && currentTime < noteObj.endTime) {
        oscs[noteObj.note].amp(0.25, 0.05);
        chairs[noteObj.note].pulse = 0.2;
      } else {
        oscs[noteObj.note].amp(0, 0.05);
      }
    }

    // stop playback automatically
    let lastEndTime = recording[recording.length - 1].endTime;
    if (currentTime > lastEndTime + 200) { 
      isPlayback = false;
      autoPlay = false;
    }
  }
}

// --- Mouse click plays short note ---
function mousePressed() {
  if (!started) {
    started = true;
  } else if (!autoPlay && !isPlayback) {
    let mx = mouseX - width / 2;
    let my = mouseY - height / 2;

    for (let chair of chairs) {
      let x = radius * cos(chair.angle);
      let y = radius * sin(chair.angle);
      let d = dist(mx, my, x, y);
      if (d < chair.img.width * scaleFactor / 2) {
        playMouseNote(chair.noteIndex);
        if (recordingMode) {
          recording.push({
            note: chair.noteIndex,
            startTime: millis() - recordStartTime,
            endTime: millis() - recordStartTime + 200
          });
        }
        break;
      }
    }
  }
}

// --- Keyboard controls ---
function keyPressed() {
  if (!started) return;

  if (key >= '1' && key <= '7') {
    let index = int(key) - 1;
    if (!activeNotes.includes(index)) {
      activeNotes.push(index);
      oscs[index].amp(0.25, 0.05);
      chairs[index].pulse = 0.2;

      if (recordingMode) {
        recording.push({
          note: index,
          startTime: millis() - recordStartTime,
          endTime: null
        });
      }
    }
  }

  // ENTER toggles recording/playback
  if (keyCode === ENTER) {
    if (!recordingMode && !isPlayback) {
      // start recording
      recording = [];
      recordStartTime = millis();
      recordingMode = true;
      autoPlay = false;
      isPlayback = false;
    } else if (recordingMode) {
      // end recording
      let endTime = millis() - recordStartTime;
      for (let r of recording) {
        if (r.endTime === null) r.endTime = endTime;
      }
      recordingMode = false;
      isPlayback = true;
      playbackStartTime = millis();
      autoPlay = true;
    }
  }
}

function keyReleased() {
  if (!started) return;

  if (key >= '1' && key <= '7') {
    let index = int(key) - 1;
    let i = activeNotes.indexOf(index);
    if (i > -1) {
      activeNotes.splice(i, 1);
      oscs[index].amp(0, 0.3);

      if (recordingMode) {
        for (let j = recording.length - 1; j >= 0; j--) {
          if (recording[j].note === index && recording[j].endTime === null) {
            recording[j].endTime = millis() - recordStartTime;
            break;
          }
        }
      }
    }
  }
}

// --- play short note for mouse click ---
function playMouseNote(index) {
  oscs[index].amp(0.25, 0.05);
  setTimeout(() => oscs[index].amp(0, 0.3), 200);
  chairs[index].pulse = 0.3;
}
