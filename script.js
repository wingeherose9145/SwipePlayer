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
    const videoUrl = window.Capacitor.convertFileSrc(nativePath);
    const card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML = `<video src="${videoUrl}" loop playsinline webkit-playsinline preload="auto"></video>`;
    container.appendChild(card);
    const v = card.querySelector('video');
    v.load(); 
    observer.observe(card);
}

// 2. 核心视频选择函数
async function pickVideos() {
    try {
        const { FilePicker } = window.Capacitor.Plugins;
        
        // Android 13+ 必须通过这一步触发系统的媒体权限弹窗
        if (FilePicker.requestPermissions) {
            const permStatus = await FilePicker.requestPermissions();
            console.log("权限状态:", permStatus);
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
                // 优先使用物理路径 path
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
                alert("路径获取失败。请确保点击侧边栏菜单进入【内部存储】空间选择。");
            }
        }
    } catch (err) { 
        // 将具体的错误信息弹出来
        alert("操作失败详情: " + (err.message || JSON.stringify(err))); 
    }
}

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
