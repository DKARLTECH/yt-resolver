#!/usr/bin/env bash
set -e

# Install Node dependencies
npm install

# Install yt-dlp binary
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp

# Verify
yt-dlp --version
