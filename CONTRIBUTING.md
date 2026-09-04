# Contributing to Fairlx

Thank you for your interest in contributing to Fairlx! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Branching Strategy](#branching-strategy)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Style & Standards](#code-style--standards)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Security](#security)

---

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

---

## Ways to Contribute

We welcome various types of contributions:

### 🐛 Bug Reports
- Search existing issues first to avoid duplicates
- Use the bug report template
- Include reproduction steps, expected vs actual behavior
- Provide environment details (OS, Node version, browser)
- Include screenshots or error logs when applicable

### ✨ Feature Requests
- Open an issue to discuss before implementation
- Explain the problem your feature solves
- Describe proposed solution and alternatives considered
- Consider how it fits the project's scope

### 🔧 Code Contributions
- Bug fixes
- Feature implementations
- Performance improvements
- Refactoring and code cleanup
- Test coverage improvements

### 📝 Documentation
- Fix typos and clarify existing docs
- Add examples and tutorials
- Improve setup instructions
- Document undocumented features

### 🎨 UI/UX Improvements
- Design enhancements
- Accessibility improvements
- Mobile responsiveness
- User experience optimizations

---

## Development Setup

### Prerequisites

- **Node.js** 18.17 or later
- **Package Manager**: npm, yarn, pnpm, or bun
- **Git** for version control
- **Code Editor**: VS Code recommended with extensions:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript and JavaScript Language Features

### Initial Setup

1. **Fork the Repository**
   ```bash
   # Click "Fork" on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/Fairlx.git
   cd Fairlx
   ```

2. **Add Upstream Remote**
   ```bash
   git remote add upstream https://github.com/Happyesss/Fairlx.git
   git fetch upstream
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Set Up Environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

5. **Configure Appwrite**
   - Create an Appwrite project
   - Set up database and collections following [md/APPWRITE_SETUP.md](md/APPWRITE_SETUP.md)
   - Add collection IDs to `.env.local`

6. **Run Development Server**
   ```bash
   npm run dev
   ```

---

## Development Workflow

### Staying Up to Date

Before starting work, ensure your fork is up to date:

```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
```

### Creating a Feature Branch

```bash
git checkout -b feature/short-description
# or
git checkout -b fix/issue-number-description
# or
git checkout -b chore/task-description
```

### Making Changes

1. **Write code** following our [Code Style & Standards](#code-style--standards)
2. **Test your changes** locally
3. **Run linting**: `npm run lint`
4. **Run tests**: `npm run test`
5. **Commit your changes** following [Commit Guidelines](#commit-guidelines)

### Pushing Changes

```bash
git push origin feature/your-branch-name
```

---

## Branching Strategy

We follow a simplified Git Flow:

### Branch Types

| Branch | Purpose | Example |
|--------|---------|---------|
| `main` | Production-ready code | `main` |
| `feature/*` | New features | `feature/workflow-ai` |
| `fix/*` | Bug fixes | `fix/billing-calculation` |
| `chore/*` | Maintenance tasks | `chore/update-deps` |
| `docs/*` | Documentation only | `docs/api-reference` |
| `refactor/*` | Code refactoring | `refactor/project-structure` |

### Branch Naming

- Use lowercase with hyphens
- Be descriptive but concise
- Include issue number if applicable

---

## Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Commit Format

```
<type>(<scope>): <subject>
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(workflows): add AI status suggestions` |
| `fix` | Bug fix | `fix(billing): correct usage calculation` |
| `docs` | Documentation | `docs(readme): update setup instructions` |
| `style` | Code style changes | `style(tasks): fix indentation` |
| `refactor` | Code refactoring | `refactor(auth): simplify session logic` |
| `perf` | Performance improvements | `perf(queries): add caching` |
| `test` | Adding tests | `test(projects): add creation tests` |
| `chore` | Maintenance | `chore(deps): update dependencies` |

---

## Pull Request Process

### Before Submitting

1. **Ensure your branch is up to date** with main
2. **Run all checks**: `npm run lint && npm run test`
3. **Update documentation** if needed

### Creating the Pull Request

1. Push to your fork
2. Open PR on GitHub with descriptive title
3. Fill out the PR template
4. Link related issues
5. Add appropriate labels

### Review Process

1. Automated checks run
2. Maintainers review code
3. Address feedback
4. Get approval
5. Maintainer merges

---

## Code Style & Standards

### TypeScript

- Strict mode enabled
- Explicit types preferred
- No `any` - use specific types or `unknown`
- Type imports: `import type` for types

### React Components

- Server Components by default
- Client Components marked with `"use client"`
- PascalCase naming
- Props interface for every component

### Styling

- Tailwind CSS utilities
- Mobile-first responsive
- Support all themes (light, dark, pitch-dark)
- Use `cn()` helper for conditional classes

### API Routes

- Session middleware for protected routes
- Zod validation for inputs
- Proper HTTP status codes
- Type-safe with Hono

---

## Testing Requirements

- All new features must include tests
- Bug fixes should include regression tests
- Maintain or improve coverage

```bash
# Run tests
npm run test

# E2E tests
npx playwright test
```

---

## Documentation

[README.md](README.md) Latest block and [changelog.md](changelog.md) regenerate on every `git commit` and `git push` (local hooks plus GitHub Actions). Run `npm install` once so `prepare` installs the hooks. Do not edit the generated changelog by hand; older session notes are in [docs/changelog-history.md](docs/changelog-history.md).

Also update documentation when you:
- Add new features
- Change existing behavior
- Modify API endpoints
- Update database schema
- Change environment variables

---

## Security

**Do NOT report security vulnerabilities via public issues.**

To report a vulnerability:
1. Use GitHub's Security tab
2. Provide detailed information
3. We will respond within 48 hours

### Security Best Practices

- Never commit secrets
- Validate all inputs server-side
- Sanitize user data
- Check permissions server-side
- Follow OWASP guidelines

---

## Getting Help

- **Questions**: Open a [Discussion](https://github.com/Happyesss/Fairlx/discussions)
- **Issues**: Check [existing issues](https://github.com/Happyesss/Fairlx/issues)
- **Documentation**: Read [README.md](README.md)

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## Thank You!

Your contributions make Fairlx better for everyone. We appreciate your time and effort! 🙏
