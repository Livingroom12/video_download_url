const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/download', (req, res) => {
    const videoURL = req.query.url;

    if (!videoURL) {
        return res.status(400).send('Please provide a URL.');
    }

    // વિડીયો ફાઈલનું નામ સેટ કરો
    res.header('Content-Disposition', 'attachment; filename="video.mp4"');
    res.header('Content-Type', 'video/mp4');

    // Single pre-merged progressive format વાપરો જે સીધું સ્ટીમિંગ સપોર્ટ કરે
    const ytDlpProcess = spawn('yt-dlp', [
        videoURL,
        '-o', '-',
        '-f', 'b[ext=mp4]/best[ext=mp4]/b/best',
        '--no-playlist'
    ]);

    ytDlpProcess.stdout.pipe(res);

    ytDlpProcess.stderr.on('data', (data) => {
        console.error(`yt-dlp log: ${data.toString()}`);
    });

    ytDlpProcess.on('error', (err) => {
        console.error('Process Fail:', err);
        if (!res.headersSent) {
            res.status(500).send('Download failed');
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});