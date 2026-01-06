// --- 1. FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBbLxF6VSJA1CVIGemr7vfh9Q71c0ivF00",
  authDomain: "chairgame-7ef8b.firebaseapp.com",
  databaseURL: "https://chairgame-7ef8b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "chairgame-7ef8b",
  storageBucket: "chairgame-7ef8b.firebasestorage.app",
  messagingSenderId: "740764358758",
  appId: "1:740764358758:web:ad6ba45ccedf270a9d75a7",
  measurementId: "G-3KFSVXT1KM"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let bg;
let chairImages = [];
let chairs = [];
let radius;
let rotationSpeed = 0.01;
let scaleFactor = 0.22;

let oscs = [];
let notes = [220, 261.63, 293.66, 329.63, 392, 440, 493.88];

let started = false;
let autoRotate = false;
let recordingMode = false;
let isPlayback = false;

let recording = [];
let recordStartTime = 0;
let playbackStartTime = 0;
let recordBtnEl, playBtnEl, enterBtnEl, saveBtnEl, nameInputEl;

function preload() {
  bg = loadImage('images/background.png');
  for (let i = 0; i < 7; i++) {
    chairImages[i] = loadImage(`images/chair${i + 1}.png`);
  }
}

function setup() {
  const frame = document.querySelector('.game-canvas');
  // Handle cases where frame might not exist yet
  const w = frame ? frame.getBoundingClientRect().width : windowWidth;
  const canvas = createCanvas(w, w);
  if (frame) canvas.parent(frame);

  imageMode(CENTER);

  // Wire up HTML elements
  recordBtnEl = document.getElementById('record-btn');
  playBtnEl = document.getElementById('play-btn');
  enterBtnEl = document.getElementById('enter-btn');
  saveBtnEl = document.getElementById('save-btn');
  nameInputEl = document.getElementById('player-name');

  if (enterBtnEl) {
    enterBtnEl.addEventListener('click', handleMainAction);
  }

  if (saveBtnEl) {
    saveBtnEl.addEventListener('click', saveTuneToFirebase);
  }

  // Layout math - adjust for mobile scale
  let radiusRatio = width < 520 ? 0.3 : 0.33;
  radius = width * radiusRatio;
  scaleFactor = width < 520 ? 0.18 : 0.22;

  // Sound Init - iOS requires user interaction to start context
  for (let i = 0; i < notes.length; i++) {
    let osc = new p5.Oscillator('triangle');
    osc.freq(notes[i]);
    osc.amp(0);
    osc.start();
    oscs.push(osc);
  }

  for (let i = 0; i < 7; i++) {
    chairs.push({
      img: chairImages[i],
      angle: (TWO_PI / 7) * i,
      note: i,
      pulse: 0
    });
  }

  fetchTunes();
}

// Unified action for the Enter/Action button
function handleMainAction() {
  unlockAudio();
  if (isPlayback) stopPlayback();
  else if (!recordingMode) startRecording();
  else startPlayback();
}

// ESSENTIAL FOR IOS: Unlocks the audio context on first touch
function unlockAudio() {
  if (getAudioContext().state !== 'running') {
    getAudioContext().resume();
  }
}

function draw() {
  background(20);
  if (bg) image(bg, width / 2, height / 2, width, height);
  
  push();
  translate(width / 2, height / 2);

  for (let c of chairs) {
    if (autoRotate) c.angle += rotationSpeed;
    let x = cos(c.angle) * radius;
    let y = sin(c.angle) * radius;
    let s = 1 + c.pulse;
    image(c.img, x, y, c.img.width * scaleFactor * s, c.img.height * scaleFactor * s);
    c.pulse *= 0.88;
  }
  pop();

  if (isPlayback && recording.length > 0) {
    let t = millis() - playbackStartTime;
    let activeAny = false;
    for (let r of recording) {
      if (t >= r.start && t < r.end) {
        oscs[r.note].amp(0.18, 0.05);
        if (!autoRotate) chairs[r.note].pulse = 0.15;
        activeAny = true;
      } else {
        oscs[r.note].amp(0, 0.1);
      }
    }
    let last = recording[recording.length - 1];
    if (t > last.end + 500) stopPlayback();
  }
}

// Separate logic for "checking" if a chair was hit
function checkChairHit(tx, ty) {
  let mx = tx - width / 2;
  let my = ty - height / 2;
  for (let c of chairs) {
    let x = cos(c.angle) * radius;
    let y = sin(c.angle) * radius;
    // Increased hit area slightly for fat fingers on mobile
    if (dist(mx, my, x, y) < 70 * (width / 600 + 0.5)) {
      triggerNote(c.note, 180);
      if (recordingMode) recordNote(c.note, 180);
      break;
    }
  }
}

// Touch handling for iOS
function touchStarted() {
  unlockAudio();
  started = true;
  if (!autoRotate && !isPlayback) {
    checkChairHit(mouseX, mouseY);
  }
  // This prevents the browser from scrolling/refreshing while playing
  return false; 
}

// Mouse handling for Desktop
function mousePressed() {
  // If touchStarted already fired, p5 usually handles this, 
  // but we check if audio is started here just in case.
  unlockAudio();
  if (started && !autoRotate && !isPlayback) {
    checkChairHit(mouseX, mouseY);
  }
  started = true;
}

function keyPressed() {
  unlockAudio();
  if (!started) started = true;
  if (key >= '1' && key <= '7') {
    let i = int(key) - 1;
    triggerNote(i, 250);
    if (recordingMode) recordNote(i, 250);
  }
  if (keyCode === ENTER) {
    handleMainAction();
  }
}

function triggerNote(i, duration) {
  if (oscs[i]) {
    oscs[i].amp(0.18, 0.03);
    chairs[i].pulse = 0.18;
    setTimeout(() => { if(oscs[i]) oscs[i].amp(0, 0.15); }, duration);
  }
}

function recordNote(i, duration) {
  let now = millis() - recordStartTime;
  recording.push({ note: i, start: now, end: now + duration });
}

function startRecording() {
  recording = [];
  recordStartTime = millis();
  recordingMode = true;
  autoRotate = false;
  if (enterBtnEl) enterBtnEl.textContent = 'STOP & PLAY';
  if (saveBtnEl) saveBtnEl.disabled = true;
}

function startPlayback() {
  if (recording.length === 0) return;
  recordingMode = false;
  isPlayback = true;
  autoRotate = true;
  playbackStartTime = millis();
  for (let c of chairs) c.pulse = 0;
  if (enterBtnEl) enterBtnEl.textContent = 'STOP';
  if (saveBtnEl) saveBtnEl.disabled = false;
}

function stopPlayback() {
  isPlayback = false;
  autoRotate = false;
  for (let o of oscs) o.amp(0, 0.2);
  if (enterBtnEl) enterBtnEl.textContent = 'RECORD TUNE';
}

// --- FIREBASE OPS ---

function saveTuneToFirebase() {
  const playerName = (nameInputEl && nameInputEl.value.trim()) || "Anonymous Passenger";
  if (recording.length === 0) return;

  const newTuneRef = database.ref('tunes').push();
  newTuneRef.set({
    player: playerName,
    notes: recording,
    createdAt: Date.now()
  }).then(() => {
    alert("Tune saved!");
    if (saveBtnEl) saveBtnEl.disabled = true;
  });
}

function fetchTunes() {
  const desktopList = document.getElementById('tunes-list-desktop');
  const mobileList = document.getElementById('tunes-list-mobile');
  
  database.ref('tunes').limitToLast(10).on('value', (snapshot) => {
    const data = snapshot.val();
    let listContent = '';
    if (!data) {
      listContent = '<li>No tunes yet.</li>';
    } else {
      const entries = Object.entries(data).reverse();
      entries.forEach(([key, val]) => {
        listContent += `<li onclick='playRemoteTune(${JSON.stringify(val.notes)})'>
          ${val.player} <span>▶</span>
        </li>`;
      });
    }
    if(desktopList) desktopList.innerHTML = listContent;
    if(mobileList) mobileList.innerHTML = listContent;
  });
}

window.playRemoteTune = function(notesData) {
  unlockAudio();
  stopPlayback();
  recording = notesData;
  startPlayback();
};

function windowResized() {
  const frame = document.querySelector('.game-canvas');
  if (frame) {
    const rect = frame.getBoundingClientRect();
    resizeCanvas(rect.width, rect.width);
    radius = width * (width < 520 ? 0.3 : 0.33);
    scaleFactor = width < 520 ? 0.18 : 0.22;
  }
}
