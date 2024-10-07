const fs = require('fs');
const path = require('path');
const { dialog } = require('electron').remote;
const { readPPM, writePPM, bloomEffect, threshold, gaussianBlur } = require('./bloom');

// DOM Elements
const fileInput = document.getElementById('fileInput');
const animateThresholdBtn = document.getElementById('animateThreshold');
const animateBlurBtn = document.getElementById('animateBlur');
const applyBloomBtn = document.getElementById('applyBloom');
const saveImageBtn = document.getElementById('saveImage');
const previewImg = document.getElementById('preview');

let loadedImageData = null;
let width = 0, height = 0, maxColorValue = 0;
let processedImage = null;

// Handle file input
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target.result;
            const ppmData = readPPM(data);
            loadedImageData = ppmData.image;
            width = ppmData.width;
            height = ppmData.height;
            maxColorValue = ppmData.maxColorValue;

            previewImg.src = URL.createObjectURL(file);  // Show preview
        };
        reader.readAsText(file);
    }
});

// Animate thresholding from 0.75 to 0.25
animateThresholdBtn.addEventListener('click', () => {
    if (loadedImageData) {
        let thresholdValue = 0.75 * 255;
        const minThreshold = 0.25 * 255;
        const interval = setInterval(() => {
            processedImage = threshold(loadedImageData, width, height, thresholdValue);
            updateImagePreview(processedImage);  // Show the animated effect
            thresholdValue -= 10;
            if (thresholdValue <= minThreshold) {
                clearInterval(interval);
            }
        }, 100);
    } else {
        alert("Please load an image first.");
    }
});

// Animate blur effect from 1 pixel to 120 pixels
animateBlurBtn.addEventListener('click', () => {
    if (loadedImageData) {
        let kernelSize = 1;
        const maxKernelSize = 120;
        const interval = setInterval(() => {
            processedImage = gaussianBlur(loadedImageData, width, height, kernelSize);
            updateImagePreview(processedImage);  // Show the animated blur effect
            kernelSize += 5;
            if (kernelSize >= maxKernelSize) {
                clearInterval(interval);
            }
        }, 100);
    } else {
        alert("Please load an image first.");
    }
});

// Apply bloom effect
applyBloomBtn.addEventListener('click', () => {
    if (loadedImageData) {
        const bloomThreshold = 128;  // You can add an input field to set threshold dynamically
        processedImage = bloomEffect(loadedImageData, width, height, bloomThreshold);
        alert("Bloom effect applied successfully!");
        updateImagePreview(processedImage);
    } else {
        alert("Please load an image first.");
    }
});

// Save the processed image
saveImageBtn.addEventListener('click', () => {
    if (processedImage) {
        const outputData = writePPM(width, height, maxColorValue, processedImage);
        const filePath = dialog.showSaveDialogSync({
            title: "Save Image",
            defaultPath: path.join(__dirname, 'output.ppm'),
            filters: [{ name: 'PPM Files', extensions: ['ppm'] }]
        });
        if (filePath) {
            fs.writeFileSync(filePath, outputData);
            alert("Image saved successfully!");
        }
    } else {
        alert("No processed image to save.");
    }
});

// Function to update the image preview
function updateImagePreview(image) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;

    const imageData = ctx.createImageData(width, height);
    let dataIdx = 0;

    for (const pixel of image) {
        imageData.data[dataIdx++] = pixel.r;
        imageData.data[dataIdx++] = pixel.g;
        imageData.data[dataIdx++] = pixel.b;
        imageData.data[dataIdx++] = 255;  // Alpha value (fully opaque)
    }

    ctx.putImageData(imageData, 0, 0);
    previewImg.src = canvas.toDataURL();  // Update the image source with new image data
}