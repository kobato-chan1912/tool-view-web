const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const puppeteer = require('puppeteer');
const pLimit = require('p-limit');
const path = require('path');
const os = require('os');


let mainWindow;
let isPaused = false;
let runningTasks = [];
let limit;

const proxyFilePath = path.join(__dirname, 'proxies.json');
let validProxies = [];
let proxyIndex = 0;

// 📌 Hàm lưu proxy vào file
const saveProxies = (proxies) => {
    fs.writeFileSync(proxyFilePath, JSON.stringify(proxies, null, 2), 'utf8');
};

// 📌 Hàm kiểm tra proxy có hoạt động không
const checkProxy = async (proxy) => {
    try {
        const browser = await puppeteer.launch({
            args: [`--proxy-server=${proxy}`]
        });
        const page = await browser.newPage();
        await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 5000 });
        await browser.close();
        return true;
    } catch (error) {
        return false;
    }
};

// 📌 Hàm chạy từng task
const runTask = async (link, delay) => {
    while (isPaused) {
        mainWindow.webContents.send('update-status', { link: 'Đang tạm dừng... Ấn tiếp tục để tiếp tục...', status: '' });
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (validProxies.length === 0) {
        mainWindow.webContents.send('update-status', { link: 'Không có proxy hợp lệ!', status: '' });
        return;
    }

    let proxy = validProxies[proxyIndex % validProxies.length];
    proxyIndex++;

    try {
        let browserOptions = {
            args: [`--proxy-server=${proxy}`],
            headless: false
        };
        if (os.platform() === 'win32') {
            browserOptions.executablePath = path.join(__dirname, 'chrome', 'chrome.exe');
        }




        const browser = await puppeteer.launch({
            args: [`--proxy-server=${proxy}`],
            headless: false
        });
        const page = await browser.newPage();
        
        mainWindow.webContents.send('update-status', { link, status: 'Mở web - dùng proxy ' + proxy });
        await page.goto(link, { waitUntil: 'networkidle2' });

        mainWindow.webContents.send('update-status', { link, status: `Chờ ${delay}s...` });
        await new Promise(r => setTimeout(r, delay * 1000));

        await browser.close();
        mainWindow.webContents.send('update-status', { link, status: 'Hoàn thành' });

    } catch (error) {
        console.log(`Lỗi proxy: ${proxy} - ${error.message}`);
        mainWindow.webContents.send('update-status', { link, status: 'Lỗi proxy' });
    }
};

app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
});

// 📌 Bắt đầu chạy các tasks
ipcMain.on('start-view', async (event, data) => {
    let { links, proxies, threads, delay } = data;
    proxyIndex = 0;

    validProxies = [];
    for (let proxy of proxies) {
        mainWindow.webContents.send('update-status', { link: `Kiểm tra proxy: ${proxy}`, status: '' });
        const isValid = await checkProxy(proxy);
        if (isValid) {
            validProxies.push(proxy);
        } else {
            console.log(`Xóa proxy lỗi: ${proxy}`);
        }
    }
    mainWindow.webContents.send('update-proxy-list', validProxies);
    saveProxies(validProxies); // Lưu lại danh sách proxy hợp lệ

    if (validProxies.length === 0) {
        event.reply('update-status', { link: 'Không có proxy hợp lệ!', status: '' });
        event.reply('process-completed');
        return;
    }

    limit = pLimit(threads);

    runningTasks = links.map(link => {
        const task = limit(() => runTask(link, delay));
        task.isResolved = false;
        task.finally(() => task.isResolved = true);
        return task;
    });

    checkAllTasksCompleted(event);

});

// 📌 Tạm dừng tiến trình
ipcMain.on('pause', () => {
    isPaused = true;
    mainWindow.webContents.send('open-add-links-modal');
});


let isCheckingTasks = false; 

const checkAllTasksCompleted = async (event) => {
    if (isCheckingTasks) return; // Nếu đã có một tiến trình kiểm tra, bỏ qua
    isCheckingTasks = true;

    while (runningTasks.length > 0) {
        await Promise.all(runningTasks);
        runningTasks = runningTasks.filter(task => !task.isResolved);
    }

    isCheckingTasks = false;
    event.reply('process-completed'); // ✅ Chỉ gửi một lần khi tất cả task hoàn thành
};




// 📌 Tiếp tục tiến trình sau khi tạm dừng
ipcMain.on('continue', () => {
    isPaused = false;
    mainWindow.webContents.send('update-status', { link: 'Tiến trình đã tiếp tục', status: '' });
});

ipcMain.on('update-links', (event, updatedLinks, delay) => {
    updatedLinks.forEach(link => {
        const newTask = limit(() => runTask(link, delay));
        newTask.isResolved = false;
        newTask.finally(() => newTask.isResolved = true);
        runningTasks.push(newTask);
    });

    checkAllTasksCompleted(event);

})