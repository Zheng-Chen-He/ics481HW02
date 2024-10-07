// Global variables
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let originalImageData = null;
let frameData = [];
let totalFrames = 360;

// DOM Elements
const imageInput = document.getElementById('imageInput');
const thresholdBtn = document.getElementById('thresholdBtn');
const blurBtn = document.getElementById('blurBtn');
const bloomBtn = document.getElementById('bloomBtn');
const downloadBtn = document.getElementById('downloadBtn');

// Event Listeners
imageInput.addEventListener('change', handleImageUpload);
thresholdBtn.addEventListener('click', () => animateThreshold(120));
blurBtn.addEventListener('click', () => animateBlur(120));
bloomBtn.addEventListener('click', () => animateBloom(120));
downloadBtn.addEventListener('click', downloadAllFrames);

// Handle Image Upload
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const ppmText = e.target.result;
            loadPPM(ppmText);
        };
        reader.readAsText(file);
    }
}

// Parse and Load PPM P3 Image
function loadPPM(ppmText) {
    const lines = ppmText.split('\n');
    let width, height, maxVal;
    let pixelData = [];
    let startIndex = 0;

    // Parse Header
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line.startsWith('#') || line === '') continue; // Skip comments and empty lines

        if (!width) {
            const dimensions = line.split(' ').filter(num => num !== '');
            width = parseInt(dimensions[0]);
            height = parseInt(dimensions[1]);
        } else if (!maxVal) {
            maxVal = parseInt(line);
            startIndex = i + 1;
            break;
        }
    }

    // Validate PPM Format
    if (!width || !height || !maxVal) {
        alert('Invalid PPM file format.');
        return;
    }

    // Extract Pixel Data
    const pixelLines = lines.slice(startIndex).join(' ').trim().split(/\s+/).map(Number);
    for (let i = 0; i < pixelLines.length; i += 3) {
        pixelData.push(pixelLines[i], pixelLines[i + 1], pixelLines[i + 2], 255); // RGBA
    }

    // Create ImageData
    const imgData = new ImageData(new Uint8ClampedArray(pixelData), width, height);
    originalImageData = imgData;

    // Resize Canvas if Necessary
    if (width !== canvas.width || height !== canvas.height) {
        canvas.width = width;
        canvas.height = height;
    }

    // Draw Image on Canvas
    ctx.putImageData(imgData, 0, 0);

    // Enable Buttons
    thresholdBtn.disabled = false;
    blurBtn.disabled = false;
    bloomBtn.disabled = false;
    downloadBtn.disabled = false;
}

// Thresholding Function
function applyThreshold(pixels, threshold) {
    const result = new Uint8ClampedArray(pixels.length);
    for (let i = 0; i < pixels.length; i += 4) {
        const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        const value = brightness > threshold ? 255 : 0;
        result[i] = result[i + 1] = result[i + 2] = value;
        result[i + 3] = 255;
    }
    return result;
}

// Generate Gaussian Kernel
function generateGaussianKernel(size) {
    const sigma = size / 6; // Common practice for sigma
    const kernel = [];
    const half = Math.floor(size / 2);
    let sum = 0;

    for (let y = -half; y <= half; y++) {
        const row = [];
        for (let x = -half; x <= half; x++) {
            const exponent = -(x * x + y * y) / (2 * sigma * sigma);
            const value = (1 / (2 * Math.PI * sigma * sigma)) * Math.exp(exponent);
            row.push(value);
            sum += value;
        }
        kernel.push(row);
    }

    // Normalize Kernel
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            kernel[y][x] /= sum;
        }
    }

    return kernel;
}

// Gaussian Blur Function
function applyGaussianBlur(pixels, width, height, kernelSize) {
    const kernel = generateGaussianKernel(kernelSize);
    const half = Math.floor(kernelSize / 2);
    const result = new Uint8ClampedArray(pixels.length);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0;
            for (let ky = -half; ky <= half; ky++) {
                for (let kx = -half; kx <= half; kx++) {
                    const px = x + kx;
                    const py = y + ky;
                    // Boundary Check
                    if (px < 0 || px >= width || py < 0 || py >= height) continue;
                    const idx = (py * width + px) * 4;
                    const weight = kernel[ky + half][kx + half];
                    r += pixels[idx] * weight;
                    g += pixels[idx + 1] * weight;
                    b += pixels[idx + 2] * weight;
                }
            }
            const idx = (y * width + x) * 4;
            result[idx] = r;
            result[idx + 1] = g;
            result[idx + 2] = b;
            result[idx + 3] = 255;
        }
    }
    return result;
}

// Blending Function (Additive Blending)
function blendImages(basePixels, bloomPixels) {
    const blended = new Uint8ClampedArray(basePixels.length);
    for (let i = 0; i < basePixels.length; i += 4) {
        blended[i] = Math.min(basePixels[i] + bloomPixels[i], 255);
        blended[i + 1] = Math.min(basePixels[i + 1] + bloomPixels[i + 1], 255);
        blended[i + 2] = Math.min(basePixels[i + 2] + bloomPixels[i + 2], 255);
        blended[i + 3] = 255;
    }
    return blended;
}

// Capture Frame Function
function captureFrame(frameNumber) {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const base64Data = e.target.result.split(',')[1];
                frameData.push({ filename: `frame_${frameNumber.toString().padStart(3, '0')}.png`, data: base64Data });
                resolve();
            };
            reader.readAsDataURL(blob);
        }, 'image/png');
    });
}

// Animate Thresholding
async function animateThreshold(frames) {
    if (!originalImageData) return;
    thresholdBtn.disabled = true;
    blurBtn.disabled = true;
    bloomBtn.disabled = true;
    downloadBtn.disabled = true;

    const width = originalImageData.width;
    const height = originalImageData.height;
    let imgData = new ImageData(new Uint8ClampedArray(originalImageData.data), width, height);

    const step = (0.75 - 0.25) / frames;
    for (let f = 0; f < frames; f++) {
        const threshold = (0.75 - f * step) * 255;
        const processedPixels = applyThreshold(imgData.data, threshold);
        imgData.data.set(processedPixels);
        ctx.putImageData(imgData, 0, 0);
        await captureFrame(f + 1); // Frames 1-120
    }

    // Update originalImageData for next operations
    originalImageData = ctx.getImageData(0, 0, width, height);
    thresholdBtn.disabled = false;
    blurBtn.disabled = false;
    bloomBtn.disabled = false;
    downloadBtn.disabled = false;
    alert('Threshold Animation Completed!');
}

// Animate Gaussian Blur
async function animateBlur(frames) {
    if (!originalImageData) return;
    thresholdBtn.disabled = true;
    blurBtn.disabled = true;
    bloomBtn.disabled = true;
    downloadBtn.disabled = true;

    const width = originalImageData.width;
    const height = originalImageData.height;
    let imgData = new ImageData(new Uint8ClampedArray(originalImageData.data), width, height);

    for (let f = 0; f < frames; f++) {
        const kernelSize = 1 + f * 2; // 1x1, 3x3, ..., 239x239
        const processedPixels = applyGaussianBlur(imgData.data, width, height, kernelSize);
        imgData.data.set(processedPixels);
        ctx.putImageData(imgData, 0, 0);
        await captureFrame(120 + f + 1); // Frames 121-240
    }

    // Update originalImageData for next operations
    originalImageData = ctx.getImageData(0, 0, width, height);
    thresholdBtn.disabled = false;
    blurBtn.disabled = false;
    bloomBtn.disabled = false;
    downloadBtn.disabled = false;
    alert('Blur Animation Completed!');
}

// Animate Bloom Effect
async function animateBloom(frames) {
    if (!originalImageData) return;
    thresholdBtn.disabled = true;
    blurBtn.disabled = true;
    bloomBtn.disabled = true;
    downloadBtn.disabled = true;

    const width = originalImageData.width;
    const height = originalImageData.height;
    let baseImageData = new ImageData(new Uint8ClampedArray(originalImageData.data), width, height);
    let bloomImageData = new ImageData(new Uint8ClampedArray(originalImageData.data), width, height);

    for (let f = 0; f < frames; f++) {
        const intensity = (f + 1) / frames; // Varies from ~0 to 1
        // Apply threshold to create bloom mask
        const thresholdValue = 0.5 * 255; // Fixed threshold for bloom mask
        const thresholdedPixels = applyThreshold(bloomImageData.data, thresholdValue);
        // Apply Gaussian blur with fixed kernel size for bloom
        const blurredPixels = applyGaussianBlur(thresholdedPixels, width, height, 15); // Example kernel size
        // Blend with base image
        const blendedPixels = blendImages(baseImageData.data, blurredPixels);
        const blendedImageData = new ImageData(new Uint8ClampedArray(blendedPixels), width, height);
        ctx.putImageData(blendedImageData, 0, 0);
        await captureFrame(240 + f + 1); // Frames 241-360
    }

    // Reset to original image after bloom
    ctx.putImageData(originalImageData, 0, 0);
    originalImageData = ctx.getImageData(0, 0, width, height);
    thresholdBtn.disabled = false;
    blurBtn.disabled = false;
    bloomBtn.disabled = false;
    downloadBtn.disabled = false;
    alert('Bloom Animation Completed!');
}

// Download All Frames as ZIP
function downloadAllFrames() {
    if (frameData.length === 0) {
        alert('No frames to download.');
        return;
    }

    downloadBtn.disabled = true;
    thresholdBtn.disabled = true;
    blurBtn.disabled = true;
    bloomBtn.disabled = true;

    const zip = new JSZip();
    const imgFolder = zip.folder("frames");

    frameData.forEach(frame => {
        imgFolder.file(frame.filename, frame.data, { base64: true });
    });

    zip.generateAsync({ type: "blob" })
        .then(function(content) {
            saveAs(content, "frames.zip");
            downloadBtn.disabled = false;
            thresholdBtn.disabled = false;
            blurBtn.disabled = false;
            bloomBtn.disabled = false;
        });
}