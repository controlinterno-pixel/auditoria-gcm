// tests/index.js - Suite Principal de Integración
import { runAuthTests } from './scenarios/01_auth_session.test.js';
import { runRlsTests } from './scenarios/02_rls_security.test.js';
import { runUploadTests } from './scenarios/03_file_upload.test.js';

async function executeTestSuite() {
  console.log('===========================================================');
  console.log('🚀 INICIANDO PRUEBAS DE INTEGRACIÓN Y ZERO TRUST (GRC GCM)');
  console.log('===========================================================');

  try {
    await runAuthTests();
    await runRlsTests();
    await runUploadTests();

    console.log('\n===========================================================');
    console.log('🎉 ¡TODAS LAS PRUEBAS DE INTEGRACIÓN PASARON EXITOSAMENTE!');
    console.log('===========================================================');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ LA SUITE DE PRUEBAS DETECTÓ UN FALLO EN EL SISTEMA:');
    console.error(error.message);
    process.exit(1);
  }
}

executeTestSuite();