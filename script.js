// 全选覆盖原有 pickVideos 函数及相关逻辑
async function pickVideos() {
    try {
        const { FilePicker } = window.Capacitor.Plugins;
        
        // 1. 基础权限请求 (针对 Android 13 媒体库)
        if (FilePicker.requestPermissions) await FilePicker.requestPermissions();
        
        // 2. 调用文件选择器
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
                // 优先取 path (物理路径)，这是播放和持久化的关键
                const finalPath = file.path;
                
                if (finalPath) {
                    store.add(finalPath);
                    renderVideo(finalPath);
                    successCount++;
                }
            }

            if (successCount > 0) {
                addBtn.classList.add('hidden');
                document.getElementById('empty-state').style.display = 'none';
            } else {
                alert("无法获取文件真实路径。建议：点击左上角菜单，选择【手机内部存储】后再选择视频。");
            }
        }
    } catch (err) { 
        console.error(err);
        alert("操作取消或失败。请检查是否已开启‘所有文件访问权限’。"); 
    }
}
