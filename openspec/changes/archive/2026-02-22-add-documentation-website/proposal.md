# Proposal: Documentation Website with Nextra

## Summary

Add a comprehensive documentation website using Nextra (Next.js-based documentation framework) to provide user guides, tutorials, API documentation, and getting started materials for Kubeli.

## Motivation

Community feedback indicates strong interest in:
- Getting started tutorials
- Video/GIF demonstrations of features
- Comprehensive documentation for all features

A dedicated documentation site will improve user onboarding and reduce support burden.

## Approach

Use **Nextra** for the documentation website:
- Built on Next.js (consistent with main app)
- MDX support for interactive documentation
- Built-in search, dark mode, i18n support
- Automatic sidebar generation from file structure
- Easy deployment to GitHub Pages or Vercel

## Scope

### In Scope
- Nextra documentation site setup in `docs/` directory
- Getting Started guide
- Feature documentation (Clusters, Resources, Visualization)
- Tutorial pages with embedded GIFs/videos
- Search functionality
- Dark/light mode support
- Automatic deployment via GitHub Actions

### Out of Scope
- Video production (placeholder structure only)
- API reference generation (future enhancement)
- Localization (future enhancement)

## Technical Details

### Directory Structure
```
docs/
├── pages/
│   ├── index.mdx          # Landing page
│   ├── getting-started/
│   │   ├── installation.mdx
│   │   ├── first-cluster.mdx
│   │   └── quick-tour.mdx
│   ├── features/
│   │   ├── clusters.mdx
│   │   ├── resources.mdx
│   │   ├── visualization.mdx
│   │   └── multi-cluster.mdx
│   └── tutorials/
│       ├── index.mdx
│       ├── deploy-app.mdx
│       └── troubleshooting.mdx
├── theme.config.tsx
├── next.config.mjs
└── package.json
```

### Dependencies
- `nextra`
- `nextra-theme-docs`
- `next`
- `react`, `react-dom`

## Impact

- **User Experience**: Significantly improved onboarding
- **Community**: Better self-service documentation
- **Maintenance**: MDX format easy to update

## Timeline

Phase 1: Basic setup and Getting Started guide
Phase 2: Feature documentation
Phase 3: Tutorials with media integration

## Related

- Reddit feedback requesting tutorials/videos
- SBOM documentation (can be included in docs site)
