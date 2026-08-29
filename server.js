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

        res.header('Content-Disposition', 'attachment; filename="video.mp4"');
        res.header('Content-Type', 'video/mp4');

        const ytDlpProcess = ytdlp.exec(videoURL, {
            output: '-',
            format: 'best',
            extractorArgs: 'youtube:player_client=android'
        }, {
            stdio: ['ignore', 'pipe', 'ignore']
        });

        ytDlpProcess.stdout.pipe(res);

        ytDlpProcess.on('error', (err) => {
            console.error('Process Error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error occurred while downloading video.', details: err.message });
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