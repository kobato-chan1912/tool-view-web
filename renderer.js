const { ipcRenderer } = require('electron');
const $ = require("jquery")

$('#startBtn').click(() => {
    const links = $('#links').val().split('\n').filter(l => l.trim() !== '');
    const proxies = $('#proxies').val().split('\n').filter(p => p.trim() !== '');
    const threads = parseInt($('#threads').val());
    const delay = parseInt($('#delay').val());

    $('#statusList').empty();
    $('#startBtn').prop('disabled', true);
    $('#pauseBtn').removeClass('d-none');
    
    ipcRenderer.send('start-view', { links, proxies, threads, delay });
});

ipcRenderer.on('update-status', (event, data) => {
    $('#statusList').append(`<li class="list-group-item">${data.link} - ${data.status}</li>`);
});
