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

// 调用底层选择器获取真实物理路径
async function pickVideos() {
    try {
        const { FilePicker } = window.Capacitor.Plugins;
        if (FilePicker.requestPermissions) await FilePicker.requestPermissions();
        
        const result = await FilePicker.pickFiles({ 
            types: ['video/*'], 
            multiple: true, 
            readData: false 
        });
        
        if (result.files && result.files.length > 0) {
            const tx = db.transaction(["paths"], "readwrite");
            const store = tx.objectStore("paths");
            
            emptyState.style.display = 'none';
            for (const file of result.files) {
                if (file.path) {
                    store.add(file.path);
                    renderVideo(file.path);
                }
            }
            addBtn.classList.add('hidden');
        }
    } catch (err) { 
        alert("选择取消或失败，请确保系统已授予访问权限。"); 
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
