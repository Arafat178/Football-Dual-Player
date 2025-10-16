// --- Firebase সেটআপ ---
const firebaseConfig = {
    apiKey: "AIzaSyDoNuFXzhRu6sXcc-uSQ3L42rOEQEjr56E",
    authDomain: "football-dual-player.firebaseapp.com",
    databaseURL: "https://football-dual-player-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "football-dual-player",
    storageBucket: "football-dual-player.appspot.com",
    messagingSenderId: "741588041503",
    appId: "1:741588041503:web:0631710278be023b2efa2a",
    measurementId: "G-PPRPB8DWSC"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// --- HTML এলিমেন্ট ---
const lobby = document.getElementById('lobby');
const createGameBtn = document.getElementById('create-game-btn');
const roomIdInput = document.getElementById('room-id-input');
const joinGameBtn = document.getElementById('join-game-btn');
const playerNameInput = document.getElementById('player-name-input');
const gameContent = document.getElementById('game-content');
const player1Elem = document.getElementById('player1');
const player2Elem = document.getElementById('player2');
const ballElem = document.getElementById('ball');
const player1ScoreElem = document.getElementById('player1-score');
const player2ScoreElem = document.getElementById('player2-score');
const player1NameElem = document.getElementById('player1-name');
const player2NameElem = document.getElementById('player2-name');
const timerDisplay = document.getElementById('timer');
const goalText = document.getElementById('goal-text');
const gameOverOverlay = document.getElementById('game-over-overlay');
const gameOverMessage = document.getElementById('game-over-message');
const playAgainBtn = document.getElementById('play-again-btn');
const moveLeftBtn = document.getElementById('move-left');
const moveRightBtn = document.getElementById('move-right');
const kickBtn = document.getElementById('kick');
const kickSound = document.getElementById('kick-sound');
const goalSound = document.getElementById('goal-sound');
const fireworksContainer = document.getElementById('fireworks-container'); // ADDED
const backgroundMusic = document.getElementById('background-music');


// --- গেম ভ্যারিয়েবল ---
let gameRoomId;
let localPlayerId;
let gameRef;
let hostPlayer = false;
let animationFrameId;
let lastTimeUpdate = 0;

// --- লবি লজিক ---
createGameBtn.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    gameRoomId = roomIdInput.value.trim().toLowerCase();

    if (!playerName) return alert("Please enter your name.");
    if (!gameRoomId) return alert("Please enter a Game ID to create a game.");

    gameRef = database.ref('rooms/' + gameRoomId);
    localPlayerId = 'player1';
    hostPlayer = true;

    gameRef.once('value', (snapshot) => {
        if (snapshot.exists()) {
            alert("This Game ID is already taken. Please try a different one.");
        } else {
            const initialGameState = {
                player1: { x: 125, move: 'none', kick: false, name: playerName },
                player2: { x: 125, move: 'none', kick: false, name: 'Waiting...' },
                ball: { x: 141, y: 445, speedX: 0, speedY: 0 },
                score: { player1: 0, player2: 0 },
                time: 180, //game time setup
                status: 'waiting'
            };
            gameRef.set(initialGameState).then(() => {
                listenToGameUpdates();
            });
        }
    });
});

joinGameBtn.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    gameRoomId = roomIdInput.value.trim().toLowerCase();
    
    if (!playerName) return alert("Please enter your name.");
    if (!gameRoomId) return alert("Please enter a Game ID.");

    gameRef = database.ref('rooms/' + gameRoomId);
    localPlayerId = 'player2';

    gameRef.once('value', (snapshot) => {
        const gameState = snapshot.val();
        if (gameState && gameState.status === 'waiting') {
            gameRef.update({
                'player2/name': playerName,
                'status': 'playing'
            }).then(() => {
                listenToGameUpdates();
            });
        } else if (gameState) {
             alert("This game has already started or ended.");
        } else {
            alert("Game ID not found!");
        }
    });
});

function listenToGameUpdates() {
    lobby.classList.add('hidden');
    gameContent.classList.remove('hidden');
    backgroundMusic.volume = 0.3;

    // ADDED: Start background music
    backgroundMusic.play().catch(error => {
        // This catch block handles cases where the browser blocks autoplay
        console.log("Background music couldn't play automatically. A user interaction might be needed.", error);
    });

    gameRef.on('value', (snapshot) => {
        const gameState = snapshot.val();
        if (!gameState) return;

        // ... (rest of the function is the same)
        const oldScore = (window.localGameState && window.localGameState.score) || { player1: 0, player2: 0 };
        window.localGameState = gameState;

        player1Elem.style.left = gameState.player1.x + 'px';
        player2Elem.style.left = gameState.player2.x + 'px';
        ballElem.style.left = gameState.ball.x + 'px';
        ballElem.style.top = gameState.ball.y + 'px';
        
        if (gameState.score.player1 > oldScore.player1 || gameState.score.player2 > oldScore.player2) {
            showGoalAnimation();
        }
        player1ScoreElem.innerText = gameState.score.player1;
        player2ScoreElem.innerText = gameState.score.player2;

        player1NameElem.innerText = gameState.player1.name || 'Player 1';
        player2NameElem.innerText = gameState.player2.name || 'Player 2';

        const minutes = Math.floor(gameState.time / 60);
        const seconds = gameState.time % 60;
        timerDisplay.innerText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

        if (gameState.time <= 0 && gameState.status === 'playing') {
            endGame(gameState);
        }
    });

    if (hostPlayer) {
        cancelAnimationFrame(animationFrameId);
        lastTimeUpdate = Date.now();
        gameLoop();
    }
}

// --- প্লেয়ার কন্ট্রোল (সংকেত পাঠানো) ---
function sendMoveIntent(direction) { if(gameRef) gameRef.child(localPlayerId).child('move').set(direction); }
function stopMoveIntent() { if(gameRef) gameRef.child(localPlayerId).child('move').set('none'); }
function sendKickIntent() { if(gameRef) gameRef.child(localPlayerId).child('kick').set(true); }

['mousedown', 'touchstart'].forEach(evt => {
    moveLeftBtn.addEventListener(evt, (e) => { e.preventDefault(); sendMoveIntent('left'); });
    moveRightBtn.addEventListener(evt, (e) => { e.preventDefault(); sendMoveIntent('right'); });
    kickBtn.addEventListener(evt, (e) => { e.preventDefault(); sendKickIntent(); });
});
['mouseup', 'touchend', 'mouseleave'].forEach(evt => { document.addEventListener(evt, stopMoveIntent); });

// --- গেম ফিজিক্স এবং লুপ (শুধুমাত্র হোস্টের জন্য) ---
function gameLoop() {
    if (!hostPlayer) return;
    
    gameRef.transaction((gameState) => {
        if (gameState && gameState.status === 'playing') {
            if (gameState.player1.move === 'left' && gameState.player1.x > 0) gameState.player1.x -= 5;
            if (gameState.player1.move === 'right' && gameState.player1.x < 250) gameState.player1.x += 5;
            if (gameState.player2.move === 'left' && gameState.player2.x > 0) gameState.player2.x -= 5;
            if (gameState.player2.move === 'right' && gameState.player2.x < 250) gameState.player2.x += 5;
            
            if (gameState.player1.kick) handleKickPhysics(gameState.player1, gameState.ball, 'player1');
            if (gameState.player2.kick) handleKickPhysics(gameState.player2, gameState.ball, 'player2');
            gameState.player1.kick = false;
            gameState.player2.kick = false;
            
            gameState.ball.x += gameState.ball.speedX;
            gameState.ball.y += gameState.ball.speedY;
            gameState.ball.speedX *= 0.99;
            gameState.ball.speedY *= 0.99;
            if (gameState.ball.x <= 0 || gameState.ball.x >= 282) gameState.ball.speedX *= -1;
            
            let scorer = null;
            if (gameState.ball.y <= 0) { scorer = 'player1'; } 
            else if (gameState.ball.y >= 482) { scorer = 'player2'; }
            if (scorer) {
                gameState.score[scorer]++;
                resetBall(scorer, gameState.ball);
            }
            
            const now = Date.now();
            if (now - lastTimeUpdate > 1000) {
                gameState.time = Math.max(0, gameState.time - 1);
                lastTimeUpdate = now;
            }
        }
        return gameState;
    });

    animationFrameId = requestAnimationFrame(gameLoop);
}

function handleKickPhysics(playerState, ballState, playerId) {
    kickSound.play();
    const playerY = playerId === 'player1' ? 465 : 10;
    const playerCenterX = playerState.x + 25;
    const playerCenterY = playerY + 12.5;
    const ballCenterX = ballState.x + 9;
    const ballCenterY = ballState.y + 9;
    const distance = Math.sqrt(Math.pow(playerCenterX - ballCenterX, 2) + Math.pow(playerCenterY - ballCenterY, 2));

    if (distance < 40) {
        let kickDirectionY = playerId === 'player1' ? -1 : 1;
        ballState.speedY = 10 * kickDirectionY;
        ballState.speedX = (ballCenterX - playerCenterX) / 3;
    }
}

function resetBall(scorer, ball) {
    ball.speedX = 0;
    ball.speedY = 0;
    if (scorer === 'player1') {
        ball.x = 141;
        ball.y = 40;
    } else {
        ball.x = 141;
        ball.y = 445;
    }
}

function createFireworks() {
    const numParticles = 40;
    const boardCenterX = 150;
    const boardCenterY = 250;
    for (let i = 0; i < numParticles; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        particle.style.left = `${boardCenterX}px`;
        particle.style.top = `${boardCenterY}px`;
        particle.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 70%)`;
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 120 + 50;
        const targetX = Math.cos(angle) * distance;
        const targetY = Math.sin(angle) * distance;
        particle.style.setProperty('--tx', `${targetX}px`);
        particle.style.setProperty('--ty', `${targetY}px`);
        fireworksContainer.appendChild(particle);
    }
}

function showGoalAnimation() {
    goalSound.play();
    goalText.style.display = 'block';
    createFireworks();
    setTimeout(() => { 
        goalText.style.display = 'none'; 
        fireworksContainer.innerHTML = '';
    }, 2000);
}

// --- CHANGED: Updated endGame function ---
function endGame(gameState) {
    cancelAnimationFrame(animationFrameId);
    backgroundMusic.pause(); // Stop the background music
    backgroundMusic.currentTime = 0; // Optional: Reset music to the start

    if (hostPlayer) {
        gameRef.child('status').set('ended');
        saveGameResult(gameState);
    }
    
    const p1Name = gameState.player1.name || 'Player 1';
    const p2Name = gameState.player2.name || 'Player 2';

    if (gameState.score.player1 > gameState.score.player2) {
        gameOverMessage.innerText = `${p1Name} Wins!`;
    } else if (gameState.score.player2 > gameState.score.player1) {
        gameOverMessage.innerText = `${p2Name} Wins!`;
    } else {
        gameOverMessage.innerText = "It's a Draw!";
    }
    
    gameOverOverlay.style.display = 'flex';
    showLeaderboard();
    hostPlayer = false;
}

// --- ADDED: New function to save game result ---
function saveGameResult(gameState) {
    const gameResult = {
        p1Name: gameState.player1.name || 'Player 1',
        p1Score: gameState.score.player1,
        p2Name: gameState.player2.name || 'Player 2',
        p2Score: gameState.score.player2,
        timestamp: firebase.database.ServerValue.TIMESTAMP // For sorting
    };
    database.ref('gameHistory').push(gameResult);
}

// --- ADDED: New function to show leaderboard ---
function showLeaderboard() {
    const leaderboardList = document.getElementById('leaderboard-list');
    const historyRef = database.ref('gameHistory');

    // Fetch the last 5 game results, ordered by time
    historyRef.orderByChild('timestamp').limitToLast(5).once('value', (snapshot) => {
        leaderboardList.innerHTML = ''; // Clear previous list
        if (!snapshot.exists()) {
            leaderboardList.innerHTML = '<li>No games played yet.</li>';
            return;
        }

        const games = [];
        snapshot.forEach(childSnapshot => {
            games.push(childSnapshot.val());
        });

        // Reverse to show the most recent game first
        games.reverse().forEach(game => {
            const listItem = document.createElement('li');
            listItem.textContent = `${game.p1Name} ${game.p1Score} - ${game.p2Score} ${game.p2Name}`;
            leaderboardList.appendChild(listItem);
        });
    });
}

playAgainBtn.addEventListener('click', () => { window.location.reload(); });