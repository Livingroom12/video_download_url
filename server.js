const express = require('express');
const path = require('path');
const ytdlp = require('yt-dlp-exec');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/download', (req, res) => {
    const videoURL = req.body.url;
    const reqId = Date.now().toString(36);

    const log = (...args) =>
        console.log(`[${new Date().toISOString()}] [${reqId}]`, ...args);

    const logErr = (...args) =>
        console.error(`[${new Date().toISOString()}] [${reqId}]`, ...args);

    if (!videoURL) {
        logErr('URL missing in request body');
        return res.status(400).json({
            error: 'Please provide a URL.'
        });
    }

    log(`Download started: ${videoURL}`);

    let stderrLog = '';
    let bytesSent = 0;
    let headersSet = false;
    let clientDisconnected = false;

    const ytDlpProcess = ytdlp.exec(
        videoURL,
        {
            output: '-',
            format: 'best[ext=mp4]/best',
        },
        {
            stdio: ['ignore', 'pipe', 'pipe']
        }
    );

    // yt-dlp stderr
    ytDlpProcess.stderr.on('data', (chunk) => {
        const msg = chunk.toString();

        stderrLog += msg;

        logErr('yt-dlp stderr:', msg.trim());
    });

    // Video data
    ytDlpProcess.stdout.on('data', (chunk) => {
        if (clientDisconnected) {
            return;
        }

        if (!headersSet) {
            res.setHeader(
                'Content-Disposition',
                'attachment; filename="video.mp4"'
            );

            res.setHeader('Content-Type', 'video/mp4');

            headersSet = true;

            log('First data received, streaming started');
        }

        bytesSent += chunk.length;

        res.write(chunk);
    });

    // Process finished
    ytDlpProcess.on('close', (code, signal) => {
        log(
            `Process closed. exit code=${code}, signal=${signal}, bytesSent=${bytesSent}`
        );

        if (code !== 0) {
            logErr(
                'DOWNLOAD FAILED. Full stderr:\n' +
                stderrLog
            );

            if (!headersSet && !res.headersSent && !clientDisconnected) {
                const lines = stderrLog.trim().split('\n');

                return res.status(500).json({
                    error: 'Error occurred while downloading video.',
                    details: lines[lines.length - 1] || 'Unknown yt-dlp error.'
                });
            }

            if (!res.writableEnded) {
                res.end();
            }

            return;
        }

        if (bytesSent === 0) {
            logErr(
                'Exit code 0 but no data received. stderr:\n' +
                stderrLog
            );

            if (!res.headersSent && !clientDisconnected) {
                return res.status(500).json({
                    error: 'No data received from yt-dlp.'
                });
            }

            return;
        }

        log('Download completed successfully');

        if (!res.writableEnded) {
            res.end();
        }
    });

    // yt-dlp process spawn error
    ytDlpProcess.on('error', (err) => {
        logErr('Process spawn error:', err);

        if (!res.headersSent && !clientDisconnected) {
            res.status(500).json({
                error: 'Failed to start download.',
                details: err.message
            });
        }
    });

    // Browser/client disconnected
    res.on('close', () => {
        if (!res.writableEnded) {
            clientDisconnected = true;

            log('Client disconnected, killing yt-dlp process');

            ytDlpProcess.kill('SIGKILL');
        }
    });

    // 5-minute timeout
    const timeout = setTimeout(() => {
        logErr('Timeout reached, killing yt-dlp process');

        ytDlpProcess.kill('SIGKILL');
    }, 5 * 60 * 1000);

    ytDlpProcess.on('close', () => {
        clearTimeout(timeout);
    });
});

// Privacy page
app.get('/privacy', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'privacy.html')
    );
});

// Terms page
app.get('/terms', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'terms.html')
    );
});

// Global error handlers
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
