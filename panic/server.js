// Simple Anti-Gambling Ministry Server - No Security Headers
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3002; // Changed port to avoid browser HTTPS cache

// Disable all Express security defaults
app.disable('x-powered-by');
app.disable('etag');

// Basic JSON middleware
app.use(express.json());

// Force HTTP and disable any security headers
app.use((req, res, next) => {
    // Remove any headers that might force HTTPS
    res.removeHeader('Strict-Transport-Security');
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.removeHeader('Cross-Origin-Embedder-Policy');
    res.removeHeader('Origin-Agent-Cluster');
    res.removeHeader('Content-Security-Policy');
    
    // Force no cache to prevent HTTPS caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    next();
});

// Serve static files with explicit MIME types - NO security headers
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: 0, // No caching to avoid issues
    setHeaders: (res, filePath) => {
        // Clear any default headers that might cause issues
        res.removeHeader('X-Powered-By');
        res.removeHeader('ETag');
        res.removeHeader('Strict-Transport-Security');
        res.removeHeader('Cross-Origin-Opener-Policy');
        res.removeHeader('Cross-Origin-Embedder-Policy');
        res.removeHeader('Origin-Agent-Cluster');
        
        // Force HTTP instead of HTTPS
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        // Set only essential headers
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
        } else if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        } else if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        } else if (filePath.endsWith('.ico')) {
            res.setHeader('Content-Type', 'image/x-icon');
        }
    }
}));

// Handle 404 errors - serve custom 404 page
app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✝️ Christian Anti-Gambling Ministry running on http://localhost:${PORT}`);
    console.log(`✝️ Also accessible via IP: http://192.168.x.x:${PORT}`);
});