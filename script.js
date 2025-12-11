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
const imagePreviewArea = document.getElementById('image-preview-area');
const saveDeckButton = document.getElementById('save-deck-button');
const metadataEditor = document.getElementById('metadata-editor');
const uploaderNameInput = document.getElementById('uploader-name');
const artistNameInput = document.getElementById('artist-name');
const cardDescriptionInput = document.getElementById('card-description');


// Game constants
const NUM_CARDS = 25;

// Game State
let playerDeck, computerDeck;
let inWar = false;
let customDeck = [];


// Card class
class Card {
    constructor(value, image, metadata = {}) {
        this.value = value;
        this.image = image;
        this.metadata = metadata;
    }
}

// Deck class
class Deck {
    constructor(cards = []) {
        this.cards = cards;
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const newIndex = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[newIndex]] = [this.cards[newIndex], this.cards[i]];
        }
    }

    draw() {
        return this.cards.shift();
    }

    drawMultiple(num) {
        return this.cards.splice(0, num);
    }

    addCards(cards) {
        this.cards.push(...cards);
    }

    get size() {
        return this.cards.length;
    }
}

// Deck Creation
function createNewDeck(isCustom = false) {
    const cards = [];
    if (isCustom) {
        customDeck.forEach((cardData, index) => {
            cards.push(new Card(index + 1, cardData.image, cardData.metadata));
        });
    } else {
        for (let i = 1; i <= NUM_CARDS; i++) {
            cards.push(new Card(i, `default_image_${i}.jpg`));
        }
    }
    return new Deck(cards);
}

// Game Logic
function setupGame() {
    const savedDeck = localStorage.getItem('customWarDeck');
    if (savedDeck) {
        customDeck = JSON.parse(savedDeck);
        playerDeck = createNewDeck(true);
    } else {
        playerDeck = createNewDeck(false);
    }
    playerDeck.shuffle();

    computerDeck = createNewDeck(false);
    computerDeck.shuffle();

    updateDeckCounts();
    clearCardSlots();
    messageArea.textContent = "Click 'Play Hand' to start!";
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

function playHand() {
    if (inWar) return;
    if (checkGameOver()) return;

    const playerCard = playerDeck.draw();
    const computerCard = computerDeck.draw();

    displayCard(playerCard, playerCardSlot);
    displayCard(computerCard, computerCardSlot);

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

            displayCard(playerWarCard, playerCardSlot);
            displayCard(computerWarCard, computerCardSlot);

            if (playerWarCard.value > computerWarCard.value) {
                messageArea.textContent = `Player wins the War with a ${playerWarCard.value}!`;
                playerDeck.addCards(pot);
            } else if (computerWarCard.value > computerWarCard.value) {
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
        }, 1000);
    }, 1000);
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

function displayCard(card, slot) {
    slot.innerHTML = '';
    const cardElement = document.createElement('div');
    cardElement.className = 'card';

    if (card.image.startsWith('data:image')) {
        cardElement.style.backgroundImage = `url(${card.image})`;
        cardElement.style.backgroundSize = 'cover';
        cardElement.style.backgroundPosition = 'center';
        cardElement.innerHTML = `<div class="card-value">${card.value}</div>`;
    } else {
        cardElement.innerHTML = `<div class="card-value">${card.value}</div>`;
    }

    // Simple metadata display - can be improved
    if (card.metadata && card.metadata.artist) {
        const metadataElement = document.createElement('div');
        metadataElement.className = 'card-metadata';
        metadataElement.textContent = `Art by: ${card.metadata.artist}`;
        cardElement.appendChild(metadataElement);
    }

    slot.appendChild(cardElement);
}

// Deck Builder Logic
let uploadedCards = [];
let selectedCardIndex = -1;

function openModal() { modal.style.display = 'block'; }
function closeModal() { modal.style.display = 'none'; }

customDeckButton.addEventListener('click', openModal);
closeButton.addEventListener('click', closeModal);
window.addEventListener('click', (event) => { if (event.target == modal) closeModal(); });

imageUploader.addEventListener('change', (event) => {
    imagePreviewArea.innerHTML = '';
    uploadedCards = [];
    const files = event.target.files;

    if (files.length !== NUM_CARDS) {
        alert(`Please select exactly ${NUM_CARDS} images.`);
        return;
    }

    for (const file of files) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const cardData = {
                image: e.target.result,
                metadata: { uploader: '', artist: '', description: '' }
            };
            uploadedCards.push(cardData);
            renderPreview();
        };
        reader.readAsDataURL(file);
    }
});

function renderPreview() {
    imagePreviewArea.innerHTML = '';
    uploadedCards.forEach((card, index) => {
        const container = document.createElement('div');
        container.className = 'preview-image-container';

        const img = document.createElement('img');
        img.src = card.image;
        img.className = 'preview-image';
        if (index === selectedCardIndex) {
            img.classList.add('selected');
        }

        img.addEventListener('click', () => selectCardForEditing(index));

        container.appendChild(img);
        imagePreviewArea.appendChild(container);
    });
}

function selectCardForEditing(index) {
    // ⚡ Bolt: Performance Optimization
    // The original code called `renderPreview()` here, which would delete and
    // re-create all 25 preview images every time a user clicked one.
    // This new implementation is more efficient because it only updates the
    // `selected` class on the relevant images, avoiding costly and unnecessary
    // DOM manipulation. This makes the UI feel much more responsive.

    // If a card was already selected, remove its 'selected' class.
    if (selectedCardIndex > -1 && imagePreviewArea.children[selectedCardIndex]) {
        imagePreviewArea.children[selectedCardIndex].querySelector('.preview-image').classList.remove('selected');
    }

    // Add the 'selected' class to the newly clicked card.
    if (imagePreviewArea.children[index]) {
        imagePreviewArea.children[index].querySelector('.preview-image').classList.add('selected');
    }

    selectedCardIndex = index;
    metadataEditor.style.display = 'flex';

    const card = uploadedCards[index];
    uploaderNameInput.value = card.metadata.uploader || '';
    artistNameInput.value = card.metadata.artist || '';
    cardDescriptionInput.value = card.metadata.description || '';
}

function updateMetadata() {
    if (selectedCardIndex === -1) return;
    const card = uploadedCards[selectedCardIndex];
    card.metadata.uploader = uploaderNameInput.value;
    card.metadata.artist = artistNameInput.value;
    card.metadata.description = cardDescriptionInput.value;
}

[uploaderNameInput, artistNameInput, cardDescriptionInput].forEach(input => {
    input.addEventListener('input', updateMetadata);
});

saveDeckButton.addEventListener('click', () => {
    if (uploadedCards.length !== NUM_CARDS) {
        alert(`You must upload exactly ${NUM_CARDS} images.`);
        return;
    }

    localStorage.setItem('customWarDeck', JSON.stringify(uploadedCards));
    alert('Custom deck saved successfully!');
    closeModal();
    setupGame();
});

// Event Listeners
playButton.addEventListener('click', playHand);
playAgainButton.addEventListener('click', setupGame);

// Start the game
setupGame();
