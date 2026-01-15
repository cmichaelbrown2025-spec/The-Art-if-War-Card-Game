(() => {
  // DOM Elements
  const playerDeckCount = document.getElementById('player-deck-count');
  const computerDeckCount = document.getElementById('computer-deck-count');
  const playButton = document.getElementById('play-button');
  const playAgainButton = document.getElementById('play-again-button');
  const customDeckButton = document.getElementById('custom-deck-button');
  const playerCardSlot = document.getElementById('player-card');
  const computerCardSlot = document.getElementById('computer-card');
  const messageArea = document.getElementById('message-area');
  const modal = document.getElementById('deck-builder-modal');
  const closeButton = document.querySelector('.close-button');
  const imageUploader = document.getElementById('image-uploader');
  const backImageUploader = document.getElementById('back-image-uploader');
  const backPreview = document.getElementById('back-preview');
  const imagePreviewArea = document.getElementById('image-preview-area');
  const saveDeckButton = document.getElementById('save-deck-button');
  const metadataEditor = document.getElementById('metadata-editor');
  const uploaderNameInput = document.getElementById('uploader-name');
  const artistNameInput = document.getElementById('artist-name');
  const cardDescriptionInput = document.getElementById('card-description');
  const setAsBackButton = document.getElementById('set-as-back-button');
  const playerCurrentValue = document.getElementById('player-current-value');
  const computerCurrentValue = document.getElementById('computer-current-value');

  // Accessibility
  if (messageArea && !messageArea.getAttribute('aria-live')) {
    messageArea.setAttribute('aria-live', 'polite');
  }

  // Game constants
  const NUM_CARDS = 25;

  // State
  let playerDeck, computerDeck;
  let inWar = false;
  let customDeck = [];
  let uploadedCards = [];
  let selectedCardIndex = -1;
  let cardBackImage = null; // data URL for uniform back

  // Card/Deck
  class Card {
    constructor(value, image, metadata = {}) {
      this.value = value;
      this.image = image;
      this.metadata = metadata;
    }
  }

  class Deck {
    constructor(cards = []) { this.cards = cards; }
    shuffle() {
      const arr = this.cards;
      for (let i = arr.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
    draw() { return this.cards.shift(); }
    drawMultiple(num) { return this.cards.splice(0, num); }
    addCards(cards) { this.cards.push(...cards); }
    get size() { return this.cards.length; }
  }

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

  // Create Decks
  function createNewDeck(isCustom = false) {
    const cards = [];
    if (isCustom && Array.isArray(customDeck) && customDeck.length) {
      customDeck.forEach((cardData, index) => {
        cards.push(new Card(index + 1, cardData.image, cardData.metadata || {}));
      });
    } else {
      for (let i = 1; i <= NUM_CARDS; i++) {
        cards.push(new Card(i, `default_image_${i}.jpg`));
      }
    }
    return new Deck(cards);
  }

  // Persistence (simple localStorage for UI changes; will migrate to IndexedDB later)
  function loadSavedDeck() {
    const raw = localStorage.getItem('customWarDeck_v2');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) { console.warn('Failed to parse saved deck', e); return null; }
  }

  function saveDeckToStorage(deckFaces, backImageDataUrl) {
    const payload = { faces: deckFaces, back: backImageDataUrl };
    try {
      localStorage.setItem('customWarDeck_v2', JSON.stringify(payload));
      return true;
    } catch (e) {
      console.warn('Failed to save deck to localStorage', e);
      return false;
    }
  }

  // Game setup
  function setupGame() {
    const saved = loadSavedDeck();
    if (saved && Array.isArray(saved.faces) && saved.faces.length === NUM_CARDS) {
      customDeck = saved.faces;
      cardBackImage = saved.back || null;
      uploadedCards = customDeck.slice();
      renderPreview();
    } else {
      customDeck = [];
      uploadedCards = [];
      // If there's a back in localStorage older key
      const legacy = localStorage.getItem('customWarDeckBack');
      if (legacy) cardBackImage = legacy;
    }

    playerDeck = createNewDeck(!!customDeck.length);
    playerDeck.shuffle();
    computerDeck = createNewDeck(false);
    computerDeck.shuffle();

    updateDeckCounts();
    clearCardSlots();
    renderDeckBacks();
    messageArea.textContent = "Click 'Play Hand' to start!";
    playerCurrentValue.textContent = '-';
    computerCurrentValue.textContent = '-';
    inWar = false;
    playButton.style.display = 'block';
    playAgainButton.style.display = 'none';
    playButton.disabled = false;
  }

  function updateDeckCounts() {
    playerDeckCount.textContent = playerDeck.size;
    computerDeckCount.textContent = computerDeck.size;
  }

  function clearCardSlots() {
    playerCardSlot.innerHTML = ''; 
    computerCardSlot.innerHTML = '';  
  }

  function renderDeckBacks() {
    const playerDeckEl = document.getElementById('player-deck');
    const computerDeckEl = document.getElementById('computer-deck');
    [playerDeckEl, computerDeckEl].forEach(el => {
      if (!el) return;
      el.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.className = 'card card-back';
      if (cardBackImage) {
        wrapper.style.backgroundImage = `url(${cardBackImage})`;
        wrapper.style.backgroundSize = 'cover';
        wrapper.style.backgroundPosition = 'center';
      }
      el.appendChild(wrapper);
    });
  }

  // Display logic: cards have an outer border and an inner art area; values shown in badge
  function displayCard(card, slot, isFaceDown = false) {
    slot.innerHTML = '';

    const outer = document.createElement('div');
    outer.className = 'card-outer';

    const art = document.createElement('div');
    art.className = 'card-art';

    if (isFaceDown) {
      if (cardBackImage) {
        art.style.backgroundImage = `url(${cardBackImage})`;
        art.style.backgroundSize = 'cover';
        art.style.backgroundPosition = 'center';
      } else {
        art.style.backgroundColor = '#888';
      }
      // value not shown when face down
    } else {
      if (card && card.image && typeof card.image === 'string') {
        art.style.backgroundImage = `url(${card.image})`;
        art.style.backgroundSize = 'cover';
        art.style.backgroundPosition = 'center';
      } else {
        art.style.backgroundColor = 'white';
      }
      // badge with value
      const badge = document.createElement('div');
      badge.className = 'card-badge';
      badge.textContent = card ? card.value : '';
      outer.appendChild(badge);

      // update sidebar values
      if (slot.id === 'player-card') playerCurrentValue.textContent = card ? card.value : '-';
      if (slot.id === 'computer-card') computerCurrentValue.textContent = card ? card.value : '-';
    }

    outer.appendChild(art);

    // optional metadata display
    if (card && card.metadata && card.metadata.artist) {
      const meta = document.createElement('div');
      meta.className = 'card-metadata';
      meta.textContent = `Art by: ${card.metadata.artist}`;
      outer.appendChild(meta);
    }

    slot.appendChild(outer);
  }

  // Gameplay
  function playHand() {
    if (inWar) return;
    if (checkGameOver()) return;
    if (playerDeck.size === 0 || computerDeck.size === 0) { checkGameOver(); return; }

    const playerCard = playerDeck.draw();
    const computerCard = computerDeck.draw();

    displayCard(playerCard, playerCardSlot, false);
    displayCard(computerCard, computerCardSlot, false);

    if (playerCard.value > computerCard.value) {
      messageArea.textContent = `Player wins the hand! ${playerCard.value} beats ${computerCard.value}.`;
      playerDeck.addCards([playerCard, computerCard]);
    } else if (computerCard.value > playerCard.value) {
      messageArea.textContent = `Computer wins the hand! ${computerCard.value} beats ${playerCard.value}.`;
      computerDeck.addCards([playerCard, computerCard]);
    } else {
      messageArea.textContent = `It's a tie at ${playerCard.value}! This is War!`;
      startWar([playerCard, computerCard]);
    }

    updateDeckCounts();
    if (checkGameOver()) return;

    // after hand, render deck backs to show remaining cards
    renderDeckBacks();
  }

  function startWar(warCards) {
    inWar = true;
    playButton.disabled = true;

    if (playerDeck.size < 4) {
      computerDeck.addCards(warCards.concat(playerDeck.drawMultiple(playerDeck.size)));
      checkGameOver(); return;
    }
    if (computerDeck.size < 4) {
      playerDeck.addCards(warCards.concat(computerDeck.drawMultiple(computerDeck.size)));
      checkGameOver(); return;
    }

    setTimeout(() => {
      messageArea.textContent = "Three cards down...";
      setTimeout(() => {
        const playerStakes = playerDeck.drawMultiple(3);
        const computerStakes = computerDeck.drawMultiple(3);
        const playerWarCard = playerDeck.draw();
        const computerWarCard = computerDeck.draw();
        const pot = [...warCards, ...playerStakes, ...computerStakes, playerWarCard, computerWarCard];

        displayCard(playerWarCard, playerCardSlot, false);
        displayCard(computerWarCard, computerCardSlot, false);

        if (playerWarCard.value > computerWarCard.value) {
          messageArea.textContent = `Player wins the War with a ${playerWarCard.value}!`;
          playerDeck.addCards(pot);
        } else if (computerWarCard.value > playerWarCard.value) {
          messageArea.textContent = `Computer wins the War with a ${computerWarCard.value}!`;
          computerDeck.addCards(pot);
        } else {
          messageArea.textContent = `Another tie at ${playerWarCard.value}! The War continues!`;
          startWar(pot); return;
        }

        updateDeckCounts();
        if (checkGameOver()) return;

        inWar = false;
        playButton.disabled = false;
        renderDeckBacks();
      }, 900);
    }, 700);
  }

  function checkGameOver() {
    if (playerDeck.size === 0) {
      messageArea.textContent = "Computer wins the game! Better luck next time.";
      endGame(); return true;
    } else if (computerDeck.size === 0) {
      messageArea.textContent = "Congratulations! You win the game!";
      endGame(); return true;
    }
    return false;
  }

  function endGame() {
    playButton.style.display = 'none';
    playAgainButton.style.display = 'block';
  }

  // Deck builder logic: read files in order, preserve selection without full rerender
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  imageUploader.addEventListener('change', async (event) => {
    imagePreviewArea.innerHTML = '';
    uploadedCards = [];
    selectedCardIndex = -1;
    metadataEditor.style.display = 'none';

    const files = event.target.files;
    if (!files) return;
    if (files.length !== NUM_CARDS) { alert(`Please select exactly ${NUM_CARDS} images.`); return; }

    try {
      const dataURLs = await Promise.all(Array.from(files).map(f => readFileAsDataURL(f)));
      uploadedCards = dataURLs.map(url => ({ image: url, metadata: { uploader: '', artist: '', description: '' } }));
      renderPreview();
    } catch (err) { console.error('Error reading images', err); alert('Error reading images.'); }
  });

  backImageUploader.addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const data = await readFileAsDataURL(f);
      cardBackImage = data;
      if (backPreview) backPreview.style.backgroundImage = `url(${data})`;
      renderDeckBacks();
    } catch (err) { console.error('Failed to read back image', err); }
  });

  function renderPreview() {
    imagePreviewArea.innerHTML = '';
    uploadedCards.forEach((card, index) => {
      const container = document.createElement('div');
      container.className = 'preview-image-container';
      const img = document.createElement('img');
      img.src = card.image;
      img.className = 'preview-image';
      if (index === selectedCardIndex) img.classList.add('selected');
      container.addEventListener('click', () => selectCardForEditing(index));
      container.appendChild(img);
      imagePreviewArea.appendChild(container);
    });
  }

  function selectCardForEditing(index) {
    if (selectedCardIndex > -1 && imagePreviewArea.children[selectedCardIndex]) {
      const prev = imagePreviewArea.children[selectedCardIndex].querySelector('.preview-image');
      if (prev) prev.classList.remove('selected');
    }
    if (imagePreviewArea.children[index]) {
      const curr = imagePreviewArea.children[index].querySelector('.preview-image');
      if (curr) curr.classList.add('selected');
    }
    selectedCardIndex = index;
    metadataEditor.style.display = 'flex';

    const card = uploadedCards[index];
    uploaderNameInput.value = card.metadata.uploader || '';
    artistNameInput.value = card.metadata.artist || '';
    cardDescriptionInput.value = card.metadata.description || '';

    // Show set-as-back button
    if (setAsBackButton) setAsBackButton.style.display = 'block';
  }

  function updateMetadata() {
    if (selectedCardIndex === -1) return;
    const card = uploadedCards[selectedCardIndex];
    if (!card) return;
    card.metadata.uploader = uploaderNameInput.value;
    card.metadata.artist = artistNameInput.value;
    card.metadata.description = cardDescriptionInput.value;
  }

  [uploaderNameInput, artistNameInput, cardDescriptionInput].forEach(i => i.addEventListener('input', updateMetadata));

  if (setAsBackButton) setAsBackButton.addEventListener('click', () => {
    if (selectedCardIndex === -1) return;
    const card = uploadedCards[selectedCardIndex];
    if (!card) return;
    cardBackImage = card.image; // use selected face as back
    if (backPreview) backPreview.style.backgroundImage = `url(${cardBackImage})`;
    renderDeckBacks();
  });

  saveDeckButton.addEventListener('click', () => {
    if (uploadedCards.length !== NUM_CARDS) { alert(`You must upload exactly ${NUM_CARDS} images.`); return; }
    const success = saveDeckToStorage(uploadedCards, cardBackImage);
    if (!success) { alert('Failed to save deck locally. Consider reducing image sizes.'); return; }
    alert('Custom deck saved successfully!');
    modal.style.display = 'none';
    setupGame();
  });

  customDeckButton.addEventListener('click', () => { modal.style.display = 'block'; });
  closeButton.addEventListener('click', () => { modal.style.display = 'none'; });
  window.addEventListener('click', (event) => { if (event.target == modal) modal.style.display = 'none'; });

  playButton.addEventListener('click', playHand);
  playAgainButton.addEventListener('click', setupGame);

  // Start
  setupGame();
})()