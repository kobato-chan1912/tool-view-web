const { ipcRenderer } = require('electron');
const $ = require("jquery")
const path = require('path');
const proxyFilePath = path.join(__dirname, 'proxies.json');
const fs = require('fs');
let isPaused = false;
const addLinksModalElement = new bootstrap.Modal(document.getElementById('addLinksModal'));


const loadProxies = () => {
    if (fs.existsSync(proxyFilePath)) {
        try {
            return JSON.parse(fs.readFileSync(proxyFilePath, 'utf8'));
        } catch (err) {
            console.error('Lỗi khi đọc file proxy:', err);
            return [];
        }
    }
    return [];
};


const proxies = loadProxies();
$('#proxyList').val(proxies.join('\n'));

let threads;
let delay;

// Bắt đầu chạy
$('#startButton').click(function () {
    const links = $('#linksList').val().split('\n').filter(link => link.trim() !== '');
    const proxies = $('#proxyList').val().split('\n').filter(proxy => proxy.trim() !== '');
    threads = parseInt($('#threads').val());
    delay = parseInt($('#delay').val());

    ipcRenderer.send('start-view', { links, proxies, threads, delay });
    $('#pauseButton, #continueButton').show(); // Hiện nút pause và continue khi chạy
    $("#status").empty()
});

// Nhận trạng thái cập nhật
ipcRenderer.on('update-status', (event, data) => {
    if (data.status !== '') {
        $('#status').append(`<p class="mt-1 mb-1">${data.link}</p>`);

    } else {
        $('#status').append(`<p class="mt-1 mb-1">${data.link}: ${data.status}</p>`);

    }

    $('#status').scrollTop($('#status')[0].scrollHeight);


});

// Khi tạm dừng
ipcRenderer.on('open-add-links-modal', () => {
    isPaused = true;
    addLinksModalElement.show()
});


$('#confirmAddLinks').click(function () {
    const newLinks = $('#newLinksInput').val().split('\n').filter(link => link.trim() !== '');
    if (newLinks.length > 0) {
        const currentLinks = $('#linksList').val().split('\n').filter(link => link.trim() !== '');
        const updatedLinks = [...currentLinks, ...newLinks];
        $('#linksList').val([...currentLinks, ...newLinks].join('\n')); // Append vào textarea cũ
        ipcRenderer.send('update-links', updatedLinks, delay);
    }
    addLinksModalElement.hide()
});

ipcRenderer.on('resume-viewing', () => {
    isPaused = false;
    console.log("Tiếp tục chạy...");
});


ipcRenderer.on('process-completed', () => {
    $('#pauseButton, #continueButton').hide();
    alert("Toàn bộ tiến trình đã hoàn tất!")
});


$('#pauseButton').click(function () {
    ipcRenderer.send('pause');
});

// Khi tiếp tục
$('#continueButton').click(function () {
    ipcRenderer.send('continue');
});

ipcRenderer.on('update-proxy-list', (event, validProxies) => {
    const proxyTextarea = document.getElementById('proxyList'); // Thay đúng ID
    proxyTextarea.value = validProxies.join('\n'); // Cập nhật lại danh sách proxy hợp lệ
});




// Ẩn nút Pause và Continue khi mới khởi động
$('#pauseButton, #continueButton').hide();
