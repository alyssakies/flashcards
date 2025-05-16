// PDF Flashcard Application

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
const apiKeyBtn = document.getElementById('api-key-btn');
const apiKeyStatus = document.querySelector('.api-key-status');

// Global variables
let flashcards = [];
let currentCardIndex = 0;
let speechSynthesis = window.speechSynthesis;
let useAI = true; // Toggle for AI-powered extraction

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// API Key Management - In production, use server-side API key handling
const OPENAI_API_KEY_STORAGE_KEY = 'flashcards_openai_api_key';
let openaiApiKey = localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) || '';

// Update UI based on API key status
function updateApiKeyStatus() {
    if (openaiApiKey) {
        apiKeyStatus.textContent = "API Key Set";
        apiKeyStatus.style.color = "var(--success)";
    } else {
        apiKeyStatus.textContent = "Not Set";
        apiKeyStatus.style.color = "var(--gray-600)";
    }
}

// Initialize UI
updateApiKeyStatus();

// Event Listeners
processBtn.addEventListener('click', processPDF);
showAnswerBtn.addEventListener('click', showAnswer);
moreInfoBtn.addEventListener('click', explainFurther);

// AI toggle event listener
aiToggle.addEventListener('change', function() {
    useAI = this.checked;
});

// API Key button event listener
apiKeyBtn.addEventListener('click', function() {
    const newKey = prompt('Enter your OpenAI API key for AI-powered flashcard generation:', openaiApiKey);
    
    // Only update if user provided a value (not cancelled)
    if (newKey !== null) {
        openaiApiKey = newKey.trim();
        localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, openaiApiKey);
        updateApiKeyStatus();
    }
});

// File input change event
pdfUpload.addEventListener('change', function() {
    if (this.files && this.files[0]) {
        fileInputText.textContent = this.files[0].name;
    }
});

// Drag and drop events
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    fileInputLabel.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

['dragenter', 'dragover'].forEach(eventName => {
    fileInputLabel.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    fileInputLabel.addEventListener(eventName, unhighlight, false);
});

fileInputLabel.addEventListener('drop', handleDrop, false);

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight() {
    fileInputLabel.classList.add('highlight');
}

function unhighlight() {
    fileInputLabel.classList.remove('highlight');
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files && files.length) {
        pdfUpload.files = files;
        fileInputText.textContent = files[0].name;
    }
}

// Rating button event listeners
ratingButtons.forEach(button => {
    button.addEventListener('click', () => {
        const rating = parseInt(button.dataset.rating);
        rateCard(rating);
        showNextCard();
    });
});

// Function to process the uploaded PDF
async function processPDF() {
    const file = pdfUpload.files[0];
    
    if (!file || file.type !== 'application/pdf') {
        alert('Please select a valid PDF file');
        return;
    }
    
    // Check if AI extraction is enabled and we need to get an API key
    if (useAI && !openaiApiKey) {
        const shouldGetApiKey = confirm('AI-powered flashcard generation requires an OpenAI API key. Would you like to enter one now?');
        
        if (shouldGetApiKey) {
            openaiApiKey = prompt('Enter your OpenAI API key:');
            if (openaiApiKey) {
                localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, openaiApiKey);
                updateApiKeyStatus();
            } else {
                // User cancelled, fall back to basic extraction
                useAI = false;
                aiToggle.checked = false;
            }
        } else {
            // User declined to enter API key, fall back to basic extraction
            useAI = false;
            aiToggle.checked = false;
        }
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
        
        // Extract text from each page with improved extraction
        let extractedText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            
            // Get text content with better layout
            const textContent = await page.getTextContent({ normalizeWhitespace: true });
            
            // Process text items maintaining their relative positions
            let lastY;
            let text = '';
            
            for (const item of textContent.items) {
                if (lastY == item.transform[5] || !lastY) {
                    text += item.str;
                } else {
                    text += '\n' + item.str;
                }
                lastY = item.transform[5];
            }
            
            extractedText += text + '\n\n';
            
            // Update loading indicator
            loadingElement.innerHTML = `<p>Processing page ${i} of ${pdf.numPages}...</p>`;
        }
        
        // Update loading message for AI processing
        if (useAI && openaiApiKey) {
            loadingElement.innerHTML = '<p>Using AI to generate high-quality flashcards...</p>';
        } else {
            loadingElement.innerHTML = '<p>Generating flashcards from extracted text...</p>';
        }
        
        // Generate flashcards from the extracted text
        if (useAI && openaiApiKey) {
            await generateAIFlashcards(extractedText);
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

// Generate flashcards using AI
async function generateAIFlashcards(text) {
    try {
        // Limit text size to avoid token limits
        const maxLength = 10000;
        const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + "... (content truncated)" : text;
        
        // Prepare the API request
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert at creating educational flashcards. Generate a set of question-answer pairs from the provided text. Focus on key concepts, definitions, important facts, and relationships between ideas. Create clear questions with comprehensive answers.'
                    },
                    {
                        role: 'user',
                        content: `Create flashcards from the following text. Format your response as JSON in the following format EXACTLY:
                        [
                            {
                                "question": "Question text goes here?",
                                "answer": "Answer text goes here.",
                                "details": "Additional context or explanation goes here."
                            }
                        ]
                        
                        Here's the text to analyze:
                        ${truncatedText}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
            })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Parse the response to extract flashcards
        try {
            const responseText = data.choices[0].message.content;
            // Find the JSON array in the response
            const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
            
            if (jsonMatch) {
                const extractedJson = jsonMatch[0];
                flashcards = JSON.parse(extractedJson);
                
                // Ensure all cards have a details field
                flashcards = flashcards.map(card => {
                    if (!card.details) {
                        card.details = { fullContext: "Additional information not provided." };
                    } else if (typeof card.details === 'string') {
                        card.details = { fullContext: card.details };
                    }
                    return card;
                });
            } else {
                throw new Error("Couldn't parse AI response");
            }
        } catch (parseError) {
            console.error("Error parsing AI response:", parseError);
            // Fallback to traditional extraction
            generateFlashcards(text);
        }
        
    } catch (error) {
        console.error("AI Flashcard Generation Error:", error);
        alert(`Error using AI to generate flashcards: ${error.message}. Falling back to basic extraction.`);
        // Fallback to traditional extraction
        generateFlashcards(text);
    }
}

// Function to generate flashcards from extracted text
function generateFlashcards(text) {
    // Normalize whitespace and clean up the text
    text = text.replace(/\s+/g, ' ').trim();
    
    // Split text into sentences
    const sentences = splitIntoSentences(text);
    
    if (sentences.length === 0) {
        alert('Could not extract meaningful text from this PDF. Please try another file.');
        return;
    }
    
    flashcards = [];
    
    // First attempt: Find question-answer pairs
    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        
        // Check if this sentence ends with a question mark
        if (sentence.trim().endsWith('?') && i < sentences.length - 1) {
            // The sentence after the question is potentially an answer
            const question = sentence.trim();
            let answer = '';
            
            // Combine the next 1-2 sentences as the answer
            const answerLength = Math.min(2, sentences.length - i - 1);
            for (let j = 0; j < answerLength; j++) {
                answer += sentences[i + 1 + j] + ' ';
            }
            
            flashcards.push({
                question: question,
                answer: answer.trim(),
                details: generateDetails(question, answer, text)
            });
            
            // Skip processed sentences
            i += answerLength;
        }
    }
    
    // If we didn't find enough question-answer pairs, create more flashcards using key sentences
    if (flashcards.length < 50) {
        // Find sentences with important keywords
        const keywordSentences = findKeywordSentences(sentences);
        
        for (let i = 0; i < keywordSentences.length && flashcards.length < 150; i++) {
            const sentence = keywordSentences[i];
            
            // Convert the statement to a question
            const question = convertToQuestion(sentence);
            
            // Original sentence is the answer
            flashcards.push({
                question: question,
                answer: sentence,
                details: generateDetails(question, sentence, text)
            });
        }
    }
    
    // If still not enough flashcards, create definition-style flashcards
    if (flashcards.length < 50) {
        const definitions = findDefinitions(sentences);
        
        for (const [term, definition] of Object.entries(definitions)) {
            flashcards.push({
                question: `What is ${term}?`,
                answer: definition,
                details: `${term} is a key concept in this document.`
            });
        }
    }
    
    // Deduplicate flashcards
    flashcards = deduplicateFlashcards(flashcards);
    
    // If we have too many flashcards, keep only the most relevant ones
    if (flashcards.length > 200) {
        flashcards = flashcards.slice(0, 200);
    }
    
    // If we still have no flashcards, create some based on text chunks
    if (flashcards.length === 0) {
        const chunks = chunkText(text, 150);
        
        for (let i = 0; i < Math.min(100, chunks.length); i++) {
            const chunk = chunks[i];
            const question = `What does the text say about: "${chunk.substring(0, 50)}..."?`;
            
            flashcards.push({
                question: question,
                answer: chunk,
                details: "This information appears in the document."
            });
        }
    }
}

// Helper function to split text into sentences
function splitIntoSentences(text) {
    // First, normalize newlines and other whitespace
    text = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Split by sentence terminators with better heuristics
    const sentenceRegex = /([^.!?;]+[.!?;]+)(?=\s|$)/g;
    let sentences = [];
    let match;
    
    while ((match = sentenceRegex.exec(text)) !== null) {
        let sentence = match[1].trim();
        if (sentence.length > 15 && !/^\d+\./.test(sentence)) {
            sentences.push(sentence);
        }
    }
    
    // If the regex didn't work well (e.g., with technical documents), fall back to simpler approach
    if (sentences.length < 10 && text.length > 1000) {
        sentences = text.split(/[.!?;]\s+/)
            .filter(s => s.trim().length > 15)
            .map(s => s.trim() + '.');
    }
    
    return sentences.filter(sentence => 
        countWords(sentence) >= 4 && // Only sentences with at least 4 words
        !/^[0-9.]+$/.test(sentence) && // Filter out numeric elements
        sentence.length < 500 // Avoid extremely long sentences that are probably parsing errors
    );
}

// Count words in a string
function countWords(str) {
    return str.split(/\s+/).filter(s => s.length > 0).length;
}

// Function to find sentences containing educational keywords
function findKeywordSentences(sentences) {
    const educationalKeywords = [
        'important', 'significant', 'key', 'fundamental', 'critical', 'essential', 'primary',
        'defines', 'defined as', 'means', 'refers to', 'consists of', 'composed of', 'comprises',
        'therefore', 'thus', 'hence', 'consequently', 'as a result', 'due to', 'because',
        'example', 'instance', 'illustrated by', 'demonstrated by', 'shown by', 'evidenced by',
        'first', 'second', 'third', 'fourth', 'finally', 'lastly', 'conclusion', 'summary',
        'compare', 'contrast', 'difference', 'similarity', 'likewise', 'unlike', 'whereas',
        'theory', 'concept', 'principle', 'law', 'process', 'procedure', 'method', 'technique',
        'function', 'role', 'purpose', 'goal', 'objective', 'aim', 'target', 'intention',
        'analysis', 'evaluation', 'assessment', 'examination', 'investigation', 'study',
        'cause', 'effect', 'impact', 'influence', 'result', 'outcome', 'consequence'
    ];
    
    // Score each sentence
    const scoredSentences = sentences.map(sentence => {
        let score = 0;
        const lowerSentence = sentence.toLowerCase();
        
        educationalKeywords.forEach(keyword => {
            if (lowerSentence.includes(keyword.toLowerCase())) {
                score += 1;
            }
        });
        
        // Bonus for sentences of reasonable length
        if (sentence.length > 40 && sentence.length < 300) {
            score += 1;
        }
        
        // Bonus for sentences that contain actual information (more capital letters typically indicate names, terms)
        const capitalLetterCount = (sentence.match(/[A-Z]/g) || []).length;
        if (capitalLetterCount > 3) {
            score += 1;
        }
        
        return { sentence, score };
    });
    
    // Sort by score descending
    scoredSentences.sort((a, b) => b.score - a.score);
    
    // Return just the sentences
    return scoredSentences.map(item => item.sentence);
}

// Function to convert a statement to a question
function convertToQuestion(statement) {
    // Clean and normalize the statement
    statement = statement.trim();
    if (statement.endsWith('.')) {
        statement = statement.substring(0, statement.length - 1);
    }
    
    // Very simple implementation - extract key component and make a question
    const words = statement.split(' ');
    
    if (words.length <= 5) {
        return `What is meant by "${statement}"?`;
    }
    
    // Look for common patterns
    if (statement.toLowerCase().includes(' is ')) {
        const parts = statement.split(' is ');
        if (parts[0].split(' ').length <= 5) {
            return `What is ${parts[0]}?`;
        }
    }
    
    if (statement.toLowerCase().includes(' are ')) {
        const parts = statement.split(' are ');
        if (parts[0].split(' ').length <= 5) {
            return `What are ${parts[0]}?`;
        }
    }
    
    // Default approach - turn the statement into a "why/what/how" question
    const lastPart = words.slice(Math.max(0, words.length - 5)).join(' ');
    return `What can you tell me about "${lastPart}"?`;
}

// Function to find potential definitions
function findDefinitions(sentences) {
    const definitions = {};
    
    sentences.forEach(sentence => {
        const lowerSentence = sentence.toLowerCase();
        
        // Look for definition patterns
        if (lowerSentence.includes(' is defined as ') || 
            lowerSentence.includes(' refers to ') || 
            lowerSentence.includes(' is a ') || 
            lowerSentence.includes(' means ')) {
            
            let pattern, parts;
            
            if (lowerSentence.includes(' is defined as ')) {
                parts = sentence.split(' is defined as ');
                if (parts[0].split(' ').length <= 5 && parts[1].length > 15) {
                    definitions[parts[0].trim()] = parts[1].trim();
                }
            } else if (lowerSentence.includes(' refers to ')) {
                parts = sentence.split(' refers to ');
                if (parts[0].split(' ').length <= 5 && parts[1].length > 15) {
                    definitions[parts[0].trim()] = parts[1].trim();
                }
            } else if (lowerSentence.includes(' means ')) {
                parts = sentence.split(' means ');
                if (parts[0].split(' ').length <= 5 && parts[1].length > 15) {
                    definitions[parts[0].trim()] = parts[1].trim();
                }
            } else if (lowerSentence.includes(' is a ')) {
                parts = sentence.split(' is a ');
                if (parts[0].split(' ').length <= 3 && parts[1].length > 15) {
                    definitions[parts[0].trim()] = 'A ' + parts[1].trim();
                }
            }
        }
    });
    
    return definitions;
}

// Generate additional details or context for a flashcard
function generateDetails(question, answer, fullText) {
    // Find the context around the answer in the full text
    // First clean up the answer to make matching more likely
    const cleanAnswer = answer.replace(/\s+/g, ' ').trim();
    
    // Try to find the answer text in the full document
    const answerIndex = fullText.indexOf(cleanAnswer);
    
    if (answerIndex !== -1) {
        // Get some surrounding context - but make sure we don't cut words in the middle
        const start = Math.max(0, answerIndex - 200);
        // Find the start of a word if we're in the middle of one
        let contextStart = start;
        if (start > 0 && /[a-zA-Z0-9]/.test(fullText[start-1])) {
            // Move back until we find a word boundary
            let i = start;
            while (i > 0 && /[a-zA-Z0-9]/.test(fullText[i-1])) {
                i--;
            }
            contextStart = i;
        }
        
        // Get end index and make sure we don't cut words
        const end = Math.min(fullText.length, answerIndex + cleanAnswer.length + 200);
        let contextEnd = end;
        if (end < fullText.length && /[a-zA-Z0-9]/.test(fullText[end])) {
            // Move forward until we find a word boundary
            let i = end;
            while (i < fullText.length && /[a-zA-Z0-9]/.test(fullText[i])) {
                i++;
            }
            contextEnd = i;
        }
        
        // Extract and clean up the context
        let context = fullText.substring(contextStart, contextEnd);
        
        // Format for better readability
        context = context.replace(/\s+/g, ' ').trim();
        
        // Highlight the answer portion within the context
        const answerPosInContext = context.indexOf(cleanAnswer);
        if (answerPosInContext !== -1) {
            const beforeAnswer = context.substring(0, answerPosInContext);
            const afterAnswer = context.substring(answerPosInContext + cleanAnswer.length);
            return {
                before: beforeAnswer,
                answer: cleanAnswer,
                after: afterAnswer,
                fullContext: context
            };
        }
        
        return { fullContext: context };
    }
    
    // If we can't find the answer in the text, generate a generic response
    return { 
        fullContext: `This information appears in the document and relates to "${question.substring(0, 50)}..."`
    };
}

// Deduplicate flashcards to avoid repetition
function deduplicateFlashcards(cards) {
    const uniqueCards = [];
    const seenQuestions = new Set();
    
    cards.forEach(card => {
        const questionLower = card.question.toLowerCase();
        
        // Skip if we've seen a very similar question
        for (const seenQ of seenQuestions) {
            const similarity = calculateSimilarity(questionLower, seenQ);
            if (similarity > 0.6) { // Threshold for considering questions similar
                return;
            }
        }
        
        seenQuestions.add(questionLower);
        uniqueCards.push(card);
    });
    
    return uniqueCards;
}

// Calculate similarity between two strings (simple version)
function calculateSimilarity(str1, str2) {
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    
    // Count words in common
    let commonWords = 0;
    for (const word of words1) {
        if (words2.includes(word) && word.length > 3) { // Only consider meaningful words
            commonWords++;
        }
    }
    
    // Calculate similarity
    return commonWords / Math.max(words1.length, words2.length);
}

// Split text into chunks of approximately the given length
function chunkText(text, chunkSize) {
    const words = text.split(/\s+/);
    const chunks = [];
    
    let currentChunk = [];
    let currentLength = 0;
    
    for (const word of words) {
        currentChunk.push(word);
        currentLength += word.length + 1; // +1 for the space
        
        if (currentLength >= chunkSize) {
            chunks.push(currentChunk.join(' '));
            currentChunk = [];
            currentLength = 0;
        }
    }
    
    // Add the last chunk if there is one
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
    }
    
    return chunks;
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

function speakText(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
    } else {
        alert('Text-to-speech is not supported in your browser');
    }
}

function rateCard(rating) {
    // Store rating in the flashcard object for later use
    flashcards[currentCardIndex].userRating = rating;
    console.log(`Card ${currentCardIndex + 1} rated: ${rating}`);
    
    // In a more advanced version, we'd adjust the review schedule based on the rating
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
    
    // Create a modal dialog instead of using alert
    const modalDiv = document.createElement('div');
    modalDiv.id = 'explanation-modal';
    modalDiv.className = 'modal';
    
    let modalContent = '';
    
    if (typeof currentCard.details === 'string') {
        // For backward compatibility with older format
        modalContent = `
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <h3>Additional Context</h3>
                <div class="explanation-text">${currentCard.details}</div>
            </div>
        `;
    } else {
        // For new detailed format
        let highlightedContext = '';
        
        if (currentCard.details.before && currentCard.details.answer && currentCard.details.after) {
            highlightedContext = `
                <div class="context-before">${currentCard.details.before}</div>
                <div class="context-answer">${currentCard.details.answer}</div>
                <div class="context-after">${currentCard.details.after}</div>
            `;
        } else {
            highlightedContext = `<div class="full-context">${currentCard.details.fullContext}</div>`;
        }
        
        modalContent = `
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <h3>Additional Context</h3>
                <div class="explanation-text">${highlightedContext}</div>
            </div>
        `;
    }
    
    modalDiv.innerHTML = modalContent;
    document.body.appendChild(modalDiv);
    
    // Show the modal
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



