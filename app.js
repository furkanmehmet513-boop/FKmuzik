// --- STATE & DEĞİŞKENLER ---
let songs = [];
let playlists = [];
let queue = [];
let history = [];
let currentSongIndex = -1;
let currentSongsList = [];
let currentView = 'all';
let isPlaying = false;
let repeatMode = 0; 
let shuffleMode = false;
let swapSourceId = null;
let sortMode = 'manual';

// Uyku Zamanlayıcı
let sleepTimerInterval = null;
let sleepTimeRemaining = 0; 

const audio = new Audio();

const el = {
    app: document.body,
    overlay: document.getElementById('overlay'),
    sidebar: document.getElementById('sidebar'),
    songList: document.getElementById('song-list'),
    viewTitle: document.getElementById('view-title'),
    playlistsContainer: document.getElementById('playlists-container'),
    
    playBtn: document.getElementById('btn-play'),
    prevBtn: document.getElementById('btn-prev'),
    nextBtn: document.getElementById('btn-next'),
    shuffleBtn: document.getElementById('btn-shuffle'),
    repeatBtn: document.getElementById('btn-repeat'),
    muteBtn: document.getElementById('btn-mute'),
    volumeSlider: document.getElementById('volume-slider'),
    progressBar: document.getElementById('progress-bar'),
    progressContainer: document.getElementById('progress-container'),
    timeCurrent: document.getElementById('time-current'),
    timeTotal: document.getElementById('time-total'),
    playerTitle: document.getElementById('player-title'),
    playerArtist: document.getElementById('player-artist'),
    playerCover: document.getElementById('player-cover'),
    sleepTimerDisplay: document.getElementById('sleep-timer-display'),
    
    searchInput: document.getElementById('search-input'),
    searchInputMobile: document.getElementById('search-input-mobile'),
    sortSelect: document.getElementById('sort-select'),
    fileUpload: document.getElementById('file-upload'),
    folderUpload: document.getElementById('folder-upload'),
    coverUpload: document.getElementById('cover-upload'),
    toast: document.getElementById('toast')
};

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadData();
    setupEventListeners();
    setupAudioListeners();
});

// --- VERİ TABANI YERİNE LOCALSTORAGE ---
function loadData() {
    try {
        const raw = localStorage.getItem('fk_music_data');
        if (raw) {
            const data = JSON.parse(raw);
            songs = data.songs || [];
            playlists = data.playlists || [];
            queue = data.queue || [];
            history = data.history || [];
        }
    } catch (e) {
        console.error("Veri yüklenirken hata:", e);
    }
    
    renderPlaylistsSidebar();
    switchView('all');
}

function saveData() {
    try {
        const data = { songs, playlists, queue, history };
        localStorage.setItem('fk_music_data', JSON.stringify(data));
    } catch (e) {
        console.error("Kaydetme hatası:", e);
        alert("Uyarı: Tarayıcı depolama limiti dolmuş olabilir. Bazı veriler kaydedilemedi!");
    }
}

// --- DOSYA YÜKLEME VE İŞLEME ---
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function handleFiles(files) {
    if(!files || files.length === 0) return;
    for(let file of files) {
        if(!file.type.startsWith('audio/')) continue;
        let cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/official audio|official video|lyrics|hq|hd/ig, '').trim();
        let artist = "Bilinmeyen Sanatçı", title = cleanName;
        if(cleanName.includes('-')) {
            const parts = cleanName.split('-');
            artist = parts[0].trim(); title = parts.slice(1).join('-').trim();
        }
        
        try {
            const dataURL = await blobToBase64(file);
            const song = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                title, artist, addedAt: Date.now(), isFavorite: false, dataURL, coverURL: null
            };
            songs.unshift(song);
        } catch(e) {
            console.error("Dosya okunurken hata:", e);
        }
    }
    saveData();
    if(currentView === 'all') switchView('all');
}

// --- GÖRÜNÜM (RENDER) ---
function renderSongList(listToRender) {
    currentSongsList = [...listToRender]; // Kopya
    
    // Sıralama Uygula
    if (sortMode === 'az') {
        currentSongsList.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortMode === 'za') {
        currentSongsList.sort((a, b) => b.title.localeCompare(a.title));
    }
    // Manuel ise sıralama yapma, array sırasını koru.

    el.songList.innerHTML = '';
    if(currentSongsList.length === 0) {
        el.songList.innerHTML = `<div style="text-align:center; padding:50px; color:var(--text-sec);">Burada henüz şarkı yok.</div>`;
        return;
    }

    currentSongsList.forEach((song, index) => {
        const div = document.createElement('div');
        div.className = `song-item ${audio.dataset.currentId === song.id ? 'playing' : ''}`;
        
        let actionsHtml = `
            <button class="action-btn" onclick="addToQueue('${song.id}', event)" title="Sıraya Ekle"><i class="fa-solid fa-plus"></i></button>
            <button class="action-btn" onclick="toggleFavorite('${song.id}', event)"><i class="${song.isFavorite ? 'fa-solid text-accent' : 'fa-regular'} fa-heart" style="${song.isFavorite?'color:var(--accent)':''}"></i></button>
            <button class="action-btn" onclick="openAddToPlaylistModal('${song.id}', event)"><i class="fa-solid fa-list-ul"></i></button>
            <button class="action-btn ${swapSourceId === song.id ? 'swap-mode' : ''}" onclick="handleSwap('${song.id}', event)" title="Yer Değiştir"><i class="fa-solid fa-sort"></i></button>
            <button class="action-btn" onclick="requestDelete('${song.id}', event)"><i class="fa-solid fa-trash"></i></button>
        `;

        div.innerHTML = `
            <div style="cursor:pointer;" onclick="playSong('${song.id}')">${index + 1}</div>
            <div class="song-cover">${song.coverURL ? `<img src="${song.coverURL}">` : `<i class="fa-solid fa-music"></i>`}</div>
            <div class="song-title" style="cursor:pointer;" onclick="playSong('${song.id}')">${song.title}</div>
            <div class="song-artist">${song.artist}</div>
            <div class="song-actions">${actionsHtml}</div>
        `;
        el.songList.appendChild(div);
    });
}

function renderPlaylistsSidebar() {
    el.playlistsContainer.innerHTML = '';
    playlists.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'menu-item';
        btn.innerHTML = `<i class="fa-solid fa-list"></i> ${p.name}`;
        btn.onclick = () => switchView(`playlist_${p.id}`);
        el.playlistsContainer.appendChild(btn);
    });
}

// --- OYNATICI MOTORU ---
function playSong(id) {
    const song = songs.find(s => s.id === id);
    if(!song) return;
    
    audio.src = song.dataURL;
    audio.dataset.currentId = song.id;
    currentSongIndex = currentSongsList.findIndex(s => s.id === id);
    
    el.playerTitle.innerText = song.title;
    el.playerArtist.innerText = song.artist;
    
    if(song.coverURL) el.playerCover.innerHTML = `<img src="${song.coverURL}">`;
    else el.playerCover.innerHTML = `<i class="fa-solid fa-music"></i>`;

    audio.play();
    isPlaying = true;
    updatePlayPauseUI();
    renderSongList(currentSongsList); // Aktif rengi güncelle
    updateMediaSession(song);
}

function togglePlay() {
    if(!audio.src) { if(currentSongsList.length > 0) playSong(currentSongsList[0].id); return; }
    if(isPlaying) { audio.pause(); isPlaying = false; }
    else { audio.play(); isPlaying = true; }
    updatePlayPauseUI();
}

function playNext() {
    if(currentSongsList.length === 0) return;
    if(shuffleMode) {
        playSong(currentSongsList[Math.floor(Math.random() * currentSongsList.length)].id);
        return;
    }
    let nextIndex = currentSongIndex + 1;
    if(nextIndex >= currentSongsList.length) {
        if(repeatMode === 1) nextIndex = 0;
        else return;
    }
    playSong(currentSongsList[nextIndex].id);
}

function playPrev() {
    if(audio.currentTime > 3) { audio.currentTime = 0; return; }
    if(currentSongsList.length === 0) return;
    let prevIndex = currentSongIndex - 1;
    if(prevIndex < 0) prevIndex = currentSongsList.length - 1;
    playSong(currentSongsList[prevIndex].id);
}

function updatePlayPauseUI() {
    el.playBtn.innerHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
}

function setupAudioListeners() {
    audio.addEventListener('timeupdate', () => {
        if(!audio.duration) return;
        el.progressBar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
        el.timeCurrent.innerText = formatTime(audio.currentTime);
        el.timeTotal.innerText = formatTime(audio.duration);
        if(audio.currentTime >= 10 && !audio.dataset.historySaved) {
            audio.dataset.historySaved = "true";
            saveToHistory(audio.dataset.currentId);
        }
    });
    audio.addEventListener('ended', () => {
        if(repeatMode === 2) { audio.currentTime = 0; audio.play(); }
        else playNext();
    });
    audio.addEventListener('loadstart', () => audio.dataset.historySaved = "");
    el.progressContainer.addEventListener('click', (e) => {
        if(!audio.duration) return;
        const rect = el.progressContainer.getBoundingClientRect();
        audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
    });
}

function formatTime(seconds) {
    if(isNaN(seconds)) return "0:00";
    const min = Math.floor(seconds / 60), sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
}

function updateMediaSession(song) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: song.title, artist: song.artist, album: 'FK Müzik' });
        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('previoustrack', playPrev);
        navigator.mediaSession.setActionHandler('nexttrack', playNext);
    }
}

// --- TOAST BİLDİRİMİ ---
function showToast(message) {
    el.toast.innerText = message;
    el.toast.classList.add('show');
    setTimeout(() => {
        el.toast.classList.remove('show');
    }, 3000);
}

// --- SIRA, YER DEĞİŞTİRME, FAVORİLER ---
function addToQueue(id, e) { 
    e.stopPropagation(); 
    if(!queue.includes(id)) {
        queue.push(id); 
        saveData();
    }
    showToast("Şarkı sıraya eklendi!");
}

function switchView(view) {
    currentView = view; swapSourceId = null;
    document.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active'));
    
    // Sidebar active class
    const activeBtn = document.querySelector(`.menu-item[data-view="${view}"]`);
    if(activeBtn) activeBtn.classList.add('active');

    if(view === 'all') { 
        el.viewTitle.innerText = "Tüm Şarkılar"; 
        renderSongList(songs); 
    }
    else if(view === 'queue') {
        el.viewTitle.innerText = "Sıram";
        const qSongs = queue.map(id => songs.find(s => s.id === id)).filter(Boolean);
        renderSongList(qSongs);
    }
    else if(view === 'favorites') { 
        el.viewTitle.innerText = "Favoriler"; 
        renderSongList(songs.filter(s => s.isFavorite)); 
    }
    else if(view === 'history') { 
        el.viewTitle.innerText = "Geçmiş"; 
        loadHistoryView(); 
    }
    else if(view.startsWith('playlist_')) {
        const p = playlists.find(p => p.id === view.split('_')[1]);
        if(p) {
            el.viewTitle.innerText = p.name;
            renderSongList(p.songIds.map(id => songs.find(s => s.id === id)).filter(Boolean));
        }
    }
    closeSidebar();
}

function loadHistoryView() {
    const histSongs = history.map(id => songs.find(s => s.id === id)).filter(Boolean);
    renderSongList(histSongs);
}

function saveToHistory(id) { 
    history = history.filter(h => h !== id); // Var olanı çıkar
    history.unshift(id); // Başa ekle
    if(history.length > 50) history.pop(); // Max 50
    saveData();
}

function toggleFavorite(id, e) {
    e.stopPropagation();
    const song = songs.find(s => s.id === id);
    if(song) {
        song.isFavorite = !song.isFavorite;
        saveData();
        switchView(currentView); // Refresh current view
    }
}

function handleSwap(id, e) {
    e.stopPropagation();
    
    if(sortMode !== 'manual') {
        alert("Yer değiştirme işlemi sadece 'Manuel' sıralama modunda yapılabilir.");
        return;
    }

    if(!swapSourceId) { 
        swapSourceId = id; 
        renderSongList(currentSongsList); // Seçili efekti uygula
    } 
    else {
        if(swapSourceId !== id) {
            // Hangi listedeysek onda swap yap
            if(currentView === 'queue') {
                const idx1 = queue.indexOf(swapSourceId);
                const idx2 = queue.indexOf(id);
                if(idx1 !== -1 && idx2 !== -1) {
                    const temp = queue[idx1];
                    queue[idx1] = queue[idx2];
                    queue[idx2] = temp;
                }
            } else if (currentView === 'all') {
                const idx1 = songs.findIndex(s => s.id === swapSourceId);
                const idx2 = songs.findIndex(s => s.id === id);
                if(idx1 !== -1 && idx2 !== -1) {
                    const temp = songs[idx1];
                    songs[idx1] = songs[idx2];
                    songs[idx2] = temp;
                }
            } else if (currentView.startsWith('playlist_')) {
                const p = playlists.find(p => p.id === currentView.split('_')[1]);
                if(p) {
                    const idx1 = p.songIds.indexOf(swapSourceId);
                    const idx2 = p.songIds.indexOf(id);
                    if(idx1 !== -1 && idx2 !== -1) {
                        const temp = p.songIds[idx1];
                        p.songIds[idx1] = p.songIds[idx2];
                        p.songIds[idx2] = temp;
                    }
                }
            } else if (currentView === 'history') {
                const idx1 = history.indexOf(swapSourceId);
                const idx2 = history.indexOf(id);
                if(idx1 !== -1 && idx2 !== -1) {
                    const temp = history[idx1];
                    history[idx1] = history[idx2];
                    history[idx2] = temp;
                }
            }
            saveData();
        }
        swapSourceId = null; 
        switchView(currentView);
    }
}

// --- ÇALMA LİSTESİ VE SİLME ---
document.getElementById('btn-create-playlist').onclick = () => { document.getElementById('playlist-name-input').value = ''; openModal('modal-create-playlist'); };
document.getElementById('btn-confirm-create-playlist').onclick = () => {
    const name = document.getElementById('playlist-name-input').value.trim();
    if(!name) return;
    const p = { id: Date.now().toString(), name, songIds: [] };
    playlists.push(p);
    saveData();
    renderPlaylistsSidebar(); closeModal('modal-create-playlist');
};

let songToAddId = null;
function openAddToPlaylistModal(id, e) {
    e.stopPropagation(); songToAddId = id;
    const listEl = document.getElementById('modal-playlist-list');
    listEl.innerHTML = '';
    playlists.forEach(p => {
        const btn = document.createElement('button'); btn.innerText = p.name;
        btn.onclick = () => {
            if(!p.songIds.includes(songToAddId)) { 
                p.songIds.push(songToAddId); 
                saveData(); 
                showToast("Çalma listesine eklendi!");
            }
            closeModal('modal-add-to-playlist');
        };
        listEl.appendChild(btn);
    });
    openModal('modal-add-to-playlist');
}

let songToDeleteId = null;
function requestDelete(id, e) {
    e.stopPropagation(); songToDeleteId = id;
    let text = "Bu şarkıyı tamamen silmek istediğinize emin misiniz?";
    if(currentView === 'favorites') text = "Bu şarkıyı favorilerden çıkarmak istiyor musunuz?";
    else if(currentView === 'queue') text = "Bu şarkıyı sıradan (Sıram) çıkarmak istiyor musunuz?";
    else if(currentView.startsWith('playlist_')) text = "Bu şarkıyı çalma listesinden çıkarmak istiyor musunuz?";
    else if(currentView === 'history') text = "Bu şarkıyı geçmişten silmek istiyor musunuz?";
    
    document.getElementById('delete-warning-text').innerText = text;
    openModal('modal-confirm-delete');
}

document.getElementById('btn-confirm-delete').onclick = () => {
    if(!songToDeleteId) return;
    
    if(currentView === 'all') {
        songs = songs.filter(s => s.id !== songToDeleteId);
        queue = queue.filter(id => id !== songToDeleteId);
        history = history.filter(id => id !== songToDeleteId);
        playlists.forEach(p => p.songIds = p.songIds.filter(id => id !== songToDeleteId));
    } else if(currentView === 'favorites') {
        const song = songs.find(s => s.id === songToDeleteId);
        if(song) song.isFavorite = false;
    } else if(currentView === 'queue') {
        queue = queue.filter(id => id !== songToDeleteId);
    } else if(currentView === 'history') {
        history = history.filter(id => id !== songToDeleteId);
    } else if(currentView.startsWith('playlist_')) {
        const p = playlists.find(p => p.id === currentView.split('_')[1]);
        if(p) p.songIds = p.songIds.filter(id => id !== songToDeleteId);
    }
    
    saveData();
    closeModal('modal-confirm-delete'); 
    switchView(currentView); 
};

// --- KAPAK FOTOĞRAFLARI ---
el.playerCover.addEventListener('click', () => { if(audio.dataset.currentId) el.coverUpload.click(); });
el.coverUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0]; if(!file) return;
    try {
        const dataURL = await blobToBase64(file);
        const song = songs.find(s => s.id === audio.dataset.currentId);
        if(song) {
            song.coverURL = dataURL;
            saveData();
            el.playerCover.innerHTML = `<img src="${dataURL}">`;
            switchView(currentView);
        }
    } catch(err) {
        console.error(err);
    }
});

// --- YEDEKLEME VE GERİ YÜKLEME (METİN TABANLI) ---
document.getElementById('btn-text-backup').onclick = () => {
    closeSidebar();
    const dataObj = { songs, playlists, queue, history };
    const jsonStr = JSON.stringify(dataObj);
    document.getElementById('backup-textarea').value = jsonStr;
    openModal('modal-text-backup');
};

document.getElementById('btn-copy-backup').onclick = () => {
    const ta = document.getElementById('backup-textarea');
    ta.select();
    document.execCommand('copy');
    showToast("Yedekleme metni panoya kopyalandı!");
};

document.getElementById('btn-text-restore').onclick = () => {
    closeSidebar();
    document.getElementById('restore-textarea').value = "";
    openModal('modal-text-restore');
};

document.getElementById('btn-confirm-restore').onclick = () => {
    const text = document.getElementById('restore-textarea').value.trim();
    if(!text) { alert("Lütfen yedek metnini yapıştırın."); return; }
    
    try {
        const data = JSON.parse(text);
        if(data && typeof data === 'object') {
            localStorage.setItem('fk_music_data', text);
            alert("Geri yükleme başarılı! Uygulama yenileniyor...");
            location.reload();
        } else {
            alert("Hata: Metin geçerli bir JSON objesi değil.");
        }
    } catch(err) {
        alert("Hata: Geçersiz JSON formatı. Kopyaladığınız metnin bozuk olmadığından emin olun.");
    }
};

// --- TEMA VE ARAYÜZ (THEME & UI) ---
function initTheme() {
    const saved = localStorage.getItem('fk_theme') || 'dark';
    document.body.setAttribute('data-theme', saved);
}

document.getElementById('btn-theme-toggle').onclick = () => {
    const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next); localStorage.setItem('fk_theme', next);
};

// --- UYKU ZAMANLAYICISI FONKSİYONLARI ---
function startSleepTimer(minutes) {
    if(sleepTimerInterval) clearInterval(sleepTimerInterval);
    
    if(minutes === 0) { 
        el.sleepTimerDisplay.style.display = 'none'; 
        showToast("Uyku modu kapatıldı.");
        return; 
    }
    
    sleepTimeRemaining = minutes * 60; 
    el.sleepTimerDisplay.style.display = 'inline'; 
    updSleep();
    
    showToast(`Uyku modu aktifleştirildi: ${minutes} dakika`);
    
    sleepTimerInterval = setInterval(() => {
        sleepTimeRemaining--; 
        updSleep();
        
        if(sleepTimeRemaining <= 0) { 
            clearInterval(sleepTimerInterval); 
            audio.pause(); 
            isPlaying = false; 
            updatePlayPauseUI(); 
            el.sleepTimerDisplay.style.display = 'none'; 
            alert("Uyku modu: Zaman doldu, müzik durduruldu."); 
        }
    }, 1000);
}

function updSleep() { 
    const m = Math.floor(sleepTimeRemaining / 60);
    const s = sleepTimeRemaining % 60; 
    el.sleepTimerDisplay.innerText = `${m}:${s<10?'0'+s:s}`; 
}

function setupEventListeners() {
    document.getElementById('btn-menu').onclick = () => { el.sidebar.classList.add('open'); el.overlay.classList.add('show'); };
    document.getElementById('close-sidebar').onclick = closeSidebar;
    el.overlay.onclick = () => { closeSidebar(); };
    
    document.getElementById('btn-upload-menu').onclick = (e) => { e.stopPropagation(); document.getElementById('upload-options').classList.toggle('show'); };
    document.onclick = (e) => { if(!e.target.closest('.upload-dropdown')) document.getElementById('upload-options').classList.remove('show'); };
    
    document.getElementById('btn-add-files').onclick = () => el.fileUpload.click();
    document.getElementById('btn-add-folder').onclick = () => el.folderUpload.click();
    el.fileUpload.addEventListener('change', (e) => handleFiles(e.target.files));
    el.folderUpload.addEventListener('change', (e) => handleFiles(e.target.files));
    
    // Sidebar Menü Butonları
    document.querySelectorAll('.menu-item[data-view]').forEach(btn => {
        btn.onclick = () => { switchView(btn.dataset.view); };
    });
    
    // Sıralama Dropdown
    el.sortSelect.addEventListener('change', (e) => {
        sortMode = e.target.value;
        switchView(currentView); // Listeyi yeniden oluştur ve sırala
    });

    el.playBtn.onclick = togglePlay; el.nextBtn.onclick = playNext; el.prevBtn.onclick = playPrev;
    el.shuffleBtn.onclick = () => { shuffleMode = !shuffleMode; el.shuffleBtn.classList.toggle('active', shuffleMode); };
    el.repeatBtn.onclick = () => {
        repeatMode = (repeatMode + 1) % 3;
        if(repeatMode === 0) el.repeatBtn.innerHTML = '<i class="fa-solid fa-repeat"></i>', el.repeatBtn.classList.remove('active');
        else if(repeatMode === 1) el.repeatBtn.innerHTML = '<i class="fa-solid fa-repeat"></i>', el.repeatBtn.classList.add('active');
        else el.repeatBtn.innerHTML = '<i class="fa-solid fa-repeat-1"></i>', el.repeatBtn.classList.add('active');
    };
    
    el.volumeSlider.addEventListener('input', (e) => {
        audio.volume = e.target.value;
        el.muteBtn.innerHTML = audio.volume == 0 ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
    });
    el.muteBtn.onclick = () => { audio.muted = !audio.muted; el.muteBtn.innerHTML = audio.muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>'; };
    
    const searchFn = (e) => {
        const q = e.target.value.toLowerCase();
        let list = currentView === 'all' ? songs : currentView === 'favorites' ? songs.filter(s => s.isFavorite) : currentView === 'queue' ? queue.map(id => songs.find(s => s.id === id)).filter(Boolean) : currentSongsList;
        renderSongList(!q ? list : list.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)));
    };
    
    el.searchInput.addEventListener('input', searchFn);
    el.searchInputMobile.addEventListener('input', searchFn);

    document.getElementById('btn-sleep-timer').onclick = () => openModal('modal-sleep-timer');
    
    document.querySelectorAll('.timer-btn').forEach(btn => {
        btn.onclick = () => {
            const time = parseInt(btn.dataset.time);
            document.querySelectorAll('.timer-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            startSleepTimer(time);
            closeModal('modal-sleep-timer');
        };
    });
}

function closeSidebar() { el.sidebar.classList.remove('open'); el.overlay.classList.remove('show'); }
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }