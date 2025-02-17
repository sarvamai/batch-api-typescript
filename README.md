# Sarvam AI Speech-to-Text Batch Processing

This TypeScript script allows you to process multiple audio files using Sarvam AI's Speech-to-Text API. It handles file upload, job monitoring, and result download.

## Prerequisites

1. **Node.js (v14 or later)** – Download from [nodejs.org](https://nodejs.org/)
2. **npm (Node Package Manager)** – Included with Node.js
3. **A Sarvam AI API key** – Obtain from [dashboard.sarvam.ai](https://dashboard.sarvam.ai)
4. **Audio files in WAV format**

## Setup

### 1. **Clone and Install Dependencies**
```bash
git clone <repository-url>
cd sarvam-batch-typescript
npm install
```

### 2. **Install Required Packages**
```bash
npm install axios fs winston @azure/storage-blob mime-types typescript @types/node @types/mime-types @types/winston
```

### 3. **Initialize TypeScript Configuration**
```bash
npx tsc --init
```


### 4. **Create Required Directories**
```bash
mkdir data
mkdir src
```
The `data` directory stores the downloaded transcription results, and `src` is for TypeScript source files.

### 5. **Create `index.ts` in the `src` Directory**
Create a new file named `index.ts` inside the `src` folder and paste your provided script.

## Configuration

### 1. **API Key Setup**
- Get your API key from [dashboard.sarvam.ai](https://dashboard.sarvam.ai)
- Replace the `API_SUBSCRIPTION_KEY` value in `index.ts`:
```typescript
const API_SUBSCRIPTION_KEY = 'your-api-key-here';
```

### 2. **Audio Files**
- Update the `localFiles` array in `main()` with your audio file paths:
```typescript
const localFiles = [
    '/path/to/your/first/audio.wav',
    '/path/to/your/second/audio.wav'
];
```



## 3. Running the Script

### 1. **Compile TypeScript**
```bash
npx tsc
```
This will generate a `index.js` file.

### 2. **Run the Script**
```bash
node index.js
```

## Process Flow

1. The script initializes a new job with Sarvam AI
2. Uploads specified audio files to Azure storage
3. Starts the transcription job
4. Monitors job status until completion
5. Downloads transcription results to the `data` directory

## Output

- Transcription results will be saved in the `data` directory.
- Each audio file will have a corresponding JSON file containing the transcription.
- The JSON files include:
  - Transcribed text
  - Confidence scores
  - Timing information

## Troubleshooting

### 1. **Authentication Errors**
- Verify your Sarvam AI API key is correct.
- Check if the API key has expired.

### 2. **File Upload Errors**
- Ensure audio files are in WAV format.
- Verify file paths are correct.
- Check file permissions.

### 3. **TypeScript Errors**
- Run `npx tsc` to check for compilation errors.
- Ensure all dependencies are properly installed.

## Important Notes

- Make sure your account is whitelisted to use the API.
- Only WAV/MP3 audio files are supported.
- Monitor the console output for detailed progress information.


