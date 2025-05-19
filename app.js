// Import config
import config from './config.js';

// DOM Elements
const pdfUpload = document.getElementById('pdf-upload');
const fileInputLabel = document.querySelector('.file-input-label');
const fileInputText = document.querySelector('.file-input-text');
const processBtn = document.getElementById('process-btn');
const flashcardSection = document.querySelector('.flashcard-section');
const questionText = document.getElementById('question-text');
const answerText = document.getElementById('answer-text');
const showAnswerBtn = document.getElementById('show-answer');
const answerContainer = document.getElementById('answer-container');
const ratingButtons = document.querySelectorAll('.rating-btn');
const currentCardSpan = document.getElementById('current-card');
const totalCardsSpan = document.getElementById('total-cards');
const moreInfoBtn = document.getElementById('more-info-btn');
const aiToggle = document.getElementById('ai-toggle');
const listenAnswerBtn = document.getElementById('listen-answer');
const speechStatus = document.getElementById('speech-status');
const spokenAnswer = document.getElementById('spoken-answer');

// Global variables
let flashcards = [];
let currentCardIndex = 0;
let speechSynthesis = window.speechSynthesis;
let openaiApiKey = ''; // Will be set from environment

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Function to get API key from environment
async function getApiKey() {
    try {
        const response = await fetch('/.env');
        const text = await response.text();
        const match = text.match(/OPENAI_API_KEY=(.+)/);
        if (match) {
            openaiApiKey = match[1].trim();
            console.log('API key loaded successfully');
        } else {
            console.warn('API key not found in .env file');
        }
    } catch (error) {
        console.warn('Could not load .env file:', error);
    }
}

// Load API key when page loads
getApiKey();

// Event Listeners
processBtn.addEventListener('click', processPDF);
showAnswerBtn.addEventListener('click', showAnswer);
moreInfoBtn.addEventListener('click', explainFurther);
listenAnswerBtn.addEventListener('click', startListening);

// File input change event
pdfUpload.addEventListener('change', function(event) {
    if (this.files && this.files[0]) {
        fileInputText.querySelector('div').textContent = this.files[0].name;
    }
});

// Rating button event listeners
ratingButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove selected class from all buttons
        ratingButtons.forEach(btn => btn.classList.remove('selected'));
        // Add selected class to clicked button
        button.classList.add('selected');
        const rating = parseInt(button.dataset.rating);
        rateCard(rating);
    });
});

// Function to process the uploaded PDF
async function processPDF() {
    const file = pdfUpload.files[0];
    
    if (!file || file.type !== 'application/pdf') {
        alert('Please select a valid PDF file');
        return;
    }
    
    try {
        // Create a loading indicator
        const container = document.querySelector('.container');
        const loadingElement = document.createElement('div');
        loadingElement.className = 'loading-indicator';
        loadingElement.innerHTML = '<p>Extracting text from PDF... This may take a moment.</p>';
        container.prepend(loadingElement);
        
        // Read the PDF file
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        // Extract text from each page
        let extractedText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            extractedText += pageText + '\n\n';
            
            // Update loading indicator
            loadingElement.innerHTML = `<p>Processing page ${i} of ${pdf.numPages}...</p>`;
        }
        
        // Generate flashcards using AI if API key is available
        if (openaiApiKey) {
            loadingElement.innerHTML = '<p>Generating flashcards using AI...</p>';
            await generateFlashcardsWithAI(extractedText);
        } else {
            generateFlashcards(extractedText);
        }
        
        // Remove loading indicator
        loadingElement.remove();
        
        // Show the flashcard section
        flashcardSection.style.display = 'block';
        
        // Update the total cards count
        totalCardsSpan.textContent = flashcards.length;
        
        // Show the first card
        showCard(0);
        
    } catch (error) {
        console.error('Error processing PDF:', error);
        alert('Error processing PDF. Please try again.');
        document.querySelector('.loading-indicator')?.remove();
    }
}

// Function to generate flashcards using AI
async function generateFlashcardsWithAI(text) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant that creates educational flashcards from text. Create question-answer pairs that are clear, concise, and educational."
                    },
                    {
                        role: "user",
                        content: `Create flashcards from this text. For each flashcard, provide a question and answer pair. Format each flashcard as JSON with 'question' and 'answer' fields. Text: ${text}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            throw new Error('AI API request failed');
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        
        // Parse the AI response and create flashcards
        try {
            const parsedContent = JSON.parse(content);
            if (Array.isArray(parsedContent)) {
                flashcards = parsedContent;
            } else {
                // If the response is a single flashcard
                flashcards = [parsedContent];
            }
        } catch (parseError) {
            console.error('Error parsing AI response:', parseError);
            // Fallback to basic flashcard generation
            generateFlashcards(text);
        }
    } catch (error) {
        console.error('Error generating flashcards with AI:', error);
        // Fallback to basic flashcard generation
        generateFlashcards(text);
    }
}

// Function to generate flashcards from extracted text (fallback method)
function generateFlashcards(text) {
    // Split text into sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    flashcards = [];
    
    // Create flashcards from sentences
    for (let i = 0; i < sentences.length - 1; i += 2) {
        const question = sentences[i].trim();
        const answer = sentences[i + 1].trim();
        
        if (question.length > 10 && answer.length > 10) {
            flashcards.push({
                question: question,
                answer: answer,
                details: {
                    fullContext: `This information appears in the document and relates to "${question.substring(0, 50)}..."`
                }
            });
        }
    }
}

function showCard(index) {
    const card = flashcards[index];
    questionText.textContent = card.question;
    answerText.textContent = card.answer;
    
    // Hide the answer initially
    answerContainer.style.display = 'none';
    
    // Update current card number (1-based for display)
    currentCardSpan.textContent = index + 1;
}

function showAnswer() {
    answerContainer.style.display = 'block';
}

function rateCard(rating) {
    // Store rating in the flashcard object for later use
    flashcards[currentCardIndex].userRating = rating;
    console.log(`Card ${currentCardIndex + 1} rated: ${rating}`);
}

function showNextCard() {
    currentCardIndex = (currentCardIndex + 1) % flashcards.length;
    showCard(currentCardIndex);
}

function explainFurther() {
    const currentCard = flashcards[currentCardIndex];
    
    if (!currentCard.details) {
        alert("No additional information available for this card.");
        return;
    }
    
    // Check if an explanation modal already exists and remove it
    const existingModal = document.getElementById('explanation-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create a modal dialog
    const modalDiv = document.createElement('div');
    modalDiv.id = 'explanation-modal';
    modalDiv.className = 'modal';
    
    modalDiv.innerHTML = `
        <div class="modal-content">
            <span class="close-modal">&times;</span>
            <h3>Additional Context</h3>
            <div class="explanation-text">${currentCard.details.fullContext}</div>
        </div>
    `;
    
    document.body.appendChild(modalDiv);
    modalDiv.style.display = 'block';
    
    // Add event listener for closing the modal
    const closeBtn = document.querySelector('.close-modal');
    closeBtn.addEventListener('click', () => {
        modalDiv.style.display = 'none';
    });
    
    // Close modal when clicking outside it
    window.addEventListener('click', (event) => {
        if (event.target === modalDiv) {
            modalDiv.style.display = 'none';
        }
    });
}

// Initialize speech recognition
function setupSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        listenAnswerBtn.disabled = true;
        listenAnswerBtn.style.backgroundColor = '#ccc';
        speechStatus.textContent = 'Speech recognition not supported in this browser.';
        return;
    }
    
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = function() {
        speechStatus.textContent = 'Listening... speak now';
        listenAnswerBtn.classList.add('listening');
    };
    
    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        console.log('Speech recognition result:', transcript);
        
        if (event.results[0].isFinal) {
            speechStatus.textContent = 'Processing your answer...';
        }
    };
    
    recognition.onend = function() {
        speechStatus.textContent = 'Listening stopped';
        listenAnswerBtn.classList.remove('listening');
    };
    
    recognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        speechStatus.textContent = 'Error: ' + event.error;
        listenAnswerBtn.classList.remove('listening');
    };
    
    return recognition;
}

let recognition = setupSpeechRecognition();

function startListening() {
    if (recognition) {
        recognition.start();
    } else {
        speechStatus.textContent = 'Speech recognition not available';
    }
} 