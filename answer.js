// Firebase 初期化
const firebaseConfig = {
apiKey: "AIzaSyDvIL9X-qSqsw6i3Rp4TK98uygSfmI0v4A",
authDomain: "chat-a1eca.firebaseapp.com",
databaseURL: "https://chat-a1eca-default-rtdb.firebaseio.com",
projectId: "chat-a1eca",
storageBucket: "chat-a1eca.appspot.com",
messagingSenderId: "872682257719",
appId: "your-app-id",
measurementId: "1:872682257719:web:efdf8105ece4e019516eb2"
};
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// DOM要素
const teamInput = document.getElementById('teamName');
const registerButton = document.getElementById('registerTeam');
const teamDisplay = document.getElementById('teamDisplay');
const teamNameDisplay = document.getElementById('teamNameDisplay');
const cardContainer = document.querySelector('.card-container');

// 問題データ
const questions = {
    1: ["coming", "voyaging", "ancestor", "kite", "wayfinder", "weaving", "thriving", "roof", "dream", "view"],
    2: ["apple", "banana", "cherry", "date", "elderberry", "fig", "grape", "honeydew", "kiwi", "lemon"],
    3: ["dog", "cat", "bird", "fish", "lion", "tiger", "bear", "rabbit", "horse", "elephant"],
    4: ["red", "blue", "green", "yellow", "purple", "orange", "pink", "brown", "black", "white"]
};
let teamName = "";

// チーム名登録
registerButton.addEventListener('click', () => {
    teamName = teamInput.value.trim();
    if (!teamName) {
        alert("チーム名を入力してください！");
        return;
    }
    database.ref(`teams/${teamName}`).set({
        name: teamName,
        pressedWords: []
    });
    teamNameDisplay.textContent = teamName;
    teamInput.style.display = "none";
    registerButton.style.display = "none";
    teamDisplay.style.display = "block";
    cardContainer.style.display = "grid";
});

// 単語リスト更新
function updateWords(questionNumber) {
    const words = questions[questionNumber] || [];
    cardContainer.innerHTML = ""; // 既存の単語カードを削除
    words.forEach((word) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerText = word;
        card.addEventListener('click', () => {
            sendWord(word);
        });
        cardContainer.appendChild(card);
    });
}

// 問題番号の変更を検知
database.ref('currentQuestion').on('value', (snapshot) => {
    const questionNumber = snapshot.val();
    if (questionNumber) {
        updateWords(questionNumber);
    }
});

// Firebaseにデータ送信
function sendWord(word) {
    if (!teamName) {
        alert("チーム名を登録してください！");
        return;
    }
    const now = new Date();
    const timeString = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`; // 時:分:秒形式
    database.ref('responses').push({
        word: word,
        team: teamName,
        timestamp: timeString
    });
    alert(`${teamName} が ${word} を送信しました！`);
}
