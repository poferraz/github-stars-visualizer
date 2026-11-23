# Contributing to GitStars Map

Follow the [local setup instructions](README.md#run-locally) to install the locked dependencies and start the desktop. Keep each pull request focused on one change.

## Check a change

```sh
npm run lint
npm test
npm run build
```

The tests cover GitHub requests, model routing, AI response handling, local limits, graph construction, and the server-side proxy. Add a test alongside the affected service or utility when changing one of these behaviors. Use dummy credentials and mocked provider responses in automated tests.

For a change to the desktop, open **API Settings**, enter a public GitHub username with stars, leave the credential fields empty, and open **Stars Map**. Check the affected control and click a repository to open its details. Include the steps you tried and the observed result in the pull request. A screenshot can help explain a visual change. Keep account credentials and personal data out of screenshots, logs, and fixtures.

## Changing an AI provider

The built-in providers run from the browser. The custom provider passes through the app's server function. A change to either path should keep the destination shown in Settings and the [README](README.md#data-and-optional-ai) accurate. Use the proxy tests for server behavior or a function-enabled deployment for a full custom-provider check. The Vite development server alone serves the frontend.
