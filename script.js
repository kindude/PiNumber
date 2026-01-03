/**
 * Pi Million Digit Fetcher
 * Fetches 1 million digits of Pi, 100 at a time
 */

const fs = require('fs');
const https = require('https');

class PiMillionFetcher {
    constructor() {
        this.targetDigits = 1000000;
        this.chunkSize = 100;
        this.currentPosition = 0;
        this.allDigits = '';
        this.retryCount = 0;
        this.maxRetries = 3;
        this.delayBetweenRequests = 100; // ms
        
        // Statistics
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            startTime: null,
            endTime: null
        };
    }

    /**
     * Fetch a chunk of Pi digits from the API
     */
    async fetchChunk(start, count) {
        return new Promise((resolve, reject) => {
            const url = `https://api.pi.delivery/v1/pi?start=${start}&numberOfDigits=${count}`;
            
            https.get(url, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.content) {
                            resolve(json.content);
                        } else {
                            reject(new Error('No content in response'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Fetch a chunk with retry logic
     */
    async fetchChunkWithRetry(start, count) {
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                this.stats.totalRequests++;
                const chunk = await this.fetchChunk(start, count);
                this.stats.successfulRequests++;
                return chunk;
            } catch (error) {
                this.stats.failedRequests++;
                
                if (attempt === this.maxRetries) {
                    console.error(`❌ Failed after ${this.maxRetries} retries at position ${start}`);
                    throw error;
                }
                
                // Wait before retry (exponential backoff)
                const waitTime = Math.pow(2, attempt) * 1000;
                console.log(`⚠️  Retry ${attempt + 1}/${this.maxRetries} in ${waitTime}ms...`);
                await this.sleep(waitTime);
            }
        }
    }

    /**
     * Sleep/delay function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Progress bar
     */
    showProgress(current, total) {
        const percentage = ((current / total) * 100).toFixed(2);
        const barLength = 50;
        const filledLength = Math.floor((current / total) * barLength);
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        
        const elapsed = Date.now() - this.stats.startTime;
        const rate = current / (elapsed / 1000); // digits per second
        const eta = ((total - current) / rate) / 60; // minutes
        
        process.stdout.write(`\r[${bar}] ${percentage}% | ${current.toLocaleString()}/${total.toLocaleString()} | ${rate.toFixed(0)} digits/sec | ETA: ${eta.toFixed(1)}min`);
    }

    /**
     * Main fetch function
     */
    async fetchAll() {
        console.log('🥧 Pi Million Digit Fetcher');
        console.log('='  .repeat(60));
        console.log(`Target: ${this.targetDigits.toLocaleString()} digits`);
        console.log(`Chunk size: ${this.chunkSize} digits`);
        console.log(`Total requests needed: ${Math.ceil(this.targetDigits / this.chunkSize)}`);
        console.log('='  .repeat(60));
        console.log('');
        
        this.stats.startTime = Date.now();
        
        try {
            while (this.currentPosition < this.targetDigits) {
                // Determine chunk size (last chunk might be smaller)
                const remainingDigits = this.targetDigits - this.currentPosition;
                const currentChunkSize = Math.min(this.chunkSize, remainingDigits);
                
                // Fetch chunk
                const chunk = await this.fetchChunkWithRetry(this.currentPosition, currentChunkSize);
                this.allDigits += chunk;
                
                // Update progress
                this.currentPosition += currentChunkSize;
                this.showProgress(this.currentPosition, this.targetDigits);
                
                // Delay between requests to be nice to the API
                if (this.currentPosition < this.targetDigits) {
                    await this.sleep(this.delayBetweenRequests);
                }
            }
            
            this.stats.endTime = Date.now();
            console.log('\n');
            this.showStats();
            this.saveToFile();
            this.analyzeDigits();
            
        } catch (error) {
            console.error('\n❌ Fatal error:', error.message);
            console.log('Partial data saved...');
            this.saveToFile('pi_partial.txt');
        }
    }

    /**
     * Show statistics
     */
    showStats() {
        const duration = (this.stats.endTime - this.stats.startTime) / 1000;
        const avgRate = this.targetDigits / duration;
        
        console.log('');
        console.log('='  .repeat(60));
        console.log('📊 Statistics:');
        console.log('='  .repeat(60));
        console.log(`✅ Total digits fetched: ${this.allDigits.length.toLocaleString()}`);
        console.log(`⏱️  Total time: ${duration.toFixed(2)} seconds (${(duration/60).toFixed(2)} minutes)`);
        console.log(`📡 Total requests: ${this.stats.totalRequests}`);
        console.log(`✅ Successful: ${this.stats.successfulRequests}`);
        console.log(`❌ Failed: ${this.stats.failedRequests}`);
        console.log(`⚡ Average rate: ${avgRate.toFixed(0)} digits/second`);
        console.log(`📦 File size: ${(this.allDigits.length / 1024).toFixed(2)} KB`);
        console.log('='  .repeat(60));
    }

    /**
     * Save digits to file
     */
    saveToFile(filename = 'pi_million.txt') {
        try {
            fs.writeFileSync(filename, this.allDigits);
            console.log(`💾 Saved to: ${filename}`);
        } catch (error) {
            console.error('❌ Error saving file:', error.message);
        }
    }

    /**
     * Analyze digit distribution
     */
    analyzeDigits() {
        console.log('');
        console.log('='  .repeat(60));
        console.log('🔢 Digit Frequency Analysis:');
        console.log('='  .repeat(60));
        
        const frequency = {};
        for (let i = 0; i < 10; i++) {
            frequency[i] = 0;
        }
        
        for (const digit of this.allDigits) {
            if (digit >= '0' && digit <= '9') {
                frequency[digit]++;
            }
        }
        
        for (let i = 0; i < 10; i++) {
            const count = frequency[i];
            const percentage = ((count / this.allDigits.length) * 100).toFixed(3);
            const bar = '█'.repeat(Math.floor(count / 2000));
            console.log(`${i}: ${bar} ${count.toLocaleString()} (${percentage}%)`);
        }
        console.log('='  .repeat(60));
    }

    /**
     * Find a sequence in Pi
     */
    findSequence(sequence) {
        const index = this.allDigits.indexOf(sequence);
        if (index !== -1) {
            return {
                found: true,
                position: index,
                context: this.allDigits.substring(Math.max(0, index - 10), index + sequence.length + 10)
            };
        }
        return { found: false };
    }
}

// ============================================
// Run the fetcher
// ============================================

async function main() {
    const fetcher = new PiMillionFetcher();
    
    // You can customize these:
    fetcher.targetDigits = 10000;      // Start with 10k for testing (change to 1000000 for full run)
    fetcher.chunkSize = 100;           // Fetch 100 at a time
    fetcher.delayBetweenRequests = 50; // 50ms delay between requests
    
    await fetcher.fetchAll();
    
    // Fun: Find your birthday in Pi!
    console.log('');
    console.log('🎂 Finding birthdays in Pi:');
    const birthday = '1990';
    const result = fetcher.findSequence(birthday);
    if (result.found) {
        console.log(`✅ Found "${birthday}" at position ${result.position}`);
        console.log(`   Context: ...${result.context}...`);
    } else {
        console.log(`❌ "${birthday}" not found in first ${fetcher.targetDigits} digits`);
    }
}

// Run it!
if (require.main === module) {
    main().catch(console.error);
}

module.exports = PiMillionFetcher;