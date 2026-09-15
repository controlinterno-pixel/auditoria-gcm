import fs from 'fs';

try {
  const envContent = fs.readFileSync('.env', 'utf8');
  
  // Busca la línea exacta donde inicia la variable
  const keyIndex = envContent.indexOf('FIREBASE_PRIVATE_KEY=');
  
  if (keyIndex !== -1) {
    let rawKey = envContent.slice(keyIndex + 'FIREBASE_PRIVATE_KEY='.length).trim();
    
    // Limpia comillas iniciales y finales si existen
    if (rawKey.startsWith('"')) rawKey = rawKey.slice(1);
    if (rawKey.endsWith('"')) rawKey = rawKey.slice(0, -1);
    
    // Normaliza saltos de línea
    rawKey = rawKey.replace(/\\n/g, '\n');

    const base64Key = Buffer.from(rawKey).toString('base64');
    console.log('\n--- COPIA ESTA CADENA BASE64 Y PÉGALA EN VERCEL ---\n');
    console.log(base64Key);
    console.log('\n----------------------------------------------------\n');
  } else {
    console.log('❌ No se encontró la variable FIREBASE_PRIVATE_KEY en el .env');
  }
} catch (err) {
  console.error('❌ Error leyendo el archivo .env:', err.message);
}