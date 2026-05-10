const container = document.getElementById('videoContainer');
const addBtn = document.getElementById('add-btn');
let db;

// 初始化持久化数据库
const request = indexedDB.open("ProVideoDB", 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    db.createObjectStore("videos", { keyPath: "id", autoIncrement: true });
};
request.onsuccess = (e) => { db = e.target.result; loadVideos(); };

async function pickVideos() {
    try {
        const { FilePicker } = window.Capacitor.Plugins;
        
        // 核心逻辑：使用原生选择器，它会自动处理 Android 权限申请
        const result = await FilePicker.pickFiles({
            types: ['video/*'],
            multiple: true,
            readData: false
        });

        if (result.files && result.files.length > 0) {
            const tx = db.transaction("videos", "readwrite");
            const store = tx.objectStore("videos");

            for (const file of result.files) {
                // file.path 是以 /storage/ 开头的绝对路径
                if (file.path) {
                    store.add({ path: file.path, name: file.name });
                    addVideoToUI(file.path);
                }
            }
            addBtn.classList.add('hidden');
        }
    } catch (e) {
        alert("请授予媒体访问权限以便播放视频");
    }
}

function addVideoToUI(nativePath) {
    // 关键：将 Android 路径转换为 WebView 可识别的虚拟 URL
    const webUrl = window.Capacitor.convertFileSrc(nativePath);
    
    const card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML = `<video src="${webUrl}" loop playsinline webkit-playsinline></video>`;
    container.appendChild(card);
    
    const v = card.querySelector('video');
    observer.observe(card);
}

// 自动播放与停止逻辑保持不变...
