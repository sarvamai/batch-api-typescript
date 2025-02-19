import axios from 'axios';
import fs from 'fs/promises';
import { DataLakeServiceClient, DataLakeDirectoryClient } from '@azure/storage-file-datalake';
import { URL } from 'url';
import mime from 'mime-types';
import winston from 'winston';
import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';

// Configure logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} - ${level} - ${message}`;
        })
    ),
    transports: [new winston.transports.Console()]
});

const API_SUBSCRIPTION_KEY = 'YOUR_API_KEY';
const LANGUAGE_CODE = 'hi-IN';

class SarvamClient {
    private serviceClient: BlobServiceClient;
    private containerName: string;
    private directoryPath: string;

    constructor(url: string) {
        const { accountUrl, containerName, directoryPath, sasToken } = this.extractUrlComponents(url);
        this.serviceClient = new BlobServiceClient(`${accountUrl}?${sasToken}`);
        this.containerName = containerName;
        this.directoryPath = directoryPath;
        logger.info(`Initialized SarvamClient with directory: ${this.directoryPath}`);
    }

    updateUrl(url: string): void {
        const { accountUrl, containerName, directoryPath, sasToken } = this.extractUrlComponents(url);
        this.serviceClient = new BlobServiceClient(`${accountUrl}?${sasToken}`);
        this.containerName = containerName;
        this.directoryPath = directoryPath;
        logger.info(`Updated URL to directory: ${this.directoryPath}`);
    }

    private extractUrlComponents(url: string): { accountUrl: string, containerName: string, directoryPath: string, sasToken: string } {
        const parsedUrl = new URL(url);
        const accountUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
        const pathParts = parsedUrl.pathname.split('/').filter(part => part);
        
        // First part is the container name
        const containerName = pathParts[0];
        
        // Rest is the directory path (if any)
        const directoryPath = pathParts.slice(1).join('/');
        
        const sasToken = parsedUrl.search.slice(1);
        return { accountUrl, containerName, directoryPath, sasToken };
    }

    async uploadFiles(localFilePaths: string[], overwrite: boolean = true): Promise<void> {
        logger.info(`Starting concurrent upload of ${localFilePaths.length} files`);
        // Create array of upload promises to execute concurrently
        const uploadPromises = localFilePaths.map(path => 
            this.uploadFile(path, path.split('/').pop()!, overwrite)
        );
        // Execute all uploads in parallel
        const results = await Promise.all(uploadPromises);
        const successCount = results.filter(result => result).length;
        logger.info(`Concurrent upload completed: ${successCount}/${localFilePaths.length} files uploaded successfully`);
    }

    private async uploadFile(localFilePath: string, fileName: string, overwrite: boolean): Promise<boolean> {
        try {
            const fileData = await fs.readFile(localFilePath);
            const mimeType = 'audio/wav';
            
            const containerClient = this.serviceClient.getContainerClient(this.containerName);
            // Include directory path in blob name if it exists
            const blobName = this.directoryPath ? `${this.directoryPath}/${fileName}` : fileName;
            const blobClient = containerClient.getBlockBlobClient(blobName);
            
            await blobClient.upload(fileData, fileData.length, {
                blobHTTPHeaders: {
                    blobContentType: mimeType
                }
            });

            console.log(`✅ File uploaded successfully: ${fileName}`);
            console.log(`   Type: ${mimeType}`);
            return true;
        } catch (error) {
            console.error(`❌ Upload failed for ${fileName}: ${error}`);
            return false;
        }
    }

    async listFiles(): Promise<string[]> {
        console.log('\n📂 Listing files in directory...');
        const fileNames: string[] = [];
        const containerClient = this.serviceClient.getContainerClient(this.containerName);
        
        // List blobs with prefix for the directory
        const options = this.directoryPath ? { prefix: `${this.directoryPath}/` } : undefined;
        const blobs = containerClient.listBlobsFlat(options);

        for await (const blob of blobs) {
            // Get just the filename without the directory path
            const fileName = blob.name.split('/').pop();
            if (fileName) {
                fileNames.push(fileName);
            }
        }

        console.log(`Found ${fileNames.length} files:`);
        fileNames.forEach(file => console.log(`   📄 ${file}`));
        return fileNames;
    }

    async downloadFiles(fileNames: string[], destinationDir: string): Promise<void> {
        console.log(`\n⬇️ Starting download of ${fileNames.length} files to ${destinationDir}`);
        const tasks = fileNames.map(fileName => this.downloadFile(fileName, destinationDir));
        const results = await Promise.all(tasks);
        console.log(`Download completed for ${results.filter(result => result).length} files`);
    }

    private async downloadFile(fileName: string, destinationDir: string): Promise<boolean> {
        try {
            const containerClient = this.serviceClient.getContainerClient(this.containerName);
            // Include directory path in blob name if it exists
            const blobName = this.directoryPath ? `${this.directoryPath}/${fileName}` : fileName;
            const blobClient = containerClient.getBlockBlobClient(blobName);
            const downloadPath = `${destinationDir}/${fileName}`;
            
            const downloadResponse = await blobClient.download(0);
            if (downloadResponse.readableStreamBody) {
                const chunks: Buffer[] = [];
                for await (const chunk of downloadResponse.readableStreamBody) {
                    chunks.push(Buffer.from(chunk));
                }
                await fs.writeFile(downloadPath, Buffer.concat(chunks));
                console.log(`✅ Downloaded: ${fileName} -> ${downloadPath}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Download failed for ${fileName}: ${error}`);
            return false;
        }
    }
}

async function initializeJob(): Promise<any> {
    console.log('\n🚀 Initializing job...');
    const url = 'https://api.sarvam.ai/speech-to-text/job/init';
    const headers = { 'API-Subscription-Key': API_SUBSCRIPTION_KEY };
    const response = await axios.post(url, {}, { headers });
    console.log('\nInitialize Job Response:');
    console.log(`Status Code: ${response.status}`);
    console.log('Response Body:');
    console.log(response.data);

    if (response.status === 202) {
        return response.data;
    }
    return null;
}

async function checkJobStatus(jobId: string): Promise<any> {
    console.log(`\n🔍 Checking status for job: ${jobId}`);
    const url = `https://api.sarvam.ai/speech-to-text/job/${jobId}/status`;
    const headers = { 'API-Subscription-Key': API_SUBSCRIPTION_KEY };
    const response = await axios.get(url, { headers });
    console.log('\nJob Status Response:');
    console.log(`Status Code: ${response.status}`);
    console.log('Response Body:');
    console.log(response.data);

    if (response.status === 200) {
        return response.data;
    }
    return null;
}

async function startJob(jobId: string, languageCode: string = LANGUAGE_CODE): Promise<any> {
    console.log(`\n▶️ Starting job: ${jobId}`);
    const url = 'https://api.sarvam.ai/speech-to-text/job';
    const headers = {
        'API-Subscription-Key': API_SUBSCRIPTION_KEY,
        'Content-Type': 'application/json'
    };
    const data = {
        job_id: jobId,
        job_parameters: {
            language_code: languageCode
        }
    };
    
    // Add more logging to see the exact request
    console.log('\nRequest Body:', JSON.stringify(data, null, 2));

    try {
        const response = await axios.post(url, data, { headers });
        console.log('\nStart Job Response:');
        console.log(`Status Code: ${response.status}`);
        console.log('Response Body:', JSON.stringify(response.data, null, 2));

        if (response.status === 200) {
            return response.data;
        }
    } catch (error: any) {
        // Add better error logging
        console.error('Error starting job:', error.response?.data || error.message);
        return null;
    }
    return null;
}

async function main(): Promise<void> {
    console.log('\n=== Starting Speech-to-Text Processing ===');

    // Step 1: Initialize the job
    const jobInfo = await initializeJob();
    if (!jobInfo) {
        console.log('❌ Job initialization failed');
        return;
    }

    const jobId = jobInfo.job_id;
    const inputStoragePath = jobInfo.input_storage_path;
    const outputStoragePath = jobInfo.output_storage_path;

    // Step 2: Upload files
    console.log(`\n📤 Uploading files to input storage: ${inputStoragePath}`);
    const client = new SarvamClient(inputStoragePath);
    const localFiles = ['/Users/vinayakgavariya/Downloads/misha_en.wav', '/Users/vinayakgavariya/Downloads/misha_en.wav'];
    console.log(`Files to upload: ${localFiles}`);
    await client.uploadFiles(localFiles);

    // Step 3: Start the job
    const jobStartResponse = await startJob(jobId);
    if (!jobStartResponse) {
        console.log('❌ Failed to start job');
        return;
    }

    // Step 4: Monitor job status
    console.log('\n⏳ Monitoring job status...');
    let attempt = 1;
    let finalStatus = '';
    
    while (true) {
        console.log(`\nStatus check attempt ${attempt}`);
        const jobStatus = await checkJobStatus(jobId);
        if (!jobStatus) {
            console.log('❌ Failed to get job status');
            break;
        }

        finalStatus = jobStatus.job_state;
        if (finalStatus === 'Completed') {
            console.log('✅ Job completed successfully!');
            break;
        } else if (finalStatus === 'Failed') {
            console.log('❌ Job failed!');
            break;
        } else {
            console.log(`⏳ Current status: ${finalStatus}`);
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
        attempt++;
    }

    // Step 5: Download results
    if (finalStatus === 'Completed') {
        console.log(`\n📥 Downloading results from: ${outputStoragePath}`);
        client.updateUrl(outputStoragePath);
        const files = await client.listFiles();
        await client.downloadFiles(files, 'data');
    }

    console.log('\n=== Processing Complete ===');
}

main().catch(error => {
    console.error('Error in main:', error);
});
