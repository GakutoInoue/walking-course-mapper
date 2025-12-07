let map;
let drawingManager;
let currentPolyline; // 現在描画中または編集中のポリライン
let savedCourses = []; // 登録されたコースを保持する配列
let displayedCoursePolyline = null; // 現在表示されている保存済みコースのポリラインを保持
let totalDistance = 0; // 計算された距離を格納するグローバル変数
const WALKING_SPEED_KM_PER_HOUR = 5; // 平均的なウォーキング速度（km/h）

// DOM要素への参照
const startDrawingBtn = document.getElementById('startDrawing');
const stopDrawingBtn = document.getElementById('stopDrawing');
const clearDrawingBtn = document.getElementById('clearDrawing');
const saveCourseBtn = document.getElementById('saveCourse');
const courseInfoDiv = document.getElementById('courseInfo');
const courseDistanceSpan = document.getElementById('courseDistance');
const courseWalkingTimeSpan = document.getElementById('courseWalkingTime');
const courseNameInput = document.getElementById('courseName');
const courseDescriptionInput = document.getElementById('courseDescription');
const confirmSaveBtn = document.getElementById('confirmSave');
const courseListUl = document.getElementById('courseList');

// --- 既存のコース名検索用のDOM要素 ---
const courseSearchInput = document.getElementById('courseSearchInput');
const courseSearchBtn = document.getElementById('courseSearchBtn');
const courseClearSearchBtn = document.getElementById('courseClearSearchBtn');
const startCourseVoiceSearchBtn = document.getElementById('startCourseVoiceSearchBtn'); // コース名検索用の音声検索ボタン

// --- 地図上の場所検索機能用のDOM要素 (新規) ---
const placeSearchInput = document.getElementById('placeSearchInput');
const placeSearchBtn = document.getElementById('placeSearchBtn');
const placeClearSearchBtn = document.getElementById('placeClearSearchBtn');
const startPlaceVoiceSearchBtn = document.getElementById('startPlaceVoiceSearchBtn'); // 地名検索用の音声検索ボタン
let geocoder; // Geocoderオブジェクトを格納する変数

// --- 音声認識機能 (新規) ---
let courseRecognition; // コース名検索用
let placeRecognition;  // 地名検索用
let isCourseRecognizing = false;
let isPlaceRecognizing = false;

// ウォーキング時間を計算し、フォーマットするヘルパー関数
function formatWalkingTime(distanceKm) {
    const walkingTimeMinutes = Math.round((distanceKm / WALKING_SPEED_KM_PER_HOUR) * 60);
    if (walkingTimeMinutes < 60) {
        return `${walkingTimeMinutes}分`;
    } else {
        const hours = Math.floor(walkingTimeMinutes / 60);
        const minutes = walkingTimeMinutes % 60;
        return `${hours}時間 ${minutes}分`;
    }
}

// Google Maps APIのコールバック関数
function initMap() {
    // 初期位置を日本の中心（東京タワー付近）に設定
    const initialLocation = { lat: 35.658581, lng: 139.745433 };

    map = new google.maps.Map(document.getElementById('map'), {
        center: initialLocation,
        zoom: 15,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    });

    // Geocoderを初期化
    geocoder = new google.maps.Geocoder();

    // DrawingManagerを初期化
    drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: null, // 最初は描画モードを無効にする
        drawingControl: false, // 描画コントロールを表示しない
        polylineOptions: {
            strokeColor: '#FF0000',
            strokeOpacity: 0.8,
            strokeWeight: 4,
            editable: true // 描画後に編集可能にする
        }
    });
    drawingManager.setMap(map);

    // ポリラインが描画されたときのイベントリスナー
    google.maps.event.addListener(drawingManager, 'overlaycomplete', function(event) {
        if (event.type === google.maps.drawing.OverlayType.POLYLINE) {
            // 以前に表示されていた保存済みコースのポリラインがあればクリアする
            if (displayedCoursePolyline) {
                displayedCoursePolyline.setMap(null);
                displayedCoursePolyline = null;
            }

            if (currentPolyline) {
                currentPolyline.setMap(null); // 既存のポリラインがあれば削除
            }
            currentPolyline = event.overlay;
            updateCourseDistance();

            // ポリラインのポイントが変更（編集）されたときのイベントリスナー
            google.maps.event.addListener(currentPolyline.getPath(), 'set_at', updateCourseDistance);
            google.maps.event.addListener(currentPolyline.getPath(), 'insert_at', updateCourseDistance);
            google.maps.event.addListener(currentPolyline.getPath(), 'remove_at', updateCourseDistance);

            // 描画モードを終了
            drawingManager.setDrawingMode(null);
            // ポリラインが描画されたので、スタート、クリア、保存ボタンを有効にする
            updateControlButtons(true, false, true, true);
        }
    });

    // 初期状態: 描画も保存もされていないので、スタートボタンのみ有効
    // コースクリアボタンは描画終了まで押せないようにするため、最初は無効にする
    updateControlButtons(true, false, false, false);
    loadCoursesFromLocalStorage(); // ページ読み込み時に保存されたコースを読み込む

    // --- 既存のコース名検索イベントリスナー ---
    courseSearchBtn.addEventListener('click', filterCourses);
    courseClearSearchBtn.addEventListener('click', () => {
        courseSearchInput.value = ''; // 検索フィールドをクリア
        filterCourses(); // 全てのコースを再表示
    });
    courseSearchInput.addEventListener('keyup', (event) => {
        // エンターキーが押されたら検索を実行
        if (event.key === 'Enter') {
            filterCourses();
        }
    });

    // --- 地図上の場所検索イベントリスナー (新規) ---
    placeSearchBtn.addEventListener('click', searchPlace);
    placeClearSearchBtn.addEventListener('click', () => {
        placeSearchInput.value = ''; // 検索フィールドをクリア
        // マップを初期位置に戻す（オプション）
        map.setCenter(initialLocation);
        map.setZoom(15);
    });
    placeSearchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            searchPlace();
        }
    });

    // --- 音声認識機能の初期化とイベントリスナー (新規) ---
    if ('webkitSpeechRecognition' in window) {
        // コース名検索用
        courseRecognition = new webkitSpeechRecognition();
        courseRecognition.continuous = false;
        courseRecognition.interimResults = false;
        courseRecognition.lang = 'ja-JP';

        courseRecognition.onstart = () => {
            isCourseRecognizing = true;
            startCourseVoiceSearchBtn.textContent = '音声入力中...';
            startCourseVoiceSearchBtn.style.backgroundColor = 'orange';
        };
        courseRecognition.onresult = (event) => {
            let transcript = event.results[0][0].transcript;
            // 句読点（特に「。」）を削除し、前後の空白をトリムする
            transcript = transcript.replace(/。/g, '').trim(); 
            courseSearchInput.value = transcript;
            filterCourses();
            isCourseRecognizing = false;
            startCourseVoiceSearchBtn.textContent = '音声検索';
            startCourseVoiceSearchBtn.style.backgroundColor = '';
        };
        courseRecognition.onerror = (event) => {
            console.error('Course speech recognition error', event);
            isCourseRecognizing = false;
            startCourseVoiceSearchBtn.textContent = '音声検索';
            startCourseVoiceSearchBtn.style.backgroundColor = '';
            alert('コース名音声認識エラーが発生しました: ' + event.error);
        };
        courseRecognition.onend = () => {
            isCourseRecognizing = false;
            startCourseVoiceSearchBtn.textContent = '音声検索';
            startCourseVoiceSearchBtn.style.backgroundColor = '';
        };

        // 地名検索用
        placeRecognition = new webkitSpeechRecognition();
        placeRecognition.continuous = false;
        placeRecognition.interimResults = false;
        placeRecognition.lang = 'ja-JP';

        placeRecognition.onstart = () => {
            isPlaceRecognizing = true;
            startPlaceVoiceSearchBtn.textContent = '音声入力中...';
            startPlaceVoiceSearchBtn.style.backgroundColor = 'orange';
        };
        placeRecognition.onresult = (event) => {
            let transcript = event.results[0][0].transcript;
            // 句読点（特に「。」）を削除し、前後の空白をトリムする
            transcript = transcript.replace(/。/g, '').trim();
            placeSearchInput.value = transcript;
            searchPlace(); // 音声入力されたテキストで地名検索を実行
            isPlaceRecognizing = false;
            startPlaceVoiceSearchBtn.textContent = '音声検索';
            startPlaceVoiceSearchBtn.style.backgroundColor = '';
        };
        placeRecognition.onerror = (event) => {
            console.error('Place speech recognition error', event);
            isPlaceRecognizing = false;
            startPlaceVoiceSearchBtn.textContent = '音声検索';
            startPlaceVoiceSearchBtn.style.backgroundColor = '';
            alert('地名音声認識エラーが発生しました: ' + event.error);
        };
        placeRecognition.onend = () => {
            isPlaceRecognizing = false;
            startPlaceVoiceSearchBtn.textContent = '音声検索';
            startPlaceVoiceSearchBtn.style.backgroundColor = '';
        };

    } else {
        // 音声認識がサポートされていない場合の処理
        console.warn('Web Speech API is not supported in this browser.');
        if (startCourseVoiceSearchBtn) {
            startCourseVoiceSearchBtn.disabled = true;
            startCourseVoiceSearchBtn.textContent = '音声非対応';
            startCourseVoiceSearchBtn.style.backgroundColor = 'grey';
        }
        if (startPlaceVoiceSearchBtn) {
            startPlaceVoiceSearchBtn.disabled = true;
            startPlaceVoiceSearchBtn.textContent = '音声非対応';
            startPlaceVoiceSearchBtn.style.backgroundColor = 'grey';
        }
    }

    // コース名音声検索ボタンのイベントリスナー
    if (startCourseVoiceSearchBtn) {
        startCourseVoiceSearchBtn.addEventListener('click', () => {
            if (courseRecognition) {
                if (isCourseRecognizing) {
                    courseRecognition.stop();
                } else {
                    // 他の認識がアクティブな場合は停止
                    if (isPlaceRecognizing) placeRecognition.stop();
                    courseRecognition.start();
                }
            } else {
                alert('お使いのブラウザは音声認識をサポートしていません。Google Chromeなどの最新ブラウザをお試しください。');
            }
        });
    }

    // 地名音声検索ボタンのイベントリスナー
    if (startPlaceVoiceSearchBtn) {
        startPlaceVoiceSearchBtn.addEventListener('click', () => {
            if (placeRecognition) {
                if (isPlaceRecognizing) {
                    placeRecognition.stop();
                } else {
                    // 他の認識がアクティブな場合は停止
                    if (isCourseRecognizing) courseRecognition.stop();
                    placeRecognition.start();
                }
            } else {
                alert('お使いのブラウザは音声認識をサポートしていません。Google Chromeなどの最新ブラウザをお試しください。');
            }
        });
    }
}

// 距離を計算し、表示を更新する関数
function updateCourseDistance() {
    if (currentPolyline && google.maps.geometry) {
        const path = currentPolyline.getPath();
        totalDistance = google.maps.geometry.spherical.computeLength(path) / 1000; // メートルをキロメートルに変換
        courseDistanceSpan.textContent = totalDistance.toFixed(2);

        // 新しいヘルパー関数を使用してウォーキング時間を計算
        courseWalkingTimeSpan.textContent = formatWalkingTime(totalDistance);
    } else {
        totalDistance = 0;
        courseDistanceSpan.textContent = '0.00';
        courseWalkingTimeSpan.textContent = '0分';
    }
}

// ボタンの有効/無効を切り替える関数
function updateControlButtons(startEnabled, stopEnabled, clearEnabled, saveEnabled) {
    startDrawingBtn.disabled = !startEnabled;
    stopDrawingBtn.disabled = !stopEnabled;
    clearDrawingBtn.disabled = !clearEnabled;
    saveCourseBtn.disabled = !saveEnabled;
}

// 描画開始ボタンのクリックイベント
startDrawingBtn.addEventListener('click', () => {
    clearMapAndDrawingState(); // 既存の描画や表示中の保存済みコースをクリア
    drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYLINE);
    // 描画開始中は、停止ボタンのみ有効にする。クリアと保存は無効のまま。
    updateControlButtons(false, true, false, false);
    courseInfoDiv.classList.add('hidden'); // コース情報入力エリアを非表示にする
});

stopDrawingBtn.addEventListener('click', () => {
    drawingManager.setDrawingMode(null);
    if (currentPolyline) {
        updateControlButtons(false, false, true, true);
        callGeminiAdvice(totalDistance.toFixed(2));
    } else {
        updateControlButtons(true, false, false, false);
    }
});

// 描画クリアボタンのクリックイベント
clearDrawingBtn.addEventListener('click', () => {
    clearMapAndDrawingState();
    drawingManager.setDrawingMode(null); // 描画モードを終了
    // クリア後なので、スタートボタンのみ有効
    updateControlButtons(true, false, false, false);
    courseInfoDiv.classList.add('hidden'); // コース情報入力エリアを非表示にする
    courseNameInput.value = '';
    courseDescriptionInput.value = '';
});

// コース保存ボタンのクリックイベント
saveCourseBtn.addEventListener('click', () => {
    if (currentPolyline && currentPolyline.getPath().getLength() > 1) {
        courseInfoDiv.classList.remove('hidden'); // コース情報入力エリアを表示
        courseNameInput.focus();
    } else {
        alert('コースが描画されていません。');
    }
});

// 保存確定ボタンのクリックイベント
confirmSaveBtn.addEventListener('click', () => {
    const name = courseNameInput.value.trim();
    const description = courseDescriptionInput.value.trim();

    if (!name) {
        alert('コース名を入力してください。');
        return;
    }

    // 保存前にウォーキング時間を再計算し、最新の状態であることを確認
    const formattedWalkingTime = formatWalkingTime(totalDistance); // ヘルパー関数を使用

    const newCourse = {
        id: Date.now(), // タイムスタンプをユニークIDとして使用
        name: name,
        description: description,
        distance: totalDistance.toFixed(2),
        walkingTime: formattedWalkingTime,
        path: currentPolyline.getPath().getArray().map(point => ({ lat: point.lat(), lng: point.lng() })) // LatLngオブジェクトをプレーンなオブジェクトに変換
    };

    savedCourses.push(newCourse);
    saveCoursesToLocalStorage(); // LocalStorageに保存
    renderSavedCourses(); // UIを更新
    clearMapAndDrawingState(); // 現在の描画をクリア

    // UIを初期状態にリセット
    courseInfoDiv.classList.add('hidden');
    courseNameInput.value = '';
    courseDescriptionInput.value = '';
    // 保存後なので、スタートボタンのみ有効
    updateControlButtons(true, false, false, false);
});

// 現在の描画と表示中の保存済みコースをクリアするヘルパー関数
function clearMapAndDrawingState() {
    if (currentPolyline) {
        currentPolyline.setMap(null);
        currentPolyline = null;
    }
    if (displayedCoursePolyline) {
        displayedCoursePolyline.setMap(null);
        displayedCoursePolyline = null;
    }
    updateCourseDistance(); // 距離表示とウォーキング時間をリセット
}

// コースをLocalStorageに保存する関数
function saveCoursesToLocalStorage() {
    localStorage.setItem('savedCourses', JSON.stringify(savedCourses));
}

// コースをLocalStorageから読み込む関数
function loadCoursesFromLocalStorage() {
    const storedCourses = localStorage.getItem('savedCourses');
    if (storedCourses) {
        savedCourses = JSON.parse(storedCourses);
        // 以前に保存されたコースにwalkingTimeプロパティがなく、フォーマットが正しいことを確認
        savedCourses.forEach(course => {
            // `formatWalkingTime` を使用して、既存データのフォーマットを統一
            course.walkingTime = formatWalkingTime(parseFloat(course.distance));
        });
        renderSavedCourses(); // フィルターなしで初期表示
    }
}

// --- コースをフィルタリングして表示する関数 (既存) ---
function filterCourses() {
    const searchTerm = courseSearchInput.value.toLowerCase().trim();
    let filteredCourses = savedCourses;

    if (searchTerm) {
        filteredCourses = savedCourses.filter(course =>
            course.name.toLowerCase().includes(searchTerm)
        );
    }
    renderSavedCourses(filteredCourses); // フィルタリングされたリストを渡して表示を更新
}

// --- 地図上の場所検索機能のロジック (新規) ---
function searchPlace() {
    const address = placeSearchInput.value.trim();
    if (!address) {
        alert('場所を入力してください。');
        return;
    }

    // Geocoderサービスを使って場所を検索
    geocoder.geocode({ 'address': address, 'region': 'JP' }, function(results, status) {
        if (status === 'OK') {
            if (results[0]) {
                map.setCenter(results[0].geometry.location); // 検索結果の場所に地図の中心を移動
                map.setZoom(16); // 適切なズームレベルに調整
                clearMapAndDrawingState(); // 描画中のコースなどをクリア
            } else {
                alert('指定された場所が見つかりませんでした。');
            }
        } else {
            alert('ジオコーディングに失敗しました: ' + status);
        }
    });
}

// UIに保存されたコースを表示する関数 (引数 filteredList を追加)
function renderSavedCourses(listToRender = savedCourses) {
    courseListUl.innerHTML = ''; // リストをクリア

    if (listToRender.length === 0) {
        courseListUl.innerHTML = '<li style="text-align: center; color: #777;">該当するコースはありません。</li>';
        return;
    }

    listToRender.forEach(course => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${course.name}</strong><br>
                <span>距離: ${course.distance} km</span>
                <span>　徒歩: ${course.walkingTime}</span>
                ${course.description ? `<br><span>${course.description}</span>` : ''}
            </div>
            <div class="actions">
                <button class="view-course-btn" data-id="${course.id}">表示</button>
                <button class="delete-course-btn" data-id="${course.id}">削除</button>
            </div>
        `;
        courseListUl.appendChild(li);
    });

    // イベントリスナーを再アタッチ
    document.querySelectorAll('.view-course-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const courseId = parseInt(event.target.dataset.id);
            viewCourseOnMap(courseId);
        });
    });

    document.querySelectorAll('.delete-course-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const courseId = parseInt(event.target.dataset.id);
            deleteCourse(courseId);
        });
    });
}

// 地図上にコースを表示する関数
function viewCourseOnMap(id) {
    clearMapAndDrawingState(); // 既存の描画や以前に表示されたコースをクリア
    drawingManager.setDrawingMode(null); // 描画モードを終了
    // 保存済みのコースを表示中は、描画中のコースは存在しないため、クリア・保存ボタンは無効にする
    updateControlButtons(true, false, false, false); // ボタンを初期状態にリセット
    courseInfoDiv.classList.add('hidden'); // コース情報入力エリアを非表示にする

    const courseToView = savedCourses.find(course => course.id === id);
    if (courseToView) {
        displayedCoursePolyline = new google.maps.Polyline({
            path: courseToView.path,
            geodesic: true,
            strokeColor: '#007bff', // 表示されたコースの色を変更
            strokeOpacity: 0.8,
            strokeWeight: 5,
            map: map
        });

        // コース全体が表示されるように地図の中心とズームを調整
        const bounds = new google.maps.LatLngBounds();
        courseToView.path.forEach(point => {
            bounds.extend(new google.maps.LatLng(point.lat, point.lng));
        });
        map.fitBounds(bounds);
    }
}

// コースを削除する関数
function deleteCourse(id) {
    if (confirm('このコースを削除してもよろしいですか？')) {
        savedCourses = savedCourses.filter(course => course.id !== id);
        saveCoursesToLocalStorage();
        filterCourses(); // 削除後も現在の検索条件でリストを更新
        // 削除されたコースが現在表示されている場合、地図から削除する
        if (displayedCoursePolyline && savedCourses.findIndex(c => c.id === id) === -1) {
            clearMapAndDrawingState(); // これにより、一致する場合はdisplayedCoursePolylineがクリアされる
        }
    }
}

// ページ読み込み時の初期化 (initMapはGoogle Maps APIスクリプトタグのコールバックによって呼び出される)
document.addEventListener('DOMContentLoaded', () => {
    // マップオブジェクトに依存しないその他のDOM関連の初期化
});

// Gemini APIを叩く関数
async function callGeminiAdvice(distanceKm) {
    const adviceArea = document.getElementById('aiAdviceArea');
    const responseText = document.getElementById('geminiResponse');
    
    // UIを表示してローディング状態にする
    adviceArea.style.display = 'block';
    responseText.textContent = "Geminiがコースを分析中... 🏃‍♂️💨";

    const prompt = `
    あなたはプロのランニング・ウォーキングコーチです。
    ユーザーが「${distanceKm}km」のコースを作成しました。
    以下のフォーマットで、短く元気が出るアドバイスをください。
    
    【消費カロリー目安】: XX kcal
    【一言アドバイス】: (天気や景色、健康効果に触れたポジティブなコメントを1文で)
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`;

    const requestBody = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json(); // エラーの中身を読む
            console.error("Gemini API Error Details:", errorData); // コンソールに赤字で出す
            throw new Error(`API Error: ${response.status} ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const aiMessage = data.candidates[0].content.parts[0].text;
        responseText.textContent = aiMessage;

    } catch (error) {
        console.error("Gemini Error:", error);
        // 画面にもエラー内容を表示する
        responseText.textContent = `エラーが発生しました: ${error.message}`;
    }
}