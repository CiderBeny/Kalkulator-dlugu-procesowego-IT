const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const W = 1200, H = 630;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// Colors matching the app theme
const BG_BASE   = '#F5F0E8';
const BG_CARD   = '#EDE8DB';
const TEXT       = '#1C1410';
const ACCENT     = '#B45309';
const ACCENT_DIM = 'rgba(180,83,9,0.08)';

// Gradient background
const grad = ctx.createLinearGradient(0, 0, W, H);
grad.addColorStop(0, BG_BASE);
grad.addColorStop(1, BG_CARD);
ctx.fillStyle = grad;
ctx.fillRect(0, 0, W, H);

// Subtle accent bar at top
ctx.fillStyle = ACCENT;
ctx.fillRect(0, 0, W, 6);

// Decorative accent circle (top-right, faded)
ctx.beginPath();
ctx.arc(W - 120, 120, 200, 0, Math.PI * 2);
ctx.fillStyle = ACCENT_DIM;
ctx.fill();

// Decorative accent circle (bottom-left, faded)
ctx.beginPath();
ctx.arc(100, H - 80, 160, 0, Math.PI * 2);
ctx.fillStyle = ACCENT_DIM;
ctx.fill();

// Main title
ctx.fillStyle = TEXT;
ctx.font = 'bold 64px Arial, Helvetica, sans-serif';
ctx.textAlign = 'center';
ctx.fillText('Process Debt Engine', W / 2, H / 2 - 40);

// Tagline
ctx.fillStyle = ACCENT;
ctx.font = '28px Arial, Helvetica, sans-serif';
ctx.fillText('Financial cost of process debt in software delivery', W / 2, H / 2 + 20);

// Subtle border around the card
ctx.strokeStyle = ACCENT;
ctx.lineWidth = 2;
ctx.strokeRect(12, 12, W - 24, H - 24);

// Small bottom text
ctx.fillStyle = 'rgba(28,20,16,0.35)';
ctx.font = '18px Arial, Helvetica, sans-serif';
ctx.fillText('Process Debt Engine', W / 2, H - 40);

// Save
const out = path.join(__dirname, '..', 'og-image.png');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(out, buffer);
console.log(`OK — ${out} (${(buffer.length / 1024).toFixed(1)} KB)`);
