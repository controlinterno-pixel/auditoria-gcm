# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Gmail OAuth

The application sends notifications from the signed-in user's Gmail account. Configure `VITE_GOOGLE_CLIENT_ID` as a Vite build environment variable in Vercel and in local `.env.local` development.

Create a Google OAuth client of type Web application, add the application origin (for example, `https://auditoria-gcm.vercel.app`) and both `http://localhost:5173` and `http://127.0.0.1:5173` as authorized JavaScript origins, enable the Gmail API, and allow the `gmail.send`, `openid`, and `email` scopes in the OAuth consent configuration. For a Google Workspace-only organization, use an Internal consent audience when available. The OAuth client ID is public; do not put a client secret in the frontend.

The user authorizes Gmail once per browser session. The short-lived access token stays in memory and is not written to local storage.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
