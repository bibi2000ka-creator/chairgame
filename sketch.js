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

let bg, chairImages = [], chairs = [], oscs = [];
let notes = [220, 261.63, 293.66, 329.63, 392, 440, 493.88];
let started = false, autoRotate = false, recordingMode = false, isPlayback = false;
let recording = [], recordStartTime = 0, playbackStartTime = 0;
let radius, rotationSpeed = 0.01, scaleFactor = 0.22;
let enterBtnEl, saveBtnEl, nameInputEl;

function preload() {
  bg = loadImage('images/background.png');
  for (let i = 0; i < 7; i++) chairImages[i] = loadImage(`images/chair${i + 1}.png`);
}

function setup() {
  const frame = document.querySelector('.game-canvas');
  const size = Math.max(1, Math.round(frame.getBoundingClientRect().width));
  createCanvas(size, size).parent(frame);
  imageMode(CENTER);

  enterBtnEl = document.getElementById('enter-btn');
  saveBtnEl = document.getElementById('save-btn');
  nameInputEl = document.getElementById('player-name');

  enterBtnEl?.addEventListener('click', () => {
    userStartAudio();
    if (isPlayback) stopPlayback();
    else if (!recordingMode) startRecording();
    else startPlayback();
  });

  saveBtnEl?.addEventListener('click', saveTuneToFirebase);

  radius = min(width, height) * (width < 520 ? 0.28 : 0.35);
  scaleFactor = width < 520 ? 0.18 : 0.22;

  for (let i = 0; i < notes.length; i++) {
    let osc = new p5.Oscillator('triangle');
    osc.freq(notes[i]);
    osc.amp(0);
    osc.start();
    oscs.push(osc);
    chairs.push({ img: chairImages[i], angle: (TWO_PI / 7) * i, note: i, pulse: 0 });
  }
  fetchTunes();
}

function draw() {
  background(20);
  image(bg, width/2, height/2, width, height);
  translate(width/2, height/2);

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
    if (t > recording[recording.length - 1].end + 300) stopPlayback();
  }
}

function mousePressed() {
  if (autoRotate || isPlayback) return;
  let mx = mouseX - width / 2, my = mouseY - height / 2;
  for (let c of chairs) {
    if (dist(mx, my, cos(c.angle) * radius, sin(c.angle) * radius) < 60) {
      triggerNote(c.note, 180);
      if (recordingMode) recordNote(c.note, 180);
      break;
    }
  }
}

function keyPressed() {
  if (key >= '1' && key <= '7') {
    let i = int(key) - 1;
    triggerNote(i, 250);
    if (recordingMode) recordNote(i, 250);
  }
}

function triggerNote(i, d) {
  oscs[i].amp(0.18, 0.03);
  chairs[i].pulse = 0.18;
  setTimeout(() => oscs[i].amp(0, 0.15), d);
}

function recordNote(i, d) {
  recording.push({ note: i, start: millis() - recordStartTime, end: (millis() - recordStartTime) + d });
}

function startRecording() {
  recording = []; recordStartTime = millis(); recordingMode = true; autoRotate = false;
  if (enterBtnEl) enterBtnEl.textContent = 'STOP & PLAY';
}

function startPlayback() {
  recordingMode = false; isPlayback = true; autoRotate = true; playbackStartTime = millis();
  if (enterBtnEl) enterBtnEl.textContent = 'STOP';
  if (saveBtnEl) saveBtnEl.disabled = false;
}

function stopPlayback() {
  isPlayback = false; autoRotate = false;
  for (let o of oscs) o.amp(0, 0.2);
  if (enterBtnEl) enterBtnEl.textContent = 'ENTER';
}

function saveTuneToFirebase() {
  if (!database || !window.navigator.onLine) {
    alert("Offline: Tune saved to local session only."); return;
  }
  database.ref('tunes').push({
    player: nameInputEl.value || "Anonymous",
    notes: recording,
    createdAt: Date.now()
  }).then(() => alert("Saved!"));
}

function fetchTunes() {
  if (!database) return;
  database.ref('tunes').limitToLast(10).on('value', (s) => {
    let data = s.val(), html = '';
    if (data) {
      Object.values(data).reverse().forEach(v => {
        html += `<li onclick='window.playRemote("${JSON.stringify(v.notes)}")'>${v.player} <span>▶</span></li>`;
      });
    }
    document.getElementById('tunes-list-mobile').innerHTML = html;
    document.getElementById('tunes-list-desktop').innerHTML = html;
  });
}

window.playRemote = (n) => { recording = JSON.parse(n); startPlayback(); };
