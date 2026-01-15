(() => {
  // Constants
  const NUM_CARDS = 25;
  const DEFAULT_BACK_PATH = 'assets/back.webp';
  const IDB_DB = 'war_card_db';
  const IDB_STORE = 'decks';
  const LS_KEY = 'customWarDeck_v2';

  // DOM elements
  const get = id => document.getElementById(id);
  const playerDeckCount = get('player-deck-count');
  const computerDeckCount = get('computer-deck-count');
  const playButton = get('play-button');
  const playAgainButton = get('play-again-button');
  const customDeckButton = get('custom-deck-button');
  const playerCardSlot = get('player-card');
  const computerCardSlot = get('computer-card');
  const messageArea = get('message-area');
  const modal = get('deck-builder-modal');
  const closeButton = document.querySelector('.close-button');
  const imageUploader = get('image-uploader');
  const backImageUploader = get('back-image-uploader');
  const backPreview = get('back-preview');
  const imagePreviewArea = get('image-preview-area');
  const saveDeckButton = get('save-deck-button');
  const metadataEditor = get('metadata-editor');
  const uploaderNameInput = get('uploader-name');
  const artistNameInput = get('artist-name');
  const cardDescriptionInput = get('card-description');
  const setAsBackButton = document.getElementById('set-as-back-button');
  const playerCurrentValue = get('player-current-value');
  const computerCurrentValue = get('computer-current-value');

  // Accessibility
  if (messageArea && !messageArea.getAttribute('aria-live')) {
    messageArea.setAttribute('aria-live', 'polite');
  }

  // State
  let playerDeck, computerDeck;
  let inWar = false;
  let customDeck = [];
  let uploadedCards = [];
  let selectedCardIndex = -1;
  let cardBackImage = null; // data URL or path

  // --- IndexedDB wrapper (simple) ---
  function openIDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return resolve(null);
      const req = indexedDB.open(IDB_DB, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  async function idbSaveDeck(obj) {
    try {
      const db = await openIDB();
      if (!db) throw new Error('IndexedDB unavailable');
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.put({ id: 'customDeck', data: obj });
        tx.oncomplete = () => resolve(true);
        tx.onabort = tx.onerror = () => reject(new Error('IDB write failed'));
      });
    } catch (e) { throw e; }
  }

  async function idbLoadDeck() {
    try {
      const db = await openIDB();
      if (!db) return null;
      return new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.get('customDeck');
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      });
    } catch (e) { return null; }
  }

  // --- Image helpers: dataURL resize/convert to WebP ---
  function dataURLToImage(dataURL) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataURL;
    });
  }

  async function resizeDataUrl(dataUrl, maxWidth = 900, maxHeight = 1350, quality = 0.82) {
    try {
      const img = await dataURLToImage(dataUrl);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      return canvas.toDataURL('image/webp', quality);
    } catch (e) { console.warn('resize failed', e); return dataUrl; }
  }

  // --- Persistence: try IDB then fallback to localStorage ---
  async function saveDeckPersistent(facesArray, backDataUrl) {
    const payload = { faces: facesArray, back: backDataUrl };
    try {
      await idbSaveDeck(payload);
      console.log('Saved deck to IndexedDB');
      return true;
    } catch (e) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(payload));
        console.warn('Saved deck to localStorage (IDB failed)');
        return true;
      } catch (err) { console.error('Failed to save deck', err); return false; }
    }
  }

  async function loadDeckPersistent() {
    try {
      const deck = await idbLoadDeck();
      if (deck) return deck;
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { console.warn('load deck failed', e); return null; }
  }

  // --- Utilities ---
  function randomInt(maxExclusive) {
    if (window.crypto && window.crypto.getRandomValues) {
      const range = maxExclusive;
      if (range <= 0) return 0;
      const maxUint32 = 0xffffffff;
      const limit = Math.floor((maxUint32 + 1) / range) * range;
      let rand;
      do {
        const arr = new Uint32Array(1);
        window.crypto.getRandomValues(arr);
        rand = arr[0];
      } while (rand >= limit);
      return rand % range;
    }
    return Math.floor(Math.random() * maxExclusive);
  }

  // --- Card / Deck classes ---
  class Card { constructor(value, image, metadata = {}) { this.value = value; this.image = image; this.metadata = metadata; } }
  class Deck { constructor(cards = []) { this.cards = cards; } shuffle() { const arr = this.cards; for (let i = arr.length - 1; i > 0; i--) { const j = randomInt(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } } draw() { return this.cards.shift(); } drawMultiple(n) { return this.cards.splice(0, n); } addCards(cards) { this.cards.push(...cards); } get size() { return this.cards.length; } }

  // --- Rendering helpers ---
  function renderDeckBacks() {
    const playerDeckEl = document.getElementById('player-deck');
    const computerDeckEl = document.getElementById('computer-deck');
    [playerDeckEl, computerDeckEl].forEach(el => {
      if (!el) return;
      el.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.className = 'card card-back';
      if (cardBackImage) {
        if (cardBackImage.startsWith('data:') || cardBackImage.startsWith('blob:')) {
          wrapper.style.backgroundImage = `url(${cardBackImage})`;
        } else {
          wrapper.style.backgroundImage = `url(${cardBackImage})`;
        }
        wrapper.style.backgroundSize = 'cover';
        wrapper.style.backgroundPosition = 'center';
      }
      el.appendChild(wrapper);
    });
  }

  function displayCard(card, slot, isFaceDown = false) {
    slot.innerHTML = '';
    const outer = document.createElement('div');
    outer.className = 'card-outer';

    const art = document.createElement('div');
    art.className = 'card-art';

    if (isFaceDown) {
      if (cardBackImage) art.style.backgroundImage = `url(${cardBackImage})`;
      else art.style.backgroundColor = '#888';
    } else {
      if (card && card.image) art.style.backgroundImage = `url(${card.image})`;
      else art.style.backgroundColor = 'white';

      const badge = document.createElement('div');
      badge.className = 'card-badge';
      badge.textContent = card ? card.value : '';
      outer.appendChild(badge);

      if (slot.id === 'player-card') playerCurrentValue.textContent = card ? card.value : '-';
      if (slot.id === 'computer-card') computerCurrentValue.textContent = card ? card.value : '-';
    }

    outer.appendChild(art);

    if (card && card.metadata && card.metadata.artist) {
      const meta = document.createElement('div');
      meta.className = 'card-metadata';
      meta.textContent = `Art by: ${card.metadata.artist}`;
      outer.appendChild(meta);
    }

    slot.appendChild(outer);
  }

  // --- Game logic ---
  function createNewDeck(isCustom = false) {
    const cards = [];
    if (isCustom && Array.isArray(customDeck) && customDeck.length) {
      customDeck.forEach((cardData, index) => {
        cards.push(new Card(index + 1, cardData.image, cardData.metadata || {}));
      });
    } else {
      for (let i = 1; i <= NUM_CARDS; i++) cards.push(new Card(i, `default_image_${i}.jpg`));
    }
    return new Deck(cards);
  }

  function updateDeckCounts() { playerDeckCount.textContent = playerDeck.size; computerDeckCount.textContent = computerDeck.size; }
  function clearCardSlots() { playerCardSlot.innerHTML = ''; computerCardSlot.innerHTML = ''; }

  async function setupGame() {
    const saved = await loadDeckPersistent();
    if (saved && Array.isArray(saved.faces) && saved.faces.length === NUM_CARDS) {
      customDeck = saved.faces;
      cardBackImage = saved.back || DEFAULT_BACK_PATH;
      uploadedCards = customDeck.slice();
      renderPreview();
    } else {
      customDeck = [];
      uploadedCards = [];
      const legacy = localStorage.getItem('customWarDeckBack');
      cardBackImage = legacy || DEFAULT_BACK_PATH;
    }

    playerDeck = createNewDeck(!!customDeck.length);
    playerDeck.shuffle();
    computerDeck = createNewDeck(false);
    computerDeck.shuffle();

    updateDeckCounts();
    clearCardSlots();
    renderDeckBacks();
    messageArea.textContent = "Click 'Play Hand' to start!";
    playerCurrentValue.textContent = '-'; computerCurrentValue.textContent = '-'; inWar = false;
    playButton.style.display = 'block'; playAgainButton.style.display = 'none'; playButton.disabled = false;
  }

  function checkGameOver() {
    if (playerDeck.size === 0) { messageArea.textContent = "Computer wins the game!"; endGame(); return true; }
    if (computerDeck.size === 0) { messageArea.textContent = "You win the game!"; endGame(); return true; }
    return false;
  }

  function endGame() { playButton.style.display = 'none'; playAgainButton.style.display = 'block'; }

  function playHand() {
    if (inWar) return; if (checkGameOver()) return; if (playerDeck.size === 0 || computerDeck.size === 0) { checkGameOver(); return; }
    const playerCard = playerDeck.draw(); const computerCard = computerDeck.draw();
    displayCard(playerCard, playerCardSlot, false); displayCard(computerCard, computerCardSlot, false);
    if (playerCard.value > computerCard.value) { messageArea.textContent = `Player wins the hand! ${playerCard.value} beats ${computerCard.value}.`; playerDeck.addCards([playerCard, computerCard]); }
    else if (computerCard.value > playerCard.value) { messageArea.textContent = `Computer wins the hand! ${computerCard.value} beats ${playerCard.value}.`; computerDeck.addCards([playerCard, computerCard]); }
    else { messageArea.textContent = `It's a tie at ${playerCard.value}! This is War!`; startWar([playerCard, computerCard]); }
    updateDeckCounts(); if (checkGameOver()) return; renderDeckBacks();
  }

  function startWar(warCards) {
    inWar = true; playButton.disabled = true;
    if (playerDeck.size < 4) { computerDeck.addCards(warCards.concat(playerDeck.drawMultiple(playerDeck.size))); checkGameOver(); return; }
    if (computerDeck.size < 4) { playerDeck.addCards(warCards.concat(computerDeck.drawMultiple(computerDeck.size))); checkGameOver(); return; }
    setTimeout(() => { messageArea.textContent = "Three cards down..."; setTimeout(() => {
      const playerStakes = playerDeck.drawMultiple(3); const computerStakes = computerDeck.drawMultiple(3);
      const playerWarCard = playerDeck.draw(); const computerWarCard = computerDeck.draw();
      const pot = [...warCards, ...playerStakes, ...computerStakes, playerWarCard, computerWarCard];
      displayCard(playerWarCard, playerCardSlot, false); displayCard(computerWarCard, computerCardSlot, false);
      if (playerWarCard.value > computerWarCard.value) { messageArea.textContent = `Player wins the War with a ${playerWarCard.value}!`; playerDeck.addCards(pot); }
      else if (computerWarCard.value > playerWarCard.value) { messageArea.textContent = `Computer wins the War with a ${computerWarCard.value}!`; computerDeck.addCards(pot); }
      else { messageArea.textContent = `Another tie at ${playerWarCard.value}! The War continues!`; startWar(pot); return; }
      updateDeckCounts(); if (checkGameOver()) return; inWar = false; playButton.disabled = false; renderDeckBacks();
    }, 900); }, 700);
  }

  // --- Deck builder / upload ---
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = e => resolve(e.target.result); r.onerror = reject; r.readAsDataURL(file); });
  }

  imageUploader.addEventListener('change', async (event) => {
    imagePreviewArea.innerHTML = ''; uploadedCards = []; selectedCardIndex = -1; metadataEditor.style.display = 'none';
    const files = event.target.files; if (!files) return; if (files.length !== NUM_CARDS) { alert(`Please select exactly ${NUM_CARDS} images.`); return; }
    try {
      const dataURLs = await Promise.all(Array.from(files).map(f => readFileAsDataURL(f)));
      // compress/resize each image before storing in memory to reduce footprint
      const resized = await Promise.all(dataURLs.map(d => resizeDataUrl(d)));
      uploadedCards = resized.map(url => ({ image: url, metadata: { uploader: '', artist: '', description: '' } }));
      renderPreview();
    } catch (err) { console.error('Error reading images', err); alert('Error reading images.'); }
  });

  backImageUploader.addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return; try { const data = await readFileAsDataURL(f); const resized = await resizeDataUrl(data); cardBackImage = resized; if (backPreview) backPreview.style.backgroundImage = `url(${resized})`; renderDeckBacks(); } catch (err) { console.error('Failed to read back image', err); }
  });

  function renderPreview() { imagePreviewArea.innerHTML = ''; uploadedCards.forEach((card, index) => { const container = document.createElement('div'); container.className = 'preview-image-container'; const img = document.createElement('img'); img.src = card.image; img.className = 'preview-image'; if (index === selectedCardIndex) img.classList.add('selected'); container.addEventListener('click', () => selectCardForEditing(index)); container.appendChild(img); imagePreviewArea.appendChild(container); }); }

  function selectCardForEditing(index) {
    if (selectedCardIndex > -1 && imagePreviewArea.children[selectedCardIndex]) { const prev = imagePreviewArea.children[selectedCardIndex].querySelector('.preview-image'); if (prev) prev.classList.remove('selected'); }
    if (imagePreviewArea.children[index]) { const curr = imagePreviewArea.children[index].querySelector('.preview-image'); if (curr) curr.classList.add('selected'); }
    selectedCardIndex = index; metadataEditor.style.display = 'flex';
    const card = uploadedCards[index]; uploaderNameInput.value = card.metadata.uploader || ''; artistNameInput.value = card.metadata.artist || ''; cardDescriptionInput.value = card.metadata.description || '';
    if (setAsBackButton) setAsBackButton.style.display = 'block';
  }

  function updateMetadata() { if (selectedCardIndex === -1) return; const card = uploadedCards[selectedCardIndex]; if (!card) return; card.metadata.uploader = uploaderNameInput.value; card.metadata.artist = artistNameInput.value; card.metadata.description = cardDescriptionInput.value; }
  [uploaderNameInput, artistNameInput, cardDescriptionInput].forEach(i => i.addEventListener('input', updateMetadata));
  if (setAsBackButton) setAsBackButton.addEventListener('click', () => { if (selectedCardIndex === -1) return; const card = uploadedCards[selectedCardIndex]; if (!card) return; cardBackImage = card.image; if (backPreview) backPreview.style.backgroundImage = `url(${cardBackImage})`; renderDeckBacks(); });

  saveDeckButton.addEventListener('click', async () => {
    if (uploadedCards.length !== NUM_CARDS) { alert(`You must upload exactly ${NUM_CARDS} images.`); return; }
    // Before saving, ensure images are reasonably sized - compress/resize again to be safe
    const faces = await Promise.all(uploadedCards.map(c => resizeDataUrl(c.image)));
    const back = cardBackImage ? (cardBackImage.startsWith('data:') ? await resizeDataUrl(cardBackImage) : cardBackImage) : null;
    const success = await saveDeckPersistent(faces.map((img, idx) => ({ image: img, metadata: uploadedCards[idx].metadata })), back);
    if (!success) { alert('Failed to save deck locally. Consider reducing image sizes.'); return; }
    alert('Custom deck saved successfully!'); modal.style.display = 'none'; setupGame();
  });

  customDeckButton.addEventListener('click', () => { modal.style.display = 'block'; });
  closeButton.addEventListener('click', () => { modal.style.display = 'none'; });
  window.addEventListener('click', (event) => { if (event.target == modal) modal.style.display = 'none'; });

  playButton.addEventListener('click', playHand); playAgainButton.addEventListener('click', setupGame);

  // Init
  setupGame();
})();
