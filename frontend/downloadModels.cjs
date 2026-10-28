const fs = require('fs');
const https = require('https');
const path = require('path');

const baseUrl = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';
const files = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_expression_model-weights_manifest.json',
  'face_expression_model-shard1'
];

const targetDir = path.join(__dirname, 'public', 'models');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

async function downloadFile(filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(targetDir, filename);
    const file = fs.createWriteStream(filePath);
    
    https.get(baseUrl + filename, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded ${filename}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      console.error(`Error downloading ${filename}: ${err.message}`);
      reject(err);
    });
  });
}

async function run() {
  for (const file of files) {
    await downloadFile(file);
  }
  console.log('All downloads complete.');
}

run();
