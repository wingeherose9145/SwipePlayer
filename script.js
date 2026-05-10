const container = document.getElementById('videoContainer');
const addBtn = document.getElementById('add-btn');
const emptyState = document.getElementById('empty-state');
let db;

// 初始化数据库
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
            emptyState.style.display = 'none';
            addBtn.classList.add('hidden');
            paths.forEach(path => renderVideo(path));
        }
    };
}

function renderVideo(nativePath) {
    if (!nativePath) return;
    const videoUrl = window.Capacitor ? window.Capacitor.convertFileSrc(nativePath) : nativePath;
    
    const card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML = `<video src="${videoUrl}" loop playsinline webkit-playsinline preload="auto"></video>`;
    container.appendChild(card);
    
    const v = card.querySelector('video');
    v.load(); 
    observer.observe(card);
}

// 替换 pickVideos 函数
async function pickVideos() {
    try {
        const { FilePicker } = window.Capacitor.Plugins;

        // 1. 对于 Android 13+，除了所有文件权限，有时还需要明确的媒体权限
        if (FilePicker.requestPermissions) {
            await FilePicker.requestPermissions();
        }

        // 2. 关键：不要加过多的限制，让原生插件以最轻量方式运行
        const result = await FilePicker.pickFiles({
            types: ['video/*'],
            multiple: true,
            readData: false // 必须为 false，否则会因为尝试读取大数据导致内存溢出报错
        });

        if (result.files && result.files.length > 0) {
            const tx = db.transaction(["paths"], "readwrite");
            const store = tx.objectStore("paths");

            for (const file of result.files) {
                // 如果 file.path 依然拿不到，尝试使用 file.identifier (针对某些机型)
                const finalPath = file.path || file.identifier; 
                if (finalPath) {
                    store.add(finalPath);
                    renderVideo(finalPath);
                }
            }
            addBtn.classList.add('hidden');
            if (emptyState) emptyState.style.display = 'none';
        }
    } catch (err) {
        console.error("Pick error details:", err);
        alert("选择失败，请确认：\n1. 已开启‘所有文件访问权限’\n2. 从‘内部存储’文件夹选择视频，而非‘最近’列表。");
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
