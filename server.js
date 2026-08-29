const express = require('express');
const path = require('path');
const fs = require('fs');
const ytdlp = require('yt-dlp-exec');

const app = express();
const PORT = process.env.PORT || 3000;

const COOKIES_PATH = '/etc/secrets/cookies.txt';

function checkCookiesFile() {
    if (fs.existsSync(COOKIES_PATH)) {
        const stats = fs.statSync(COOKIES_PATH);
        const content = fs.readFileSync(COOKIES_PATH, 'utf8');
        const firstLine = content.split('\n')[0];
        console.log(`[cookies] File found. Size: ${stats.size} bytes`);
        console.log(`[cookies] First line: ${firstLine}`);
        console.log(`[cookies] Looks like Netscape format: ${firstLine.includes('Netscape') || firstLine.startsWith('#')}`);
        return true;
    } else {
        console.log(`[cookies] File NOT found at ${COOKIES_PATH}`);
        return false;
    }
}

// Check at startup
checkCookiesFile();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/download', async (req, res) => {
    const videoURL = req.body.url;

    if (!videoURL) {
        return res.status(400).json({ error: 'Please provide a URL.' });
    }

    console.log(`Downloading from URL: ${videoURL}`);
    const cookiesExist = checkCookiesFile();

    const ytdlpOptions = {
        output: '-',
        format: 'best[ext=mp4]/best',
        noPlaylist: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: [
            'referer:youtube.com',
            'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        ],
        'extractor-args': 'youtube:player_client=android,web',
        'ffmpeg-location': '/usr/bin/ffmpeg'
    };

    if (cookiesExist) {
        ytdlpOptions.cookies = COOKIES_PATH;
    }

    try {
        const ytDlpProcess = ytdlp.exec(videoURL, ytdlpOptions, {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let headersSet = false;
        let errorOutput = '';
        let receivedData = false;

        // Collect stderr for debugging
        ytDlpProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            errorOutput += msg;
            console.error('yt-dlp stderr:', msg);
        });

        // Only set headers once we actually start receiving video data
        ytDlpProcess.stdout.on('data', (chunk) => {
            receivedData = true;
            if (!headersSet) {
                res.header('Content-Disposition', 'attachment; filename="video.mp4"');
                res.header('Content-Type', 'video/mp4');
                headersSet = true;
            }
            res.write(chunk);
        });

        ytDlpProcess.stdout.on('end', () => {
            if (headersSet) {
                res.end();
            }
        });

        ytDlpProcess.on('error', (err) => {
            console.error('Process spawn error:', err);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Failed to start download process.',
                    details: err.message
                });
            }
        });

        ytDlpProcess.on('close', (code) => {
            console.log(`yt-dlp process exited with code ${code}`);
            if (code !== 0 && !headersSet) {
                console.error('Full error output:', errorOutput);
                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'Video download failed. The video may be unavailable, private, or blocked.',
                        details: errorOutput.slice(0, 500)
                    });
                }
            } else if (!receivedData && !res.headersSent) {
                res.status(500).json({
                    error: 'No video data received.',
                    details: errorOutput.slice(0, 500)
                });
            }
        });

    } catch (error) {
        console.error('Unexpected error:', error.message);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Error occurred while downloading video.',
                details: error.message
            });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});