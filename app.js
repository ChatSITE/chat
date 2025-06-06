// Firebase設定
const firebaseConfig = {
    // ここにFirebaseの設定情報を入力してください
apiKey: "AIzaSyDvIL9X-qSqsw6i3Rp4TK98uygSfmI0v4A",
authDomain: "chat-a1eca.firebaseapp.com",
databaseURL: "https://chat-a1eca-default-rtdb.firebaseio.com",
projectId: "chat-a1eca",
storageBucket: "chat-a1eca.appspot.com",
messagingSenderId: "872682257719",
appId: "your-app-id",
measurementId: "1:872682257719:web:efdf8105ece4e019516eb2"
};

// Firebaseの初期化
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();
const storage = firebase.storage();

// DOM要素
const screens = {
    login: document.getElementById('login-screen'),
    signup: document.getElementById('signup-screen'),
    home: document.getElementById('home-screen'),
    chat: document.getElementById('chat-screen')
};

const tabs = {
    rooms: document.getElementById('rooms-tab'),
    friends: document.getElementById('friends-tab'),
    requests: document.getElementById('requests-tab'),
    profile: document.getElementById('profile-tab')
};

const modals = {
    createRoom: document.getElementById('create-room-modal'),
    joinRoom: document.getElementById('join-room-modal'),
    userProfile: document.getElementById('user-profile-modal')
};

// グローバル変数
let currentUser = null;
let currentRoomId = null;
let typing = false;
let typingTimeout = null;
let lastTypingTime = 0;
let currentRealTimeText = '';
let isTyping = {};

// ユーティリティ関数
function showScreen(screenId) {
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    screens[screenId].classList.remove('hidden');
}

function showTab(tabId) {
    Object.values(tabs).forEach(tab => tab.classList.add('hidden'));
    tabs[tabId].classList.remove('hidden');
    
    // タブボタンのアクティブ状態を更新
    document.querySelectorAll('.tab').forEach(tab => {
        if (tab.dataset.tab === tabId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

function showModal(modalId) {
    modals[modalId].classList.remove('hidden');
}

function hideModal(modalId) {
    modals[modalId].classList.add('hidden');
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i <.6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

// オンライン状態の管理
function setUserOnlineStatus(status) {
    if (!currentUser) return;
    
    const userStatusRef = database.ref(`users/${currentUser.uid}/status`);
    const userLastOnlineRef = database.ref(`users/${currentUser.uid}/lastOnline`);
    
    userStatusRef.set(status);
    
    if (status === 'offline') {
        userLastOnlineRef.set(firebase.database.ServerValue.TIMESTAMP);
    }
}

// Firebaseの接続状態を監視して自動的にオンライン/オフライン状態を更新
function setupPresence() {
    const connectedRef = database.ref('.info/connected');
    
    connectedRef.on('value', (snap) => {
        if (snap.val() === true && currentUser) {
            // ユーザーがオンラインになった時
            const userStatusRef = database.ref(`users/${currentUser.uid}/status`);
            
            // オフラインになった時に自動的に状態を更新するように設定
            userStatusRef.onDisconnect().set('offline');
            userStatusRef.onDisconnect().update({
                lastOnline: firebase.database.ServerValue.TIMESTAMP
            });
            
            // オンライン状態を設定
            setUserOnlineStatus('online');
        }
    });
}

// ユーザー認証関連の機能
function setupAuthListeners() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            
            // ユーザープロファイル情報を取得
            fetchUserProfile();
            
            // オンライン状態の管理を設定
            setupPresence();
            
            // ホーム画面に遷移
            showScreen('home');
            showTab('rooms');
            
            // 各種データをロード
            loadRooms();
            loadFriends();
            loadFriendRequests();
        } else {
            currentUser = null;
            showScreen('login');
        }
    });
}

function fetchUserProfile() {
    const userRef = database.ref(`users/${currentUser.uid}`);
    
    userRef.once('value', (snapshot) => {
        const userData = snapshot.val();
        
        if (userData) {
            // UIにユーザー情報を表示
            document.getElementById('user-name').textContent = userData.username || 'ユーザー名未設定';
            
            if (userData.photoURL) {
                document.getElementById('user-avatar').src = userData.photoURL;
                document.getElementById('current-avatar').src = userData.photoURL;
            }
            
            document.getElementById('update-username').value = userData.username || '';
        } else {
            // 初回ログイン時は基本情報を設定
            const displayName = currentUser.displayName || currentUser.email.split('@')[0];
            const photoURL = currentUser.photoURL || 'avatar-placeholder.png';
            
            userRef.set({
                username: displayName,
                email: currentUser.email,
                photoURL: photoURL,
                status: 'online',
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
            
            document.getElementById('user-name').textContent = displayName;
            document.getElementById('user-avatar').src = photoURL;
            document.getElementById('current-avatar').src = photoURL;
            document.getElementById('update-username').value = displayName;
        }
    });
}

// Google認証
function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    
    auth.signInWithPopup(provider)
        .catch((error) => {
            alert(`ログインエラー: ${error.message}`);
        });
}

// メールアドレスとパスワードでログイン
function signInWithEmail(email, password) {
    auth.signInWithEmailAndPassword(email, password)
        .catch((error) => {
            alert(`ログインエラー: ${error.message}`);
        });
}

// 新規ユーザー登録
function createUserWithEmail(username, email, password, profileImage) {
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            
// プロフィール画像のアップロード
            if (profileImage) {
                const storageRef = storage.ref(`profile_images/${user.uid}`);
                
                storageRef.put(profileImage).then(() => {
                    return storageRef.getDownloadURL();
                }).then((downloadURL) => {
                    // ユーザープロフィールを保存
                    database.ref(`users/${user.uid}`).set({
                        username: username,
                        email: email,
                        photoURL: downloadURL,
                        status: 'online',
                        createdAt: firebase.database.ServerValue.TIMESTAMP
                    });
                });
            } else {
                // 画像なしでユーザープロフィールを保存
                database.ref(`users/${user.uid}`).set({
                    username: username,
                    email: email,
                    photoURL: 'avatar-placeholder.png',
                    status: 'online',
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                });
            }
        })
        .catch((error) => {
            alert(`アカウント作成エラー: ${error.message}`);
        });
}

// ログアウト
function signOut() {
    // オフライン状態に設定
    setUserOnlineStatus('offline');
    
    auth.signOut().catch((error) => {
        console.error('ログアウトエラー:', error);
    });
}

// プロフィール更新
function updateProfile(username, profileImage) {
    if (!currentUser) return;
    
    const userRef = database.ref(`users/${currentUser.uid}`);
    
    // ユーザー名の更新
    userRef.update({
        username: username
    });
    
    document.getElementById('user-name').textContent = username;
    
    // プロフィール画像がある場合はアップロード
    if (profileImage) {
        const storageRef = storage.ref(`profile_images/${currentUser.uid}`);
        
        storageRef.put(profileImage).then(() => {
            return storageRef.getDownloadURL();
        }).then((downloadURL) => {
            userRef.update({
                photoURL: downloadURL
            });
            
            document.getElementById('user-avatar').src = downloadURL;
            document.getElementById('current-avatar').src = downloadURL;
        }).catch((error) => {
            console.error('画像アップロードエラー:', error);
        });
    }
}

// ルーム関連の機能
function createRoom(roomName) {
    if (!currentUser) return;
    
    const roomsRef = database.ref('rooms');
    const newRoomRef = roomsRef.push();
    const roomId = newRoomRef.key;
    const roomCode = generateRoomCode();
    
    // ルーム作成
    newRoomRef.set({
        name: roomName,
        createdBy: currentUser.uid,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        code: roomCode
    }).then(() => {
        // 参加者情報を追加
        const participantRef = database.ref(`room_participants/${roomId}/${currentUser.uid}`);
        participantRef.set(true);
        
        // ユーザーのルーム参加情報を更新
        const userRoomRef = database.ref(`user_rooms/${currentUser.uid}/${roomId}`);
        userRoomRef.set({
            joinedAt: firebase.database.ServerValue.TIMESTAMP
        });
        
        // ルームに入室
        enterRoom(roomId);
    }).catch((error) => {
        console.error('ルーム作成エラー:', error);
    });
}

function joinRoomByCode(code) {
    if (!currentUser) return;
    
    const roomsRef = database.ref('rooms');
    
    // 招待コードからルームを検索
    roomsRef.orderByChild('code').equalTo(code).once('value', (snapshot) => {
        if (snapshot.exists()) {
            const roomData = snapshot.val();
            const roomId = Object.keys(roomData)[0];
            
            // 参加者情報を追加
            const participantRef = database.ref(`room_participants/${roomId}/${currentUser.uid}`);
            participantRef.set(true);
            
            // ユーザーのルーム参加情報を更新
            const userRoomRef = database.ref(`user_rooms/${currentUser.uid}/${roomId}`);
            userRoomRef.set({
                joinedAt: firebase.database.ServerValue.TIMESTAMP
            });
            
            // ルームに入室
            enterRoom(roomId);
        } else {
            alert('無効な招待コードです。');
        }
    }).catch((error) => {
        console.error('ルーム参加エラー:', error);
    });
}

function loadRooms() {
    if (!currentUser) return;
    
    const userRoomsRef = database.ref(`user_rooms/${currentUser.uid}`);
    
    userRoomsRef.on('value', (snapshot) => {
        const userRooms = snapshot.val() || {};
        const roomIds = Object.keys(userRooms);
        const roomList = document.getElementById('room-list');
        
        // ルームリストをクリア
        roomList.innerHTML = '';
        
        if (roomIds.length === 0) {
            roomList.innerHTML = '<p class="text-center">参加中のルームはありません</p>';
            return;
        }
        
        // 各ルームの情報を取得して表示
        roomIds.forEach((roomId) => {
            const roomRef = database.ref(`rooms/${roomId}`);
            
            roomRef.once('value', (roomSnapshot) => {
                const roomData = roomSnapshot.val();
                
                if (roomData) {
                    // 参加者数を取得
                    const participantsRef = database.ref(`room_participants/${roomId}`);
                    
                    participantsRef.once('value', (participantsSnapshot) => {
                        const participantCount = participantsSnapshot.numChildren();
                        
                        // ルームアイテムを作成
                        const roomItem = document.createElement('div');
                        roomItem.className = 'list-item';
                        roomItem.innerHTML = `
                            <div class="list-item-info">
                                <div class="list-item-name">${roomData.name}</div>
                                <div class="list-item-status">${participantCount}人参加中 · コード: ${roomData.code}</div>
                            </div>
                        `;
                        
                        // ルームをクリックした時の処理
                        roomItem.addEventListener('click', () => {
                            enterRoom(roomId);
                        });
                        
                        roomList.appendChild(roomItem);
                    });
                }
            });
        });
    });
}

function enterRoom(roomId) {
    if (!currentUser) return;
    
    currentRoomId = roomId;
    
    // ルーム情報を取得
    const roomRef = database.ref(`rooms/${roomId}`);
    
    roomRef.once('value', (snapshot) => {
        const roomData = snapshot.val();
        
        if (roomData) {
            // チャット画面に遷移
            showScreen('chat');
            
            // ルーム情報を表示
            document.getElementById('room-title').textContent = roomData.name;
            document.getElementById('room-code-display').textContent = roomData.code;
            
            // メッセージコンテナをクリア
            document.getElementById('chat-messages').innerHTML = '';
            
            // 参加者一覧を表示
            loadParticipants(roomId);
            
            // メッセージの読み込み
            loadMessages(roomId);
            
            // メッセージ入力欄にフォーカス
            document.getElementById('message-input').focus();
        } else {
            alert('ルームが見つかりませんでした。');
        }
    });
}

function loadParticipants(roomId) {
    const participantsRef = database.ref(`room_participants/${roomId}`);
    const participantsList = document.getElementById('participants-list');
    
    participantsRef.on('value', (snapshot) => {
        const participants = snapshot.val() || {};
        const participantIds = Object.keys(participants);
        
        // 参加者リストをクリア
        participantsList.innerHTML = '';
        
        // 各参加者の情報を取得して表示
        participantIds.forEach((userId) => {
            const userRef = database.ref(`users/${userId}`);
            
            userRef.once('value', (userSnapshot) => {
                const userData = userSnapshot.val();
                
                if (userData) {
                    // 参加者アイテムを作成
                    const participantItem = document.createElement('div');
                    participantItem.className = 'participant';
                    participantItem.innerHTML = `
                        <div class="participant-avatar">
                            <img src="${userData.photoURL || 'avatar-placeholder.png'}" alt="${userData.username}">
                            <span class="online-indicator ${userData.status === 'online' ? '' : 'offline-indicator'}"></span>
                        </div>
                        <div class="participant-name">${userData.username}</div>
                    `;
                    
                    // 参加者をクリックした時の処理
                    participantItem.addEventListener('click', () => {
                        showUserProfile(userId);
                    });
                    
                    participantsList.appendChild(participantItem);
                }
            });
        });
    });
}

// リアルタイムテキスト通話機能
function setupRealtimeText() {
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    
    // 入力中の状態を管理
    messageInput.addEventListener('input', () => {
        if (!currentUser || !currentRoomId) return;
        
        const text = messageInput.value.trim();
        
        // 入力があれば送信ボタンを有効化
        sendBtn.disabled = text.length === 0;
        
        // リアルタイムテキスト更新
        updateRealtimeText(text);
        
        // タイピング状態の更新
        updateTypingStatus();
    });
    
    // テキスト送信
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

function updateRealtimeText(text) {
    if (!currentUser || !currentRoomId) return;
    
    // 現在の入力内容を保存
    currentRealTimeText = text;
    
    // リアルタイムテキストのデータを更新
    const realtimeTextRef = database.ref(`realtime_text/${currentRoomId}/${currentUser.uid}`);
    realtimeTextRef.set({
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        userId: currentUser.uid
    });
}

function updateTypingStatus() {
    if (!currentUser || !currentRoomId) return;
    
    const now = new Date().getTime();
    
    // 最後のタイピングから5秒以上経過している場合は新しいタイピング状態を設定
    if (!typing || now - lastTypingTime > 5000) {
        typing = true;
        lastTypingTime = now;
        
        // タイピング状態を更新
        const typingRef = database.ref(`typing/${currentRoomId}/${currentUser.uid}`);
        typingRef.set(true);
        
        // 5秒後にタイピング状態をリセット
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            resetTypingStatus();
        }, 5000);
    }
}

function resetTypingStatus() {
    if (!currentUser || !currentRoomId) return;
    
    typing = false;
    
    // タイピング状態を削除
    const typingRef = database.ref(`typing/${currentRoomId}/${currentUser.uid}`);
    typingRef.remove();
}

function listenForTypingIndicators(roomId) {
    const typingRef = database.ref(`typing/${roomId}`);
    const typingIndicator = document.getElementById('typing-indicator');
    
    typingRef.on('value', (snapshot) => {
        const typingUsers = snapshot.val() || {};
        const typingUserIds = Object.keys(typingUsers).filter(id => id !== currentUser.uid);
        
        if (typingUserIds.length > 0) {
            // タイピング中のユーザー名を取得
            const userRef = database.ref(`users/${typingUserIds[0]}`);
            
            userRef.once('value', (userSnapshot) => {
                const userData = userSnapshot.val();
                
                if (userData) {
                    // タイピングインジケータを表示
                    document.querySelector('.typing-user').textContent = userData.username;
                    typingIndicator.classList.remove('hidden');
                }
            });
        } else {
            // タイピングインジケータを非表示
            typingIndicator.classList.add('hidden');
        }
    });
}

function listenForRealtimeText(roomId) {
    const realtimeTextRef = database.ref(`realtime_text/${roomId}`);
    
    realtimeTextRef.on('value', (snapshot) => {
        const realtimeTexts = snapshot.val() || {};
        
        // 自分のテキストは除外
        Object.keys(realtimeTexts).forEach((userId) => {
            if (userId !== currentUser.uid) {
                const textData = realtimeTexts[userId];
                
                // 最新のメッセージに反映
                updateLatestMessage(userId, textData.text);
            }
        });
    });
}

function updateLatestMessage(userId, text) {
    // ユーザーIDとテキストに基づいて最新メッセージを更新または作成
    const messagesContainer = document.getElementById('chat-messages');
    let messageElement = messagesContainer.querySelector(`.realtime-message[data-user="${userId}"]`);
    
    if (!messageElement) {
        // ユーザー情報を取得
        database.ref(`users/${userId}`).once('value', (snapshot) => {
            const userData = snapshot.val();
            
            if (userData) {
                // 新しいメッセージ要素を作成
                messageElement = document.createElement('div');
                messageElement.className = 'message-wrapper';
                messageElement.classList.add('realtime-message');
                messageElement.setAttribute('data-user', userId);
                
                messageElement.innerHTML = `
                    <img src="${userData.photoURL || 'avatar-placeholder.png'}" alt="${userData.username}" class="message-avatar">
                    <div class="message-content">
                        <div class="message-info">
                            <span class="message-sender">${userData.username}</span>
                            <span class="message-time">${formatTime(Date.now())}</span>
                        </div>
                        <div class="message-bubble realtime-bubble">${text}</div>
                    </div>
                `;
                
                messagesContainer.appendChild(messageElement);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        });
    } else {
        // 既存のメッセージを更新
        const bubble = messageElement.querySelector('.realtime-bubble');
        bubble.textContent = text;
    }
}

function sendMessage() {
    if (!currentUser || !currentRoomId) return;
    
    const messageInput = document.getElementById('message-input');
    const text = messageInput.value.trim();
    
    if (text.length === 0) return;
    
    // メッセージを保存
    const messagesRef = database.ref(`messages/${currentRoomId}`);
    const newMessageRef = messagesRef.push();
    
    newMessageRef.set({
        text: text,
        senderId: currentUser.uid,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    // 入力フィールドをクリア
    messageInput.value = '';
    
    // リアルタイムテキストをクリア
    updateRealtimeText('');
    
    // タイピング状態をリセット
    resetTypingStatus();
    
    // 送信ボタンを無効化
    document.getElementById('send-btn').disabled = true;
}

function loadMessages(roomId) {
    const messagesRef = database.ref(`messages/${roomId}`);
    const messagesContainer = document.getElementById('chat-messages');
    
    // リアルタイムテキストとタイピングインジケータのリスナーを設定
    listenForRealtimeText(roomId);
    listenForTypingIndicators(roomId);
    
    // 過去のメッセージを読み込み
    messagesRef.on('child_added', (snapshot) => {
        const message = snapshot.val();
        const messageId = snapshot.key;
        
        // リアルタイムメッセージを削除
        const realtimeMessage = messagesContainer.querySelector(`.realtime-message[data-user="${message.senderId}"]`);
        if (realtimeMessage) {
            realtimeMessage.remove();
        }
        
        // ユーザー情報を取得
        database.ref(`users/${message.senderId}`).once('value', (userSnapshot) => {
            const userData = userSnapshot.val();
            
            // メッセージ要素を作成
            const messageElement = document.createElement('div');
            messageElement.className = 'message-wrapper';
            messageElement.setAttribute('data-id', messageId);
            
            // 自分のメッセージかどうかでスタイルを変更
            if (message.senderId === currentUser.uid) {
                messageElement.classList.add('my-message');
            }
            
            messageElement.innerHTML = `
                <img src="${userData?.photoURL || 'avatar-placeholder.png'}" alt="${userData?.username || 'ユーザー'}" class="message-avatar">
                <div class="message-content">
                    <div class="message-info">
                        <span class="message-sender">${userData?.username || 'ユーザー'}</span>
                        <span class="message-time">${formatTime(message.timestamp)}</span>
                    </div>
                    <div class="message-bubble">${message.text}</div>
                </div>
            `;
            
            messagesContainer.appendChild(messageElement);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    });
}

// フレンド関連の機能
function loadFriends() {
    if (!currentUser) return;
    
    const friendsRef = database.ref(`friends/${currentUser.uid}`);
    
    friendsRef.on('value', (snapshot) => {
        const friends = snapshot.val() || {};
        const friendIds = Object.keys(friends);
        const friendsList = document.getElementById('friends-list');
        
        // フレンドリストをクリア
        friendsList.innerHTML = '';
        
        if (friendIds.length === 0) {
            friendsList.innerHTML = '<p class="text-center">フレンドはいません</p>';
            return;
        }
        
        // 各フレンドの情報を取得して表示
        friendIds.forEach((friendId) => {
            const userRef = database.ref(`users/${friendId}`);
            
            userRef.on('value', (userSnapshot) => {
                const userData = userSnapshot.val();
                
                if (userData) {
                    // フレンドアイテムを作成
                    const friendItem = document.createElement('div');
                    friendItem.className = 'list-item';
                    friendItem.innerHTML = `
                        <img src="${userData.photoURL || 'avatar-placeholder.png'}" alt="${userData.username}" class="list-item-avatar">
                        <div class="list-item-info">
                            <div class="list-item-name">${userData.username}</div>
                            <div class="list-item-status">
                                <span class="online-indicator ${userData.status === 'online' ? '' : 'offline-indicator'}"></span>
                                ${userData.status === 'online' ? 'オンライン' : 'オフライン'}
                            </div>
                        </div>
                        <div class="list-item-actions">
                            <button class="btn small-btn secondary-btn invite-chat-btn" data-id="${friendId}">招待</button>
                        </div>
                    `;
                    
                    // フレンドをクリックした時の処理
                    friendItem.querySelector('.list-item-info').addEventListener('click', () => {
                        showUserProfile(friendId);
                    });
                    
                    // チャットに招待するボタンの処理
                    friendItem.querySelector('.invite-chat-btn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        inviteToChat(friendId);
                    });
                    
                    friendsList.appendChild(friendItem);
                }
            });
        });
    });
}

function loadFriendRequests() {
    if (!currentUser) return;
    
    const requestsRef = database.ref(`friend_requests/${currentUser.uid}`);
    
    requestsRef.on('value', (snapshot) => {
        const requests = snapshot.val() || {};
        const requestIds = Object.keys(requests);
        const requestsList = document.getElementById('friend-requests');
        
        // リクエストリストをクリア
        requestsList.innerHTML = '';
        
        if (requestIds.length === 0) {
            requestsList.innerHTML = '<p class="text-center">新しいフレンド申請はありません</p>';
            return;
        }
        
        // 各リクエストの情報を取得して表示
        requestIds.forEach((userId) => {
            const userRef = database.ref(`users/${userId}`);
            
            userRef.once('value', (userSnapshot) => {
                const userData = userSnapshot.val();
                
                if (userData) {
                    // リクエストアイテムを作成
                    const requestItem = document.createElement('div');
                    requestItem.className = 'list-item';
                    requestItem.innerHTML = `
                        <img src="${userData.photoURL || 'avatar-placeholder.png'}" alt="${userData.username}" class="list-item-avatar">
                        <div class="list-item-info">
                            <div class="list-item-name">${userData.username}</div>
                            <div class="list-item-status">フレンド申請</div>
                        </div>
                        <div class="list-item-actions">
                            <button class="btn small-btn primary-btn accept-request-btn" data-id="${userId}">承認</button>
                            <button class="btn small-btn danger-btn decline-request-btn" data-id="${userId}">拒否</button>
                        </div>
                    `;
                    
                    // 承認ボタンの処理
                    requestItem.querySelector('.accept-request-btn').addEventListener('click', () => {
                        acceptFriendRequest(userId);
                    });
                    
                    // 拒否ボタンの処理
                    requestItem.querySelector('.decline-request-btn').addEventListener('click', () => {
                        declineFriendRequest(userId);
                    });
                    
                    requestsList.appendChild(requestItem);
                }
            });
        });
    });
}

function showUserProfile(userId) {
    if (userId === currentUser.uid) return;
    
    const userRef = database.ref(`users/${userId}`);
    
    userRef.once('value', (snapshot) => {
        const userData = snapshot.val();
        
        if (userData) {
            // ユーザープロフィールモーダルを表示
            document.getElementById('modal-user-avatar').src = userData.photoURL || 'avatar-placeholder.png';
            document.getElementById('modal-user-name').textContent = userData.username;
            
            // フレンド状態を確認
            const friendRef = database.ref(`friends/${currentUser.uid}/${userId}`);
            
            friendRef.once('value', (friendSnapshot) => {
                const isFriend = friendSnapshot.exists();
                
                // リクエスト送信済みかを確認
                const requestRef = database.ref(`friend_requests/${userId}/${currentUser.uid}`);
                
                requestRef.once('value', (requestSnapshot) => {
                    const isRequested = requestSnapshot.exists();
                    
                    // フレンド申請ボタンの表示/非表示
                    const sendRequestBtn = document.getElementById('send-friend-request');
                    const inviteToChatBtn = document.getElementById('invite-to-chat');
                    const removeFriendBtn = document.getElementById('remove-friend');
                    
                    if (isFriend) {
                        // フレンドの場合
                        sendRequestBtn.classList.add('hidden');
                        inviteToChatBtn.classList.remove('hidden');
                        removeFriendBtn.classList.remove('hidden');
                        
                        // チャットに招待するボタンの処理
                        inviteToChatBtn.onclick = () => {
                            hideModal('userProfile');
                            inviteToChat(userId);
                        };
                        
                        // フレンド解除ボタンの処理
                        removeFriendBtn.onclick = () => {
                            removeFriend(userId);
                            hideModal('userProfile');
                        };
                    } else {
                        // フレンドではない場合
                        sendRequestBtn.classList.remove('hidden');
                        inviteToChatBtn.classList.add('hidden');
                        removeFriendBtn.classList.add('hidden');
                        
                        if (isRequested) {
                            // リクエスト送信済み
                            sendRequestBtn.textContent = '申請済み';
                            sendRequestBtn.disabled = true;
                        } else {
                            // リクエスト未送信
                            sendRequestBtn.textContent = 'フレンド申請';
                            sendRequestBtn.disabled = false;
                            
                            // フレンド申請ボタンの処理
                            sendRequestBtn.onclick = () => {
                                sendFriendRequest(userId);
                                hideModal('userProfile');
                            };
                        }
                    }
                    
                    // モーダルを表示
                    showModal('userProfile');
                });
            });
        }
    });
}

function sendFriendRequest(userId) {
    if (!currentUser) return;
    
    // フレンド申請を送信
    const requestRef = database.ref(`friend_requests/${userId}/${currentUser.uid}`);
    
    requestRef.set({
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        alert('フレンド申請を送信しました');
    }).catch((error) => {
        console.error('フレンド申請エラー:', error);
    });
}

function acceptFriendRequest(userId) {
    if (!currentUser) return;
    
    // 相互フレンド関係を作成
    const myFriendRef = database.ref(`friends/${currentUser.uid}/${userId}`);
    const theirFriendRef = database.ref(`friends/${userId}/${currentUser.uid}`);
    
    // トランザクションで一括処理
    const updates = {};
    updates[`friends/${currentUser.uid}/${userId}`] = true;
    updates[`friends/${userId}/${currentUser.uid}`] = true;
    updates[`friend_requests/${currentUser.uid}/${userId}`] = null;  // リクエストを削除
    
    database.ref().update(updates).then(() => {
        alert('フレンド申請を承認しました');
    }).catch((error) => {
        console.error('フレンド承認エラー:', error);
    });
}

function declineFriendRequest(userId) {
    if (!currentUser) return;
    
    // フレンド申請を削除
    const requestRef = database.ref(`friend_requests/${currentUser.uid}/${userId}`);
    
    requestRef.remove().then(() => {
        alert('フレンド申請を拒否しました');
    }).catch((error) => {
        console.error('フレンド拒否エラー:', error);
    });
}

function removeFriend(userId) {
    if (!currentUser) return;
    
    // 相互フレンド関係を削除
    const updates = {};
    updates[`friends/${currentUser.uid}/${userId}`] = null;
    updates[`friends/${userId}/${currentUser.uid}`] = null;
    
    database.ref().update(updates).then(() => {
        alert('フレンドを解除しました');
    }).catch((error) => {
        console.error('フレンド解除エラー:', error);
    });
}

function inviteToChat(userId) {
    if (!currentUser) return;
    
    // ユーザーが参加しているルームを取得
    const userRoomsRef = database.ref(`user_rooms/${currentUser.uid}`);
    
    userRoomsRef.once('value', (snapshot) => {
        const userRooms = snapshot.val() || {};
        const roomIds = Object.keys(userRooms);
        
        if (roomIds.length === 0) {
            alert('招待できるルームがありません。まずはルームを作成してください。');
            return;
        }
        
        // ルーム一覧のモーダルを表示（UI拡張が必要）
        // ここでは簡単のために最初のルームに招待
        const roomId = roomIds[0];
        
        // ルーム情報を取得
        database.ref(`rooms/${roomId}`).once('value', (roomSnapshot) => {
            const roomData = roomSnapshot.val();
            
            if (roomData) {
                // 招待メッセージを送信（通知機能が必要）
                alert(`「${roomData.name}」に招待しました。招待コード: ${roomData.code}`);
            }
        });
    });
}

// イベントリスナーの設定
function setupEventListeners() {
// ログイン画面
    document.getElementById('google-login').addEventListener('click', signInWithGoogle);
    document.getElementById('email-login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        signInWithEmail(email, password);
    });

    // 画面切替リンク
    document.getElementById('show-signup').addEventListener('click', () => {
        showScreen('signup');
    });
    document.getElementById('show-login').addEventListener('click', () => {
        showScreen('login');
    });

    // 新規登録画面
    document.getElementById('signup-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('signup-username').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const profileImage = document.getElementById('profile-image').files[0];
        createAccount(username, email, password, profileImage);
    });

    // プロフィール画像プレビュー
    document.getElementById('profile-image').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('image-preview').innerHTML = `<img src="${e.target.result}" alt="プレビュー">`;
            };
            reader.readAsDataURL(file);
        }
    });

    // ホーム画面タブ切替
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            
            // アクティブタブの切替
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // タブコンテンツの切替
            document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
            document.getElementById(`${tabId}-tab`).classList.remove('hidden');
        });
    });

    // ルーム作成ボタン
    document.getElementById('create-room-btn').addEventListener('click', () => {
        showModal('createRoom');
    });

    // ルーム参加ボタン
    document.getElementById('join-room-btn').addEventListener('click', () => {
        showModal('joinRoom');
    });

    // モーダルを閉じるボタン
    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', () => {
            hideAllModals();
        });
    });

    // ルーム作成フォーム
    document.getElementById('create-room-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const roomName = document.getElementById('room-name').value;
        createRoom(roomName);
        hideAllModals();
    });

    // ルーム参加フォーム
    document.getElementById('join-room-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const roomCode = document.getElementById('room-code').value;
        joinRoomByCode(roomCode);
        hideAllModals();
    });

    // プロフィール更新フォーム
    document.getElementById('profile-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('update-username').value;
        const profileImage = document.getElementById('update-profile-image').files[0];
        updateProfile(username, profileImage);
    });

    // プロフィール画像更新プレビュー
    document.getElementById('update-profile-image').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('current-avatar').src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // ログアウトボタン
    document.getElementById('logout-btn').addEventListener('click', signOut);

    // チャット画面の戻るボタン
    document.getElementById('back-to-home').addEventListener('click', () => {
        showScreen('home');
        currentRoomId = null;
    });

    // 招待コードをコピーするボタン
    document.getElementById('copy-invite-code').addEventListener('click', () => {
        const roomCode = document.getElementById('room-code-display').textContent;
        navigator.clipboard.writeText(roomCode).then(() => {
            alert('招待コードをコピーしました');
        }).catch((error) => {
            console.error('コピーエラー:', error);
        });
    });
}

// ユーティリティ関数
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(`${screenId}-screen`).classList.remove('hidden');
}

function showModal(modalId) {
    const modal = document.getElementById(`${modalId}-modal`);
    
    // 要素が存在しない場合はエラーメッセージを出力
    if (!modal) {
        console.error(`モーダルが見つかりません: ${modalId}-modal`);
        return;
    }

    modal.classList.remove('hidden');
}

function hideModal(modalId) {
    const modal = document.getElementById(`${modalId}-modal`);
    
    if (!modal) {
        console.error(`モーダルが見つかりません: ${modalId}-modal`);
        return;
    }

    modal.classList.add('hidden');
}

function hideAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('hidden');
    });
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${hours}:${minutes}`;
}

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    
    for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        code += chars[randomIndex];
    }
    
    return code;
}

function setUserOnlineStatus(status) {
    if (!currentUser) return;
    
    const userRef = database.ref(`users/${currentUser.uid}`);
    userRef.update({
        status: status
    });
    
    // オフライン時に自動で接続が切れたことを検知する
    if (status === 'online') {
        const connectedRef = database.ref('.info/connected');
        connectedRef.on('value', (snap) => {
            if (snap.val() === true) {
                userRef.onDisconnect().update({
                    status: 'offline'
                });
            }
        });
    }
}



// 認証状態の監視
auth.onAuthStateChanged((user) => {
    if (user) {
        // ログイン成功
        currentUser = user;
        
        // ユーザー情報の取得
        database.ref(`users/${user.uid}`).once('value', (snapshot) => {
            const userData = snapshot.val() || {};
            
            // ユーザー情報を表示
            document.getElementById('user-name').textContent = userData.username || user.displayName || 'ユーザー';
            document.getElementById('user-avatar').src = userData.photoURL || user.photoURL || 'avatar-placeholder.png';
            document.getElementById('current-avatar').src = userData.photoURL || user.photoURL || 'avatar-placeholder.png';
            document.getElementById('update-username').value = userData.username || user.displayName || '';
            
            // オンライン状態に設定
            setUserOnlineStatus('online');
            
            // ホーム画面に遷移
            showScreen('home');
            
            // データの読み込み
            loadRooms();
            loadFriends();
            loadFriendRequests();
        });
    } else {
        // ログアウト状態
        currentUser = null;
        currentRoomId = null;
        
        // ログイン画面に遷移
        showScreen('login');
    }
});

// リアルタイムテキスト機能のセットアップ
setupRealtimeText();

// イベントリスナーのセットアップ
setupEventListeners();