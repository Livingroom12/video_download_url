const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/download', (req, res) => {
    const videoURL = req.body.url;

    if (!videoURL) {
        return res.status(400).json({ error: 'Please provide a URL.' });
    }

    res.header('Content-Disposition', 'attachment; filename="video.mp4"');
    res.header('Content-Type', 'video/mp4');

    // 直接 system yt-dlp binary execute કરશે
    const ytDlpProcess = spawn('yt-dlp', [
        videoURL,
        '-o', '-',
        '-f', 'best',
        '--extractor-args', 'youtube:player_client=android'
    ]);

    ytDlpProcess.stdout.pipe(res);

    ytDlpProcess.stderr.on('data', (data) => {
        console.error(`yt-dlp log: ${data}`);
    });

    ytDlpProcess.on('error', (err) => {
        console.error('Process Error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Download failed', details: err.message });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});