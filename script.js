// 替换 pickVideos 函数为更底层的 pickFiles 逻辑
async function pickVideos() {
    try {
        const { FilePicker } = window.Capacitor.Plugins;
        
        // 权限检查
        if (FilePicker.requestPermissions) await FilePicker.requestPermissions();
        
        const result = await FilePicker.pickFiles({
            types: ['video/*'],
            multiple: true,
            readData: false
        });

        if (result.files && result.files.length > 0) {
            const tx = db.transaction("paths", "readwrite");
            const store = tx.objectStore("paths");

            for (const file of result.files) {
                // file.path 才是真正的物理绝对路径，URI 会在重启后失效
                if (file.path) {
                    store.add(file.path);
                    renderVideo(file.path);
                }
            }
            addBtn.classList.add('hidden');
        }
    } catch (err) {
        alert("选择失败：请确保在系统设置中开启了‘所有文件访问权限’");
    }
}
