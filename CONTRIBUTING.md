# 🤝 Contributing to GitStars Map

Thank you for your interest in contributing to GitStars Map! We want to make contributing to this project as easy and transparent as possible.

---

## 🏛️ Code of Conduct

By participating in this project, you agree to abide by basic open-source citizenship standards: be respectful, welcoming, and collaborative.

---

## 🛠️ Local Development Setup

To set up the development environment locally:

1. **Fork the Repository:** Fork this repository to your own GitHub account and clone it locally.
2. **Install Dependencies:**
   ```bash
   npm install
   ```
3. **Run Dev Server:** Start the Vite local development server:
   ```bash
   npm run dev
   ```
4. **Linting Check:** Run ESLint to verify style guide conformity:
   ```bash
   npm run lint
   ```

---

## 🧪 Testing Guidelines (TDD)

We use **Vitest** for our unit tests. All business logic, rates/rate-limiting code, and router logic must have unit tests.

*   To run the test suite once:
    ```bash
    npm test
    ```
*   To run tests in watch mode (interactive):
    ```bash
    npx vitest
    ```

> [!IMPORTANT]
> **If you add a new utility or service, you must write a corresponding test file under `__tests__/`** and verify that all 26+ tests pass successfully before submitting a pull request.

---

## 🔀 Pull Request Process

1. **Create a Branch:** Create a branch for your feature or bugfix (e.g., `feature/custom-themes` or `bugfix/graph-clickability`).
2. **Write Clean Code:** Follow the existing project styling. Keep React components clean and utilize the CSS custom properties defined in `src/index.css`.
3. **Document Your Work:** Update the `README.md` if you are adding new features, configuration options, or dependencies.
4. **Submit the PR:** Describe your changes in detail. If your changes affect the UI, please include screenshots or a short GIF.

---

## 🔒 Security & Secrets

Do not ever commit any API Keys, Google Gemini tokens, or GitHub Personal Access Tokens (PATs) to the codebase or `.env` files. The project is designed to run completely on the client side; all keys should be dynamically entered by the user in the UI settings panel and stored securely in their browser's local storage.
