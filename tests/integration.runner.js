// tests/integration.runner.js - Test Runner Ligero de Integración GRC
import http from 'http';
import https from 'https';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

export class TestClient {
  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
    this.cookies = '';
  }

  async request(endpoint, options = {}) {
    const url = new URL(endpoint, this.baseUrl);
    const client = url.protocol === 'https:' ? https : http;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.cookies) {
      headers['Cookie'] = this.cookies;
    }

    const bodyData = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : null;

    if (bodyData && !headers['Content-Length']) {
      headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    return new Promise((resolve, reject) => {
      const req = client.request(url, {
        method: options.method || 'GET',
        headers,
      }, (res) => {
        let rawData = '';

        // Capturar cookies recibidas (Set-Cookie)
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          this.cookies = setCookie.map(c => c.split(';')[0]).join('; ');
        }

        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = rawData ? JSON.parse(rawData) : null;
          } catch {
            parsed = rawData;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
          });
        });
      });

      req.on('error', reject);
      if (bodyData) req.write(bodyData);
      req.end();
    });
  }
}

export class Assert {
  static equals(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`❌ FAIL: ${message} | Esperado: ${expected}, Recibido: ${actual}`);
    }
    console.log(`  ✓ PASS: ${message}`);
  }

  static isTrue(condition, message) {
    if (!condition) {
      throw new Error(`❌ FAIL: ${message}`);
    }
    console.log(`  ✓ PASS: ${message}`);
  }

  static exists(val, message) {
    if (val === undefined || val === null) {
      throw new Error(`❌ FAIL: ${message} (Valor es ${val})`);
    }
    console.log(`  ✓ PASS: ${message}`);
  }
}