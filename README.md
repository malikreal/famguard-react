# FamGuard Admin — Vite Preview

This project contains the uploaded FamGuard React component as `src/App.jsx`.

## Requirements
- Node.js 18+ recommended
- npm

## Run
```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal, normally:
http://localhost:5173

## Production build
```bash
npm run build
npm run preview
```

## Firebase
The original component already contains its Firebase configuration and uses Firebase Authentication and Firestore.

The UI will load without signing in, but the application functionality depends on the configured Firebase project, enabled Authentication provider, and Firestore rules/data.

Do not expose privileged Firebase credentials or service-account keys in frontend code. The Firebase web configuration in this project is the client configuration from the supplied component.
