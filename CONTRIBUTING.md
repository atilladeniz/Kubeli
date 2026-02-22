# Contributing to Kubeli

Thank you for your interest in contributing to Kubeli! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all experience levels.

## AI Usage Policy

We welcome AI-assisted development but require **Smart Coding over Vibe Coding**. Please read our [AI Usage Policy](AI_POLICY.md) before contributing. Key points:

- You are 100% responsible for every line of code you submit
- AI-generated code must be reviewed, understood, and refactored to match our standards
- Use our existing patterns: shadcn/ui components, Zustand stores, Tauri commands

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Rust** 1.70+
- **npm** (default) or pnpm
- **macOS** 10.15+ (for development and testing)

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Kubeli.git
   cd Kubeli
   ```

2. **Install dependencies**
   ```bash
   make install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration (optional for development)
   ```

4. **Start development server**
   ```bash
   make dev
   ```

### Project Structure

```
Kubeli/
├── src/                    # Vite frontend (React/TypeScript)
│   ├── main.tsx            # Frontend bootstrap
│   ├── App.tsx             # App shell
│   ├── components/         # React components
│   └── lib/                # Hooks, stores, tauri commands, utilities
├── src-tauri/              # Tauri backend (Rust)
│   └── src/
│       ├── commands/       # Tauri command handlers
│       ├── k8s/            # Kubernetes client logic
│       ├── ai/             # AI assistant integration
│       └── mcp/            # MCP server
└── web/                    # Landing page (Astro)
```

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/atilladeniz/Kubeli/issues)
2. If not, create a new issue using the Bug Report template
3. Include as much detail as possible (OS, Kubeli version, K8s provider, steps to reproduce)

### Suggesting Features

1. Check [Issues](https://github.com/atilladeniz/Kubeli/issues) for existing feature requests
2. Create a new issue using the Feature Request template
3. Describe the problem and proposed solution clearly

### Submitting Pull Requests

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes**
   - Follow the existing code style
   - Write meaningful commit messages
   - Add tests if applicable

3. **Test your changes**
   ```bash
   make lint      # Run linter
   make check     # TypeScript type check
   make dev       # Test manually
   ```

4. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a Pull Request on GitHub.

## Development Guidelines

### Code Style

**TypeScript/React (Frontend)**
- Use functional components with hooks
- Follow existing patterns in `src/components`
- Use Zustand for state management
- Use the existing UI components from `src/components/ui`

**Rust (Backend)**
- Follow Rust conventions
- Use `cargo fmt` for formatting
- Use `cargo clippy` for linting
- Handle errors properly with Result types

### Commit Messages

Use clear, descriptive commit messages:
- `feat: add helm release deletion`
- `fix: resolve port forward connection issue`
- `docs: update README with new features`
- `refactor: simplify cluster connection logic`

### Testing

- Test on macOS with Apple Silicon
- Test with at least one Kubernetes cluster (Minikube is fine)
- Verify both light and dark themes work

## Building for Production

```bash
# Build the app
make build

# The DMG will be in src-tauri/target/release/bundle/dmg/
```

## Need Help?

- Check the [README](README.md) for basic usage
- Open a [Discussion](https://github.com/atilladeniz/Kubeli/discussions) for questions
- Review existing [Issues](https://github.com/atilladeniz/Kubeli/issues) and [PRs](https://github.com/atilladeniz/Kubeli/pulls)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
