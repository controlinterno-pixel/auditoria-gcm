import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // 🛡️ REGLA ZERO-TRUST: Prohíbe usar librerías de backend en el frontend
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'firebase-admin',
              message: '¡ALERTA DE SEGURIDAD! No puedes importar firebase-admin en React. Usa fetch() hacia la API de Vercel.',
            },
            {
              name: '@google/generative-ai',
              message: '¡ALERTA DE SEGURIDAD! Las claves de IA deben usarse solo en el backend. Llama a /api/grc/audit.',
            }
          ]
        }
      ]
    }
  },
])