# PDF Flashcard Generator

A browser-based tool that converts PDF documents into interactive study flashcards. Using AI, the application analyzes PDF content and automatically generates question-answer pairs to help you study more effectively.

## Live Demo

Access the application here: [PDF Flashcard Generator](https://alyssakies.github.io/flashcards/)

## Features

- **PDF Text Extraction**: Upload any PDF and extract its text content
- **AI-Powered Flashcard Generation**: Intelligently creates flashcards from your PDF content
- **Interactive Study Interface**: Review flashcards with an intuitive interface
- **Confidence Rating System**: Rate your confidence to track learning progress
- **Additional Context**: Click "Explain Further" to see more detailed information
- **Works Offline**: No server required - all processing happens in your browser

## How to Use

1. **Upload a PDF**: Drag and drop or select your PDF document
2. **API Key (Optional)**: To use the AI-powered generation, provide your OpenAI API key
3. **Process PDF**: Click the button to generate flashcards
4. **Study**: Work through the generated flashcards
5. **Rate Your Understanding**: Rate your confidence with each card
6. **Get More Information**: Use the Explain Further button when needed

## OpenAI API Key

The AI flashcard generation requires an OpenAI API key. You have two options:

1. **Use Basic Extraction**: Toggle off AI-powered generation to use the app without an API key
2. **Use AI Generation**: Get an OpenAI API key from [OpenAI's platform](https://platform.openai.com/api-keys)

### Free Tier OpenAI API Keys

- New OpenAI accounts typically receive free credits ($5 worth)
- This allows processing several PDFs before needing to add payment information
- The app is designed to minimize token usage to reduce costs

### API Key Security

- Your API key is stored only in your browser's local storage
- The key is never sent to any server other than OpenAI's API
- No one else has access to your key

## Troubleshooting

### Common API Errors

- **Rate Limit (429)**: You've hit OpenAI's rate limits. This can happen if:
  - You're using a free tier API key with limited requests
  - Your account doesn't have billing set up
  - You've used up your monthly quota
  - Solution: Add payment information to your OpenAI account or wait until the quota resets

- **Authentication Error (401)**: Your API key is invalid or expired
  - Solution: Generate a new API key in your OpenAI account

## Privacy 

This application processes all PDFs entirely in your browser. Your documents are never uploaded to any server, ensuring complete privacy of your educational materials.

## Credits

- PDF.js for PDF text extraction
- OpenAI API for AI-powered flashcard generation 