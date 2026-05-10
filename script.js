/**
 * SwipePlayer 完整核心脚本 (Fix: ACCESS_MEDIA_LOCATION)
 */

const container = document.getElementById('videoContainer');
const addBtn = document.getElementById('add-btn');
const emptyState = document.getElementById('empty-state');
let db;

// 1. 初始化数据库
const request = indexedDB.open("SwipePlayerDB", 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("paths")) {
        db.createObjectStore("paths", { autoIncrement: true });
    }
};
request.onsuccess = (e) => { db = e.target.result; loadSavedPaths(); };

function loadSavedPaths() {
    const tx = db.transaction(["paths"], "readonly");
    const store = tx.objectStore("paths");
    store.getAll().onsuccess = (e) => {
        const paths = e.target.result;
        if (paths && paths.length > 0) {
            if (emptyState) emptyState.style.display = 'none';
            addBtn.classList.add('hidden');
            paths.forEach(path => renderVideo(path));
        }
    };
}

function renderVideo(nativePath) {
    if (!nativePath) return;
    // 转换路径以便在 Web 视图中播放
    const videoUrl = window.Capacitor ? window.Capacitor.convertFileSrc(nativePath) : nativePath;
    
    const card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML = `<video src="${videoUrl}" loop playsinline webkit-playsinline preload="auto"></video>`;
    container.appendChild(card);
    
    const v = card.querySelector('video');
    v.load(); 
    observer.observe(card);
}

// 2. 选择视频逻辑
async function pickVideos() {
    try {
        const { FilePicker } = window.Capacitor.Plugins;
        
        // 尝试请求权限 (包含最新的 Media Location 权限)
        if (FilePicker.requestPermissions) {
            await FilePicker.requestPermissions();
        }
        
        const result = await FilePicker.pickFiles({ 
            types: ['video/*'], 
            multiple: true, 
            readData: false 
        });
        
        if (result.files && result.files.length > 0) {
            const tx = db.transaction(["paths"], "readwrite");
            const store = tx.objectStore("paths");
            let successCount = 0;

            for (const file of result.files) {
                // 核心：必须拿到 file.path 才能持久化
                const finalPath = file.path;
                if (finalPath) {
                    store.add(finalPath);
                    renderVideo(finalPath);
                    successCount++;
                }
            }

            if (successCount > 0) {
                addBtn.classList.add('hidden');
                if (emptyState) emptyState.style.display = 'none';
            } else {
                alert("获取物理路径失败。请点击左上角菜单 -> 选择【内部存储】空间后再选视频。");
            }
        }
    } catch (err) { 
        // 这里会捕获并弹出具体的 Android 权限缺失信息
        alert("操作异常: " + (err.message || JSON.stringify(err))); 
    }
}

// 3. 交互控制
addBtn.onclick = (e) => { e.stopPropagation(); pickVideos(); };

container.onclick = () => {
    addBtn.classList.toggle('hidden');
    const cards = document.querySelectorAll('.video-card');
    const centerY = window.innerHeight / 2;
    cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        if (rect.top <= centerY && rect.bottom >= centerY) {
            const v = card.querySelector('video');
            if (v) v.paused ? v.play().catch(()=>{}) : v.pause();
        }
    });
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const v = entry.target.querySelector('video');
        if (v && entry.isIntersecting) {
            v.play().catch(() => { v.muted = true; v.play().catch(()=>{}); });
        } else if (v) { v.pause(); }
    });
}, { threshold: 0.6 });
