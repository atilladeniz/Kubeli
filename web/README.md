# Kubeli Landing Page

The marketing and documentation website for Kubeli, built with [Astro](https://astro.build/).

## Tech Stack

- **Framework**: Astro
- **Package Manager**: Bun
- **Styling**: Tailwind CSS

## Development

```bash
# Install dependencies
cd web && bun install

# Start dev server (localhost:4321)
bun dev

# Build for production
bun build

# Preview production build
bun preview
```

Or from the project root:

```bash
make astro        # Start dev server
make astro-build  # Build for production
make astro-public # Build and deploy to FTP
```

## Project Structure

```
web/
├── public/             # Static assets (fonts, images, icons)
├── src/
│   ├── components/     # Reusable Astro components
│   ├── layouts/        # Page layouts
│   └── pages/          # Routes
│       ├── index.astro       # Homepage
│       ├── screenshots.astro # Screenshots gallery
│       ├── changelog.mdx     # Changelog page
│       ├── compare/          # Comparison pages
│       └── 404.astro         # Not found page
└── package.json
```
