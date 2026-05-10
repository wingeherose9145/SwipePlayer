/**
 * SwipePlayer 终极持久化版 (解决重启黑屏问题)
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

// 3. 渲染视频（增加错误监测）
function renderVideo(nativePath) {
    if (!nativePath) return;

    // 将原生物理路径转换为 WebView 可用的 URL
    const videoUrl = window.Capacitor ? window.Capacitor.convertFileSrc(nativePath) : nativePath;
    
    const card = document.createElement('div');
    card.className = 'video-card';
    // 增加 onerror 处理，如果路径失效则显示提示
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

// 视频加载失败的处理
function videoLoadError(v, path) {
    console.error("加载失败路径:", path);
    const parent = v.parentElement;
    parent.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #ff4d4d; font-size: 14px;">
            <p>视频加载失败</p>
            <p style="font-size: 10px; color: #666; margin-top: 10px;">原因：路径授权已过期</p>
            <button onclick="location.reload()" style="margin-top:10px; background:#333; color:white; border:none; padding:5px 10px; border-radius:4px;">刷新列表</button>
        </div>
    `;
}

// 4. 选择视频（增加路径格式校验）
async function pickVideos() {
    try {
        const { FilePicker } = window.Capacitor.Plugins;
        
        // 请求基础权限
        if (FilePicker.requestPermissions) await FilePicker.requestPermissions();
        
        const result = await FilePicker.pickFiles({ 
            types: ['video/*'], 
            multiple: true, 
            readData: false 
        });
        
        if (result.files && result.files.length > 0) {
            const tx = db.transaction(["paths"], "readwrite");
            const store = tx.objectStore("paths");
            let permanentCount = 0;
            let temporaryCount = 0;

            for (const file of result.files) {
                const path = file.path;
                
                if (path) {
                    // 判断是否为永久路径 (以 /storage 开头)
                    if (path.startsWith('/storage')) {
                        store.add(path);
                        renderVideo(path);
                        permanentCount++;
                    } else {
                        // 如果是 content:// 开头的路径
                        temporaryCount++;
                    }
                }
            }

            if (temporaryCount > 0 && permanentCount === 0) {
                alert("⚠ 选择无效：你刚才从【最近】或【缓存】中选择了视频，这些路径在重启 App 后会失效。\n\n请点击左上角菜单，进入【内部存储】文件夹（如 Movies 或 DCIM）重新选择。");
            }

            if (permanentCount > 0) {
                addBtn.classList.add('hidden');
                if (emptyState) emptyState.style.display = 'none';
            }
        }
    } catch (err) { 
        alert("操作异常: " + (err.message || "请检查权限")); 
    }
}

// 5. 交互与播放逻辑
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
