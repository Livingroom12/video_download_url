const express = require('express');
const path = require('path');
const ytdlp = require('yt-dlp-exec');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/download', (req, res) => {
    const videoURL = req.body.url;
    const reqId = Date.now().toString(36); // har request nu unique id

    const log = (...args) => console.log(`[${new Date().toISOString()}] [${reqId}]`, ...args);
    const logErr = (...args) => console.error(`[${new Date().toISOString()}] [${reqId}]`, ...args);

    if (!videoURL) {
        logErr('URL missing in request body');
        return res.status(400).json({ error: 'Please provide a URL.' });
    }

    log(`Download started: ${videoURL}`);

    let stderrLog = '';
    let bytesSent = 0;
    let headersSet = false;

    const ytDlpProcess = ytdlp.exec(videoURL, {
        output: '-',
        format: 'best[ext=mp4]/best',
        extractorArgs: 'youtube:player_client=android',
        noWarnings: false
    }, {
        stdio: ['ignore', 'pipe', 'pipe']   // stderr have pipe karyu
    });

    // yt-dlp na error/warning messages
    ytDlpProcess.stderr.on('data', (chunk) => {
        const msg = chunk.toString();
        stderrLog += msg;
        logErr('yt-dlp stderr:', msg.trim());
    });

    // Pehla data aave tyare j headers set karo
    ytDlpProcess.stdout.on('data', (chunk) => {
        if (!headersSet) {
            res.header('Content-Disposition', 'attachment; filename="video.mp4"');
            res.header('Content-Type', 'video/mp4');
            headersSet = true;
            log('First data received, streaming started');
        }
        bytesSent += chunk.length;
        res.write(chunk);
    });

    // Process pura thay tyare (success ke fail)
    ytDlpProcess.on('close', (code, signal) => {
        log(`Process closed. exit code=${code}, signal=${signal}, bytesSent=${bytesSent}`);

        if (code !== 0) {
            logErr('DOWNLOAD FAILED. Full stderr:\n' + stderrLog);
            if (!headersSet) {
                return res.status(500).json({
                    error: 'Error occurred while downloading video.',
                    details: stderrLog.trim().split('\n').pop() // last error line
                });
            }
            return res.end(); // data aadho gayo hoy to file corrupt thase
        }

        if (bytesSent === 0) {
            logErr('Exit code 0 but no data received. stderr:\n' + stderrLog);
            return res.status(500).json({ error: 'No data received from yt-dlp.' });
        }

        log('Download completed successfully');
        res.end();
    });

    // Process start j na thay (yt-dlp binary missing vagere)
    ytDlpProcess.on('error', (err) => {
        logErr('Process spawn error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to start download.', details: err.message });
        }
    });

    // User browser band kari de to process kill karo
    res.on('close', () => {
        if (!res.writableEnded) {
            log('Client disconnected, killing yt-dlp process');
            ytDlpProcess.kill('SIGKILL');
        }
    });

    // Timeout (5 minute) - atki jaay to kill
    const timeout = setTimeout(() => {
        logErr('Timeout reached, killing process');
        ytDlpProcess.kill('SIGKILL');
    }, 5 * 60 * 1000);
    ytDlpProcess.on('close', () => clearTimeout(timeout));
});

app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

// Uncaught errors na logs
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});