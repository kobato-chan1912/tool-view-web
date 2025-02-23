const { app, BrowserWindow, ipcMain } = require('electron');
const puppeteer = require('puppeteer');

let mainWindow;

app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');
});

ipcMain.on('start-view', async (event, data) => {
    const { links, proxies, threads, delay } = data;
    
    for (let i = 0; i < links.length; i++) {
        let proxy = proxies[i % proxies.length];
        console.log(proxy)

        try {
            let args = [];
            if (typeof proxy !== "undefined"){
                console.log('1234')
                args = [`--proxy-server=${proxy}`];
            }
            const browser = await puppeteer.launch({
                args: args,
                headless: false
            });

            const page = await browser.newPage();
            await page.goto(links[i], { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, delay * 1000));

            await browser.close();
            event.reply('update-status', { link: links[i], status: 'Done' });

        } catch (error) {
            console.log(error);
            event.reply('update-status', { link: links[i], status: 'Proxy failed' });
        }
    }
});
