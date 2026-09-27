// tests/index.js - Suite Principal de Integración
import { runAuthTests } from './scenarios/01_auth_session.test.js';
import { runRlsTests } from './scenarios/02_rls_security.test.js';
import { runUploadTests } from './scenarios/03_file_upload.test.js';
import { runRiesgosTests } from './scenarios/04_riesgos.test.js';

async function executeTestSuite() {
  const targetUrl = process.env.TEST_API_URL || 'http://localhost:3000';

  console.log('===========================================================');
  console.log('🚀 INICIANDO PRUEBAS DE INTEGRACIÓN Y ZERO TRUST (GRC GCM)');
  console.log(`🎯 Objetivo API: ${targetUrl}`);
  console.log('===========================================================');

  try {
    await runAuthTests();
    await runRlsTests();
    await runUploadTests();
    await runRiesgosTests();

    console.log('\n===========================================================');
    console.log('🎉 ¡TODAS LAS PRUEBAS DE INTEGRACIÓN PASARON EXITOSAMENTE!');
    console.log('===========================================================');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ LA SUITE DE PRUEBAS DETECTÓ UN FALLO EN EL SISTEMA:');
    console.error(error.stack || error.message || error);
    process.exit(1);
  }
}

executeTestSuite();