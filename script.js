/**
 * SwipePlayer 路径兼容加强版
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
request.onsuccess = (e) => { 
    db = e.target.result; 
    loadSavedPaths(); 
};

// 2. 加载已保存的路径
function loadSavedPaths() {
    const tx = db.transaction(["paths"], "readonly");
    const store = tx.objectStore("paths");
    store.getAll().onsuccess = (e) => {
        const paths = e.target.result;
        if (paths && paths.length > 0) {
            if (emptyState) emptyState.style.display = 'none';
            addBtn.classList.add('hidden');
            // 倒序排列，让新添加的在上面
            paths.reverse().forEach(path => renderVideo(path));
        }
    };
}

// 3. 渲染视频
function renderVideo(nativePath) {
    if (!nativePath) return;

    const videoUrl = window.Capacitor ? window.Capacitor.convertFileSrc(nativePath) : nativePath;
    
    const card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML = `
        <video 
            src="${videoUrl}" 
            loop 
            playsinline 
            webkit-playsinline 
            preload="auto"
            onerror="videoLoadError(this, '${nativePath}')">
        </video>
    `;
    container.appendChild(card);
    
    const v = card.querySelector('video');
    v.load(); 
    observer.observe(card);
}

function videoLoadError(v, path) {
    console.error("加载失败路径:", path);
    const parent = v.parentElement;
    parent.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #ff4d4d; font-size: 14px;">
            <p>视频加载失败</p>
            <p style="font-size: 10px; color: #666; margin-top: 10px;">路径已失效或文件被移动</p>
            <button onclick="location.reload()" style="margin-top:10px; background:#333; color:white; border:none; padding:5px 10px; border-radius:4px;">重试</button>
        </div>
    `;
}

// 4. 选择视频（改进后的路径校验逻辑）
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
            let addedCount = 0;
            let showWarning = false;

            for (const file of result.files) {
                const path = file.path;
                
                if (path) {
                    // 【逻辑优化】：
                    // 不再强制要求以 /storage 开头
                    // 只要路径不包含 'content://' 且不包含 'com.android.providers' 这种虚拟标识，就视为有效物理路径
                    const isVirtual = path.includes('content://') || path.includes('com.android.providers');
                    
                    if (!isVirtual) {
                        store.add(path);
                        renderVideo(path);
                        addedCount++;
                    } else {
                        showWarning = true;
                    }
                }
            }

            if (showWarning && addedCount === 0) {
                alert("⚠ 依然检测到虚拟路径！\n\n请务必点击左上角【三横线】菜单，找到【手机型号名称】并点击进入，然后再选择具体的文件夹（如 Movies）。");
            }

            if (addedCount > 0) {
                addBtn.classList.add('hidden');
                if (emptyState) emptyState.style.display = 'none';
            }
        }
    } catch (err) { 
        alert("操作异常: " + (err.message || "权限不足")); 
    }
}

// 5. 交互逻辑
addBtn.onclick = (e) => { e.stopPropagation(); pickVideos(); };

container.onclick = () => {
    addBtn.classList.toggle('hidden');
    const cards = document.querySelectorAll('.video-card');
    const centerY = window.innerHeight / 2;
    cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        if (rect.top <= centerY && rect.bottom >= centerY) {
            const v = card.querySelector('video');
            if (v && v.play) v.paused ? v.play().catch(()=>{}) : v.pause();
        }
    });
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const v = entry.target.querySelector('video');
        if (v && v.play) {
            if (entry.isIntersecting) {
                v.play().catch(() => { v.muted = true; v.play().catch(()=>{}); });
            } else { 
                v.pause(); 
            }
        }
    });
}, { threshold: 0.6 });
