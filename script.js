// ----- Variables -----
let reminderMinutes = 0.1; // testing ~6 sec
let timer = reminderMinutes * 60;

let blinkCount = parseInt(localStorage.getItem('blinkCount')) || 0;
let dailyLog = JSON.parse(localStorage.getItem('dailyLog')) || [];
let streak = parseInt(localStorage.getItem('streak')) || 0;
let badges = JSON.parse(localStorage.getItem('badges')) || [];

const minutesSpan = document.getElementById('minutes');
const secondsSpan = document.getElementById('seconds');
const blinkCountDiv = document.getElementById('blinkCount');
const streakDiv = document.getElementById('streakDiv');
const badgeDiv = document.getElementById('badgeDiv');

// ----- Reset Button -----
const resetBtn = document.createElement('button');
resetBtn.textContent = "Reset Daily Count 🔄";
document.querySelector('main').appendChild(resetBtn);

// ----- Initial UI -----
blinkCountDiv.textContent = blinkCount;
streakDiv.textContent = `${streak} days`;
badgeDiv.textContent = badges.length ? badges.join(', ') : 'None';

// ----- Chart.js -----
const ctx = document.getElementById('blinkChart').getContext('2d');
const blinkChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: dailyLog.map((_, i) => `Session ${i+1}`),
    datasets: [{
      label: 'Blinks per Session',
      data: dailyLog,
      fill: true,
      backgroundColor: 'rgba(0,121,107,0.2)',
      borderColor: '#00796b',
      tension: 0.3
    }]
  },
  options: { scales: { y: { beginAtZero:true, stepSize:1 } } }
});

function updateChart() {
  blinkChart.data.labels = dailyLog.map((_, i) => `Session ${i+1}`);
  blinkChart.data.datasets[0].data = dailyLog;
  blinkChart.update();
}

// ----- Timer -----
function updateTimerDisplay() {
  const mins = Math.floor(timer / 60);
  const secs = Math.floor(timer % 60);
  minutesSpan.textContent = mins.toString().padStart(2,'0');
  secondsSpan.textContent = secs.toString().padStart(2,'0');
}

setInterval(() => {
  timer--;
  if(timer <= 0){
    alert("Time to check your blinks!");
    dailyLog.push(blinkCount);
    localStorage.setItem('dailyLog', JSON.stringify(dailyLog));
    updateChart();

    const dailyGoal = 5;
    if(blinkCount >= dailyGoal){
      streak++;
      localStorage.setItem('streak', streak);
      streakDiv.textContent = `${streak} days`;

      const badgeName = `Goal Achieved ${streak}d`;
      if(!badges.includes(badgeName)){
        badges.push(badgeName);
        localStorage.setItem('badges', JSON.stringify(badges));
        badgeDiv.textContent = badges.join(', ');
      }
    }

    timer = reminderMinutes*60;
  }
  updateTimerDisplay();
},1000);

// ----- Reset -----
resetBtn.addEventListener('click', () => {
  blinkCount = 0; dailyLog=[]; streak=0; badges=[];
  localStorage.setItem('blinkCount', blinkCount);
  localStorage.setItem('dailyLog', JSON.stringify(dailyLog));
  localStorage.setItem('streak', streak);
  localStorage.setItem('badges', JSON.stringify(badges));

  blinkCountDiv.textContent = blinkCount;
  streakDiv.textContent = `${streak} days`;
  badgeDiv.textContent = 'None';
  updateChart();
});

// ----- Export CSV -----
function exportCSV(){
  let csv = "Session,Blinks\n";
  dailyLog.forEach((val,i)=>{csv += `${i+1},${val}\n`;});
  const blob = new Blob([csv], {type: "text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = "blink_report.csv";
  a.click(); URL.revokeObjectURL(url);
}

// ----- Polished Export Card -----
const exportCard = document.createElement('section');
exportCard.className = "card";
const exportTitle = document.createElement('h2');
exportTitle.textContent = "Export Data";
const exportButton = document.createElement('button');
exportButton.textContent = "Download Daily Report 📄";
exportButton.addEventListener("click", exportCSV);
exportCard.appendChild(exportTitle);
exportCard.appendChild(exportButton);
document.querySelector('main').appendChild(exportCard);

// ----- Webcam Blink Detection -----
const videoElement = document.getElementById('webcam');
let prevEyeState = "open";
let lastBlinkTime = 0;

function computeEAR(landmarks, side){
  const indices = side==='left'? [33,160,158,133,153,144] : [362,385,387,263,373,380];
  const p1=landmarks[indices[0]], p2=landmarks[indices[1]], p3=landmarks[indices[2]];
  const p4=landmarks[indices[3]], p5=landmarks[indices[4]], p6=landmarks[indices[5]];
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  return (dist(p2,p6)+dist(p3,p5))/(2*dist(p1,p4));
}

function onResults(results){
  if(!results.multiFaceLandmarks) return;
  const landmarks = results.multiFaceLandmarks[0];
  const leftEAR = computeEAR(landmarks,'left');
  const rightEAR = computeEAR(landmarks,'right');
  const avgEAR = (leftEAR+rightEAR)/2;
  const EAR_THRESHOLD=0.25;
  const now = Date.now();

  if(avgEAR < EAR_THRESHOLD && prevEyeState === "open"){
    if(now - lastBlinkTime > 200){ // min 200ms between blinks
      blinkCount++;
      localStorage.setItem('blinkCount', blinkCount);
      blinkCountDiv.textContent = blinkCount;

      blinkCountDiv.style.transform='scale(1.3)';
      setTimeout(()=>{blinkCountDiv.style.transform='scale(1)';},200);

      lastBlinkTime = now;
    }
    prevEyeState = "closed";
  }

  if(avgEAR >= EAR_THRESHOLD && prevEyeState === "closed"){
    prevEyeState = "open";
  }
}

const faceMesh = new FaceMesh({locateFile: (file)=>`https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`});
faceMesh.setOptions({maxNumFaces:1, refineLandmarks:true, minDetectionConfidence:0.5, minTrackingConfidence:0.5});
faceMesh.onResults(onResults);

const camera = new Camera(videoElement, {onFrame: async()=>{await faceMesh.send({image:videoElement});}, width:320, height:240});
camera.start();

updateChart();
updateTimerDisplay();
