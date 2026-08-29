const express = require('express');
const path = require('path');
const ytdlp = require('yt-dlp-exec');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/download', async (req, res) => {
    try {
        const videoURL = req.body.url;

        if (!videoURL) {
            return res.status(400).json({ error: 'Please provide a URL.' });
        }

        console.log(`Downloading from URL: ${videoURL}`);

        const ytDlpProcess = ytdlp.exec(videoURL, {
            output: '-',
            format: 'best[ext=mp4]/best',
            extractorArgs: 'youtube:player_client=android'
        }, {
            stdio: ['ignore', 'pipe', 'pipe']  // stderr have pipe kari lidhu, log mate
        });

        let headersSet = false;
        let errorOutput = '';

        ytDlpProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.error('yt-dlp stderr:', data.toString());
        });

        ytDlpProcess.stdout.once('data', (chunk) => {
            if (!headersSet) {
                res.header('Content-Disposition', 'attachment; filename="video.mp4"');
                res.header('Content-Type', 'video/mp4');
                headersSet = true;
            }
            res.write(chunk);
        });

        ytDlpProcess.stdout.on('data', (chunk) => {
            if (headersSet) res.write(chunk);
        });

        ytDlpProcess.stdout.on('end', () => {
            res.end();
        });

        ytDlpProcess.on('error', (err) => {
            console.error('Process Error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error occurred while downloading video.', details: err.message });
            }
        });

        ytDlpProcess.on('close', (code) => {
            if (code !== 0 && !headersSet) {
                console.error('yt-dlp exited with code', code, errorOutput);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Video download failed.', details: errorOutput.slice(0, 300) });
                }
            }
        });

    } catch (error) {
        console.error('Error:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error occurred while downloading video.', details: error.message });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});