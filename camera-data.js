const fs = require('fs');

// Read the current file
let content = fs.readFileSync('auto-scraper.js', 'utf8');

// The correct camera data
const correctCameraData = `    // Example camera data - replace with actual scraping logic
    const cameras = [
      {
        brand: 'Canon',
        model: 'EOS R5',
        fullName: 'Canon EOS R5',
        category: 'mirrorless',
        releaseYear: 2020,
        msrp: 3899,
        currentPrice: 3299,
        imageUrl: 'https://i.imgur.com/WJyaLG0.jpg',
        attribution: {
          source: 'Product Image',
          author: 'Canon Inc.',
          license: 'Fair Use',
          text: 'Product image for educational purposes'
        },
        description: 'Professional full-frame mirrorless camera with 45MP sensor and 8K video.',
        sensor: '45MP Full-Frame CMOS',
        processor: 'DIGIC X',
        mount: 'Canon RF',
        keyFeatures: [
          '45MP Full-Frame CMOS Sensor',
          '8K 30p / 4K 120p Video',
          'In-Body Image Stabilization',
          'Dual Pixel CMOS AF II',
          '20 fps Continuous Shooting'
        ],
        specs: {
          megapixels: 45,
          sensorSize: 'Full Frame',
          videoResolution: '8K',
          continuousSpeed: 20,
          hasIBIS: true,
          weatherSealed: true
        }
      },
      {
        brand: 'Sony',
        model: 'A7R V',
        fullName: 'Sony Alpha A7R V',
        category: 'mirrorless',
        releaseYear: 2022,
        msrp: 3899,
        currentPrice: 3799,
        imageUrl: 'https://i.imgur.com/qN8K9Lp.jpg',
        attribution: {
          source: 'Product Image',
          author: 'Sony Corporation',
          license: 'Fair Use',
          text: 'Product image for educational purposes'
        },
        description: 'High-resolution mirrorless camera with 61MP sensor and AI processing.',
        sensor: '61MP Full-Frame BSI CMOS',
        processor: 'BIONZ XR',
        mount: 'Sony E',
        keyFeatures: [
          '61MP Full-Frame BSI CMOS Sensor',
          'AI-Based Subject Recognition',
          '8-Stop Image Stabilization',
          '8K 24p / 4K 60p Video',
          '3.2" 4-Axis LCD'
        ],
        specs: {
          megapixels: 61,
          sensorSize: 'Full Frame',
          videoResolution: '8K',
          continuousSpeed: 10,
          hasIBIS: true,
          weatherSealed: true
        }
      }
    ];`;

// Find where cameras array starts and ends
const startPattern = /\/\/ Example camera data.*\n\s*const cameras = \[/;
const endPattern = /\s*\];[\s\n]*\/\/ Process each camera/;

if (content.match(startPattern) && content.match(endPattern)) {
  content = content.replace(/\/\/ Example camera data.*?const cameras = \[.*?\];/s, correctCameraData);
  fs.writeFileSync('auto-scraper.js', content);
  console.log('✅ Replaced entire camera data section');
} else {
  console.log('❌ Could not find camera data section');
}

console.log('\nNow run: npm run scrape');