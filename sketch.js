// --- 1. FIREBASE CONFIGURATION ---
// Replace the values below with your actual Firebase project settings
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

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
let saveBtnEl = null;
let nameInputEl = null;

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
  const size = w;
  const canvas = createCanvas(size, size);
  canvas.parent(frame);

  imageMode(CENTER);

  // Wire up HTML elements
  recordBtnEl = document.getElementById('record-btn');
  playBtnEl = document.getElementById('play-btn');
  enterBtnEl = document.getElementById('enter-btn');
  saveBtnEl = document.getElementById('save-btn');
  nameInputEl = document.getElementById('player-name');

  // Listeners for Buttons
  if (enterBtnEl) {
    enterBtnEl.addEventListener('click', () => {
      userStartAudio();
      if (isPlayback) stopPlayback();
      else if (!recordingMode && !isPlayback) startRecording();
      else if (recordingMode) startPlayback();
    });
  }

  if (saveBtnEl) {
    saveBtnEl.addEventListener('click', saveTuneToFirebase);
  }

  // Layout math
  let radiusRatio = width < 520 ? 0.25 : 0.33;
  radius = min(width, height) * radiusRatio * 1.1;
  scaleFactor = width < 520 ? 0.18 : 0.22;

  // Sound & Chairs Init
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

  // Start listening for tunes from the cloud
  fetchTunes();
}

// --- 2. FIREBASE FUNCTIONS ---

function saveTuneToFirebase() {
  // Check if we are online before trying to save
  if (!window.navigator.onLine) {
    alert("No signal in the subway! You can play, but saving requires a connection.");
    return;
  }

  const playerName = nameInputEl.value.trim() || "Anonymous Passenger";
  
  if (recording.length === 0) {
    alert("Record a tune first!");
    return;
  }

  const newTuneRef = database.ref('tunes').push();
  newTuneRef.set({
    player: playerName,
    notes: recording,
    createdAt: Date.now()
  }).then(() => {
    alert("Tune saved to the train records!");
    saveBtnEl.disabled = true;
    nameInputEl.value = "";
  }).catch((error) => {
    console.error("Save failed: ", error);
  });
}

function fetchTunes() {
  const desktopList = document.getElementById('tunes-list-desktop');
  const mobileList = document.getElementById('tunes-list-mobile');

  // 1. Show a timeout message if the subway signal is too weak
  const timeout = setTimeout(() => {
    const msg = '<li style="list-style:none; color:#888;">Playing offline (No signal)</li>';
    if(desktopList) desktopList.innerHTML = msg;
    if(mobileList) mobileList.innerHTML = msg;
  }, 3000);

  // 2. Try to connect to Firebase
  database.ref('tunes').limitToLast(10).on('value', (snapshot) => {
    clearTimeout(timeout); // We got a signal! Cancel the offline message.
    const data = snapshot.val();
    let listContent = data ? '' : '<li style="list-style:none">No tunes recorded yet.</li>';
    
    if (data) {
      Object.entries(data).reverse().forEach(([key, val]) => {
        listContent += `<li onclick='playRemoteTune(${JSON.stringify(val.notes)})'>
          <span>${val.player}</span> <span class="play-icon">▶ Play</span>
        </li>`;
      });
    }
    
    if(desktopList) desktopList.innerHTML = listContent;
    if(mobileList) mobileList.innerHTML = listContent;
  }, (error) => {
    // 3. If Firebase explicitly fails (Offline)
    clearTimeout(timeout);
    console.log("Running in offline mode.");
    const offlineMsg = '<li style="list-style:none; color:#888;">Offline Mode</li>';
    if(desktopList) desktopList.innerHTML = offlineMsg;
    if(mobileList) mobileList.innerHTML = offlineMsg;
  });
}

// Global function to trigger playback from the list
window.playRemoteTune = function(notesData) {
  userStartAudio();
  if (isPlayback) stopPlayback(); 
  recording = notesData;
  startPlayback();
};

// --- 3. EXISTING GAME LOGIC (Restored from your snippet) ---

function draw() {
  background(20);
  image(bg, width / 2, height / 2, width, height);
  translate(width / 2, height / 2);

  for (let c of chairs) {
    if (autoRotate) c.angle += rotationSpeed;
    let x = cos(c.angle) * radius;
    let y = sin(c.angle) * radius;
    let s = 1 + c.pulse;
    image(c.img, x, y, c.img.width * scaleFactor * s, c.img.height * scaleFactor * s);
    c.pulse *= 0.88;
  }

  if (isPlayback) {
    let t = millis() - playbackStartTime;
    for (let r of recording) {
      if (t >= r.start && t < r.end) {
        oscs[r.note].amp(0.18, 0.05);
        if (!autoRotate) chairs[r.note].pulse = 0.15;
      } else {
        oscs[r.note].amp(0, 0.1);
      }
    }
    let last = recording[recording.length - 1];
    if (t > last.end + 300) stopPlayback();
  }
}

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
  userStartAudio();
  if (!started) started = true;
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

function triggerNote(i, duration) {
  oscs[i].amp(0.18, 0.03);
  chairs[i].pulse = 0.18;
  setTimeout(() => oscs[i].amp(0, 0.15), duration);
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
  recordingMode = false;
  isPlayback = true;
  autoRotate = true;
  playbackStartTime = millis();
  for (let c of chairs) c.pulse = 0;
  if (enterBtnEl) enterBtnEl.textContent = 'Stop';
  if (saveBtnEl) saveBtnEl.disabled = false;
}

function stopPlayback() {
  isPlayback = false;
  autoRotate = false;
  for (let o of oscs) o.amp(0, 0.2);
  if (enterBtnEl) enterBtnEl.textContent = 'ENTER';
}

function windowResized() {
  const frame = document.querySelector('.game-canvas');
  const rect = frame.getBoundingClientRect();
  resizeCanvas(rect.width, rect.width);
}
