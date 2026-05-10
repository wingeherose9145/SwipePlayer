/**
 * SwipePlayer 核心逻辑控制脚本
 * 功能：视频选择、持久化存储、模拟 TikTok 滚动播放
 */

const container = document.getElementById('videoContainer');
const addBtn = document.getElementById('add-btn');
const emptyState = document.getElementById('empty-state');
let db;

// 1. 初始化 IndexedDB 数据库
const request = indexedDB.open("SwipePlayerDB", 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("paths")) {
        db.createObjectStore("paths", { autoIncrement: true });
    }
};

request.onsuccess = (e) => {
    db = e.target.result;
    loadSavedPaths(); // 数据库准备好后加载已保存的视频
};

request.onerror = (e) => {
    console.error("数据库打开失败", e);
};

// 2. 加载并渲染已保存的视频路径
function loadSavedPaths() {
    const tx = db.transaction(["paths"], "readonly");
    const store = tx.objectStore("paths");
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = (e) => {
        const paths = e.target.result;
        if (paths && paths.length > 0) {
            if (emptyState) emptyState.style.display = 'none';
            addBtn.classList.add('hidden');
            paths.forEach(path => renderVideo(path));
        }
    };
}

// 3. 渲染单个视频卡片
function renderVideo(nativePath) {
    if (!nativePath) return;

    // 核心：将原生物理路径转换为 WebView 能够识别的 https://localhost/_capacitor_file_/ 格式
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
            style="width:100%; height:100%; object-fit:contain;">
        </video>
    `;
    container.appendChild(card);
    
    const v = card.querySelector('video');
    v.load(); // 预加载视频
    observer.observe(card); // 开始监听滚动进入视图
}

// 4. 调用原生文件选择器
async function pickVideos() {
    try {
        const { FilePicker } = window.Capacitor.Plugins;
        
        // 权限请求（同步插件内部状态）
        if (FilePicker.requestPermissions) {
            await FilePicker.requestPermissions();
        }
        
        // 执行选择：不请求读取数据以保证性能，只拿路径
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
                // 重要：必须获取物理路径 (file.path) 才能实现持久化
                const finalPath = file.path;
                
                if (finalPath) {
                    store.add(finalPath);
                    renderVideo(finalPath);
                    successCount++;
                }
            }

            if (successCount > 0) {
                if (addBtn) addBtn.classList.add('hidden');
                if (emptyState) emptyState.style.display = 'none';
            } else {
                alert("未获取到有效的物理路径。建议：从文件浏览器的【侧边栏菜单】进入【内部存储】空间选择视频。");
            }
        }
    } catch (err) { 
        console.error("文件选择出错:", err);
        alert("操作异常，请检查权限设置。"); 
    }
}

// 5. 事件监听：点击加号添加视频
addBtn.onclick = (e) => {
    e.stopPropagation();
    pickVideos();
};

// 6. 事件监听：点击视频区域切换播放/暂停或显示加号
container.onclick = () => {
    // 切换加号按钮显示状态
    if (addBtn) addBtn.classList.toggle('hidden');
    
    // 找到当前正在屏幕中心的视频进行控制
    const cards = document.querySelectorAll('.video-card');
    const centerY = window.innerHeight / 2;
    cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        if (rect.top <= centerY && rect.bottom >= centerY) {
            const v = card.querySelector('video');
            if (v) {
                if (v.paused) {
                    v.play().catch(err => console.log("播放失败", err));
                } else {
                    v.pause();
                }
            }
        }
    });
};

// 7. 自动播放逻辑：IntersectionObserver
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        const v = entry.target.querySelector('video');
        if (v) {
            if (entry.isIntersecting) {
                // 进入屏幕：尝试自动播放
                v.play().catch(() => {
                    // 某些浏览器需要静音才能自动播放
                    v.muted = true;
                    v.play().catch(()=>{});
                });
            } else {
                // 离开屏幕：暂停并重置时间
                v.pause();
                v.currentTime = 0;
            }
        }
    });
}, { threshold: 0.6 }); // 只有 60% 面积进入屏幕时才触发播放
