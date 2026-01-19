## ADDED Requirements

### Requirement: Documentation Website

The system SHALL provide a documentation website built with Nextra for user guides and tutorials.

#### Scenario: Documentation Development Server

- **WHEN** a developer runs `make docs-dev`
- **THEN** the Nextra development server starts
- **AND** documentation is accessible at localhost:3001

#### Scenario: Documentation Build

- **WHEN** a developer runs `make docs-build`
- **THEN** a static export of the documentation is generated
- **AND** the output is in the `docs/out/` directory

### Requirement: Getting Started Guide

The documentation SHALL include a comprehensive Getting Started section.

#### Scenario: Installation Guide

- **GIVEN** a user visits the documentation
- **WHEN** they navigate to Getting Started > Installation
- **THEN** they see platform-specific installation instructions
- **AND** instructions for macOS, Linux, and Windows are provided

#### Scenario: First Cluster Connection

- **GIVEN** a user has installed Kubeli
- **WHEN** they follow the First Cluster guide
- **THEN** they can connect to their kubeconfig clusters
- **AND** step-by-step screenshots/GIFs are provided

### Requirement: Feature Documentation

Each major feature SHALL have dedicated documentation.

#### Scenario: Feature Pages

- **GIVEN** a user wants to learn about a feature
- **WHEN** they navigate to the Features section
- **THEN** they find documentation for:
  - Cluster Management
  - Resource Viewing
  - Visualization Diagram
  - Multi-cluster Support

### Requirement: Tutorials Section

The documentation SHALL include interactive tutorials.

#### Scenario: Tutorial Index

- **GIVEN** a user visits the Tutorials section
- **WHEN** they view the index page
- **THEN** they see a list of available tutorials with descriptions

#### Scenario: Tutorial Content

- **GIVEN** a user follows a tutorial
- **WHEN** they complete the steps
- **THEN** they have accomplished a specific task
- **AND** media (screenshots, GIFs) support each step

### Requirement: Search Functionality

The documentation SHALL support full-text search.

#### Scenario: Search Query

- **GIVEN** a user is on any documentation page
- **WHEN** they use the search feature
- **THEN** relevant documentation pages are returned
- **AND** search highlights matching terms

### Requirement: Dark Mode Support

The documentation SHALL support dark mode.

#### Scenario: Theme Toggle

- **GIVEN** a user prefers dark mode
- **WHEN** they toggle the theme
- **THEN** the documentation switches to dark mode
- **AND** the preference is persisted

### Requirement: Automated Deployment

Documentation updates SHALL be automatically deployed.

#### Scenario: GitHub Actions Deployment

- **WHEN** changes to `docs/` are pushed to main branch
- **THEN** GitHub Actions builds the documentation
- **AND** deploys to GitHub Pages
