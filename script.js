// 修改 pickVideos 函数，使其符合 Android 13+ 的路径逻辑
async function pickVideos() {
    try {
        const { FilePicker } = window.Capacitor.Plugins;
        
        // 使用 pickFiles 获取更直接的物理路径
        const result = await FilePicker.pickFiles({
            types: ['video/*'],
            multiple: true,
            readData: false
        });

        if (result.files && result.files.length > 0) {
            const tx = db.transaction("paths", "readwrite");
            const store = tx.objectStore("paths");

            for (const file of result.files) {
                // 确保只保存物理路径（/storage/emulated/0/...）
                if (file.path) {
                    store.add(file.path);
                    renderVideo(file.path);
                }
            }
            addBtn.classList.add('hidden');
        }
    } catch (err) {
        console.error("选择失败:", err);
        alert("请在设置中授予‘所有文件访问权限’以确保视频正常播放。");
    }
}
