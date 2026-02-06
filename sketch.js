// --- 1. FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBbLxF6VSJA1CVIGemr7vfh9Q71c0ivF00",
  authDomain: "chairgame-7ef8b.firebaseapp.com",
  databaseURL: "https://chairgame-7ef8b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "chairgame-7ef8b",
  storageBucket: "chairgame-7ef8b.firebasestorage.app",
  messagingSenderId: "740764358758",
  appId: "1:740764358758:web:ad6ba45ccedf270a9d75a7"
};

let database = null;
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  database = firebase.database();
}

// --- 2. GLOBAL VARIABLES ---
let bg, chairImages = [], chairs = [], oscs = [];
let notes = [220, 261.63, 293.66, 329.63, 392, 440, 493.88];
let started = false, autoRotate = false, recordingMode = false, isPlayback = false;
let recording = [], recordStartTime = 0, playbackStartTime = 0;
let radius, rotationSpeed = 0.01, scaleFactor = 0.22;
let enterBtnEl, saveBtnEl, nameInputEl;

// --- 3. PRELOAD ---
function preload() {
  bg = loadImage('images/background.png');
  for (let i = 0; i < 7; i++) {
    chairImages[i] = loadImage(`images/chair${i + 1}.png`);
  }
}

// --- 4. SETUP ---
function setup() {
  const frame = document.querySelector('.game-canvas');
  if (!frame) return;
  
  // compute a size that fits the frame and avoids exceeding viewport height on phones
  const frameWidth = Math.max(1, Math.round(frame.clientWidth));
  const maxAllowed = Math.max(1, Math.round(window.innerHeight * 0.8));
  const size = Math.max(1, Math.round(Math.min(frameWidth, maxAllowed)));
  createCanvas(size, size).parent(frame);
  imageMode(CENTER);

  // Make touch interactions non-blocking for scrolling: only treat short taps as clicks.
  // Attach passive touch handlers to the actual canvas element created by p5.
  const canvasEl = frame.querySelector('canvas');
  if (canvasEl) {
    let startY = 0, startX = 0, moved = false;
    canvasEl.addEventListener('touchstart', (e) => {
      const t = e.touches && e.touches[0];
      if (t) { startY = t.clientY; startX = t.clientX; moved = false; }
    }, { passive: true });

    canvasEl.addEventListener('touchmove', (e) => {
      const t = e.touches && e.touches[0];
      if (t && (Math.abs(t.clientY - startY) > 10 || Math.abs(t.clientX - startX) > 10)) {
        moved = true;
      }
    }, { passive: true });

    canvasEl.addEventListener('touchend', (e) => {
      // If there wasn't a meaningful move, treat as a tap/click
      if (!moved) {
        // Use p5's mouse coordinates mapped from the touch
        const t = e.changedTouches && e.changedTouches[0];
        if (t) {
          const rect = canvasEl.getBoundingClientRect();
          // map to p5 canvas coordinates
          const px = t.clientX - rect.left;
          const py = t.clientY - rect.top;
          // p5 global variables mouseX/mouseY will not be set here; set temporary
          // We'll call a helper that uses px,py to simulate the click
          handleCanvasTap(px, py);
        } else {
          // fallback
          handleCanvasTap(width / 2, height / 2);
        }
      }
    }, { passive: true });
  }

  // HTML Elements
  enterBtnEl = document.getElementById('enter-btn');
  saveBtnEl = document.getElementById('save-btn');
  nameInputEl = document.getElementById('player-name');

  // Event Listeners
  enterBtnEl?.addEventListener('click', () => {
    userStartAudio();
    if (isPlayback) {
      stopPlayback();
    } else if (!recordingMode) {
      startRecording();
    } else {
      startPlayback();
    }
  });

  saveBtnEl?.addEventListener('click', saveTuneToFirebase);

  // Layout calculations
  radius = min(width, height) * (width < 520 ? 0.28 : 0.35);
  scaleFactor = width < 520 ? 0.18 : 0.22;

  // Initialize Oscillators & Chairs
  for (let i = 0; i < notes.length; i++) {
    let osc = new p5.Oscillator('triangle');
    osc.freq(notes[i]);
    osc.amp(0);
    osc.start();
    oscs.push(osc);
    
    chairs.push({ 
      img: chairImages[i], 
      angle: (TWO_PI / 7) * i, 
      note: i, 
      pulse: 0 
    });
  }
  
  fetchTunes();

  // Ensure canvas is recalculated on orientation change for mobile devices
  window.addEventListener('orientationchange', () => {
    // small timeout to allow viewport to settle
    setTimeout(windowResized, 350);
  });
}

// --- 5. DRAW LOOP ---
function draw() {
  background(20);
  if (bg) image(bg, width/2, height/2, width, height);
  translate(width/2, height/2);

  // Draw Chairs
  for (let c of chairs) {
    if (autoRotate) c.angle += rotationSpeed;
    let x = cos(c.angle) * radius;
    let y = sin(c.angle) * radius;
    let s = 1 + c.pulse;
    image(c.img, x, y, c.img.width * scaleFactor * s, c.img.height * scaleFactor * s);
    c.pulse *= 0.88; // Smooth pulse decay
  }

  // Playback Logic
  if (isPlayback && recording.length > 0) {
    let t = millis() - playbackStartTime;
    for (let r of recording) {
      if (t >= r.start && t < r.end) {
        oscs[r.note].amp(0.18, 0.05);
        chairs[r.note].pulse = 0.15;
      } else {
        oscs[r.note].amp(0, 0.1);
      }
    }
    
    // Check if recording finished
    let lastNote = recording[recording.length - 1];
    if (t > lastNote.end + 300) {
      stopPlayback();
    }
  }
}

// --- 6. INTERACTION ---
function mousePressed() {
  userStartAudio();
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

// Mobile support
// Helper to map a tap on the canvas to the game's mouse coordinates and trigger click logic.
function handleCanvasTap(px, py) {
  // map px,py (canvas DOM coords) to p5 internal coordinates where (0,0) is top-left of canvas
  // p5's mouseX/mouseY are relative to the canvas; we can compute relative to center used by game
  const canvasEl = document.querySelector('.game-canvas canvas');
  if (!canvasEl) return;
  const rect = canvasEl.getBoundingClientRect();
  const localX = px; // already relative to rect.left
  const localY = py; // relative to rect.top
  // Convert to p5 coordinates used in mousePressed (where origin is canvas top-left)
  // p5's mouseX/mouseY are global, but our mousePressed computes mx,my relative to center using mouseX,mouseY
  // So we can temporarily set mouseX/mouseY globals if they exist, otherwise compute values and call internal logic.
  // We'll compute center-relative coords and call the same logic as in mousePressed.
  const mx = localX - (rect.width / 2);
  const my = localY - (rect.height / 2);

  if (autoRotate || isPlayback) return;
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
  if (key >= '1' && key <= '7') {
    let i = int(key) - 1;
    triggerNote(i, 250);
    if (recordingMode) recordNote(i, 250);
  }
  if (keyCode === ENTER) {
    if (isPlayback) stopPlayback();
    else if (!recordingMode) startRecording();
    else startPlayback();
  }
}

// --- 7. SOUND & RECORDING FUNCTIONS ---
function triggerNote(i, d) {
  if (oscs[i]) {
    oscs[i].amp(0.18, 0.03);
    chairs[i].pulse = 0.18;
    setTimeout(() => {
      if (!isPlayback) oscs[i].amp(0, 0.15);
    }, d);
  }
}

function recordNote(i, d) {
  recording.push({ 
    note: i, 
    start: millis() - recordStartTime, 
    end: (millis() - recordStartTime) + d 
  });
}

function startRecording() {
  recording = []; 
  recordStartTime = millis(); 
  recordingMode = true; 
  autoRotate = true; // Οι καρέκλες γυρνούν όσο ηχογραφείς
  if (enterBtnEl) enterBtnEl.textContent = 'STOP & PLAY';
  if (saveBtnEl) saveBtnEl.disabled = true;
}

function startPlayback() {
  if (recording.length === 0) {
    stopPlayback();
    return;
  }
  recordingMode = false; 
  isPlayback = true; 
  autoRotate = true; 
  playbackStartTime = millis();
  if (enterBtnEl) enterBtnEl.textContent = 'STOP ALL';
  if (saveBtnEl) saveBtnEl.disabled = false;
}

function stopPlayback() {
  isPlayback = false; 
  recordingMode = false;
  autoRotate = false;
  for (let o of oscs) o.amp(0, 0.2);
  if (enterBtnEl) enterBtnEl.textContent = 'ENTER';
}

// --- 8. FIREBASE FUNCTIONS ---
function saveTuneToFirebase() {
  if (!database || !window.navigator.onLine) {
    alert("Connection issue. Please try again."); 
    return;
  }
  const name = nameInputEl.value.trim() || "Anonymous";
  database.ref('tunes').push({
    player: name,
    notes: recording,
    createdAt: Date.now()
  }).then(() => {
    alert("Tune Saved!");
    if (saveBtnEl) saveBtnEl.disabled = true;
    nameInputEl.value = "";
  }).catch(err => alert("Error: " + err.message));
}

function fetchTunes() {
  if (!database) return;
  database.ref('tunes').limitToLast(10).on('value', (s) => {
    let data = s.val();
    let html = '';
    if (data) {
      Object.entries(data).reverse().forEach(([key, v]) => {
        // Χρήση single quotes για το JSON ώστε να μην σπάει το HTML attribute
        let notesString = JSON.stringify(v.notes).replace(/"/g, '&quot;');
        html += `<li onclick="window.playRemote('${notesString}')" style="cursor:pointer;">
                  ${v.player} <span>▶</span>
                </li>`;
      });
    } else {
      html = '<li>No tunes recorded yet.</li>';
    }
    const mobileList = document.getElementById('tunes-list-mobile');
    const desktopList = document.getElementById('tunes-list-desktop');
    if (mobileList) mobileList.innerHTML = html;
    if (desktopList) desktopList.innerHTML = html;
  });
}

window.playRemote = (notesStr) => {
  userStartAudio();
  try {
    recording = JSON.parse(notesStr);
    startPlayback();
  } catch (e) {
    console.error("Error playing remote tune", e);
  }
};

function windowResized() {
  const frame = document.querySelector('.game-canvas');
  if (frame) {
    const frameWidth = Math.max(1, Math.round(frame.clientWidth));
    const maxAllowed = Math.max(1, Math.round(window.innerHeight * 0.8));
    const size = Math.max(1, Math.round(Math.min(frameWidth, maxAllowed)));
    resizeCanvas(size, size);
    radius = min(width, height) * (width < 520 ? 0.28 : 0.35);
  }
}
