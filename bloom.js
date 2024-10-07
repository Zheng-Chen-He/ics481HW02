function readPPM(data) {
    const lines = data.split('\n').filter(line => !line.startsWith('#') && line.trim() !== '');
    if (lines[0] !== 'P3') throw new Error('Not a valid PPM P3 file');

    const [width, height] = lines[1].split(' ').map(Number);
    const maxColorValue = parseInt(lines[2]);

    const pixels = lines.slice(3).join(' ').split(/\s+/).map(Number);
    const image = [];

    for (let i = 0; i < pixels.length; i += 3) {
        image.push({ r: pixels[i], g: pixels[i+1], b: pixels[i+2] });
    }

    return { width, height, maxColorValue, image };
}

function writePPM(width, height, maxColorValue, image) {
    let ppmData = `P3\n${width} ${height}\n${maxColorValue}\n`;

    for (const pixel of image) {
        ppmData += `${pixel.r} ${pixel.g} ${pixel.b}\n`;
    }

    return ppmData;
}

// Apply thresholding based on a given threshold value
function threshold(image, width, height, thresholdValue) {
    return image.map(pixel => {
        const intensity = (pixel.r + pixel.g + pixel.b) / 3;
        if (intensity >= thresholdValue) {
            return { r: pixel.r, g: pixel.g, b: pixel.b };
        } else {
            return { r: 0, g: 0, b: 0 };
        }
    });
}

// Apply Gaussian blur with a variable kernel size
function gaussianBlur(image, width, height, kernelSize) {
    const blurredImage = [];
    const kernel = createGaussianKernel(kernelSize);

    const getPixel = (x, y) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return { r: 0, g: 0, b: 0 };
        return image[y * width + x];
    };

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let newR = 0, newG = 0, newB = 0;
            let weightSum = 0;

            for (let ky = -Math.floor(kernelSize / 2); ky <= Math.floor(kernelSize / 2); ky++) {
                for (let kx = -Math.floor(kernelSize / 2); kx <= Math.floor(kernelSize / 2); kx++) {
                    const weight = kernel[ky + Math.floor(kernelSize / 2)][kx + Math.floor(kernelSize / 2)];
                    const pixel = getPixel(x + kx, y + ky);

                    newR += pixel.r * weight;
                    newG += pixel.g * weight;
                    newB += pixel.b * weight;
                    weightSum += weight;
                }
            }

            blurredImage.push({
                r: Math.min(newR / weightSum, 255),
                g: Math.min(newG / weightSum, 255),
                b: Math.min(newB / weightSum, 255),
            });
        }
    }

    return blurredImage;
}

// Gaussian kernel creation function
function createGaussianKernel(size) {
    const sigma = size / 2;
    const kernel = [];
    let sum = 0;

    for (let y = -Math.floor(size / 2); y <= Math.floor(size / 2); y++) {
        const row = [];
        for (let x = -Math.floor(size / 2); x <= Math.floor(size / 2); x++) {
            const value = (1 / (2 * Math.PI * sigma ** 2)) * Math.exp(-(x ** 2 + y ** 2) / (2 * sigma ** 2));
            row.push(value);
            sum += value;
        }
        kernel.push(row);
    }

    // Normalize the kernel
    return kernel.map(row => row.map(value => value / sum));
}

// Blend the original and blurred images
function blendImages(originalImage, blurredImage, width, height) {
    const blendedImage = [];

    for (let i = 0; i < originalImage.length; i++) {
        blendedImage.push({
            r: Math.min(originalImage[i].r + blurredImage[i].r, 255),
            g: Math.min(originalImage[i].g + blurredImage[i].g, 255),
            b: Math.min(originalImage[i].b + blurredImage[i].b, 255),
        });
    }

    return blendedImage;
}

// Apply bloom effect: threshold + blur + blend
function bloomEffect(image, width, height, thresholdValue) {
    const thresholded = threshold(image, width, height, thresholdValue);
    const blurred = gaussianBlur(thresholded, width, height, 10);  // Default kernel size is 10
    return blendImages(image, blurred, width, height);
}

module.exports = { readPPM, writePPM, bloomEffect, threshold, gaussianBlur };

function blendImages(baseImage, blurredImage, width, height) {
    return baseImage.map((pixel, i) => {
        return {
            r: Math.min(pixel.r + blurredImage[i].r, 255),
            g: Math.min(pixel.g + blurredImage[i].g, 255),
            b: Math.min(pixel.b + blurredImage[i].b, 255)
        };
    });
}