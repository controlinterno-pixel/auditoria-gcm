/* global Buffer, console */
const https = require('https');

async function testLimit(sizeBytes) {
  const fileData = 'A'.repeat(sizeBytes);
  const payload = JSON.stringify({
    fileName: 'test.txt',
    fileType: 'text/plain',
    fileData: 'data:text/plain;base64,' + Buffer.from(fileData).toString('base64'),
    subidoPor: 'test@test.com',
    appName: 'controlInterno'
  });

  return new Promise((resolve) => {
    const req = https.request('https://repos.termalessantarosa.com.co/api/archivos/upload?appName=controlInterno', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', (err) => resolve({ status: 500, error: err.message }));
    req.write(payload);
    req.end();
  });
}

async function run() {
  const sizes = [10 * 1024, 100 * 1024, 500 * 1024, 1024 * 1024, 2 * 1024 * 1024];
  for (const size of sizes) {
    console.log(`\nProbando con ${Math.round(size / 1024)} KB...`);
    const res = await testLimit(size);
    console.log(`Status: ${res.status}`);
    if (res.status === 413) {
      console.log(`Rechazado en ${Math.round(size / 1024)} KB`);
      break;
    }
  }
}

run();
