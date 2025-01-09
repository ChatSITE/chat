// 現在時刻をリアルタイムで更新する関数
function updateClock() {
    const currentTimeElement = document.getElementById('current-time');
    const now = new Date();

    // 時間、分、秒を取得し、2桁にフォーマット
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    // 時刻を表示
    currentTimeElement.textContent = `${hours}:${minutes}:${seconds}`;
}

// 1秒ごとに時刻を更新
setInterval(updateClock, 1000);

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
const questionButtons = document.querySelectorAll('.question-btn');

// 問題番号の変更
questionButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const questionNumber = button.dataset.question;
        database.ref('currentQuestion').set(parseInt(questionNumber));
        alert(`問題${questionNumber} に切り替わりました！`);
    });
});

// テーブル更新
const tableBody = document.getElementById('response-table');
database.ref('responses').on('child_added', (snapshot) => {
    const data = snapshot.val();
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${data.word}</td>
        <td>${data.team || "不明"}</td>
        <td>${data.timestamp}</td>
    `;
    tableBody.appendChild(row);
});
