# Kubeli - Kubernetes Management Desktop App
# Makefile for common development tasks

.PHONY: dev build clean install test lint format check tauri-dev tauri-build web-dev dmg build-dmg build-universal deploy deploy-web minikube-start minikube-stop minikube-status minikube-setup-samples minikube-clean-samples astro astro-build astro-public github-release build-deploy generate-changelog sbom sbom-npm sbom-rust

# Default target
.DEFAULT_GOAL := help

# Colors for output
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RESET := \033[0m

## Development

dev: ## Start full Tauri development environment
	npm run tauri:dev

web-dev: ## Start Next.js web dev server only (no Tauri)
	npm run dev

tauri-dev: ## Start Tauri development (alias for dev)
	npm run tauri:dev

## Building

build: ## Build production Tauri app
	@CURRENT_VERSION=$$(node -e "console.log(require('./package.json').version)"); \
	echo "$(CYAN)Current version: $(GREEN)$$CURRENT_VERSION$(RESET)"; \
	echo ""; \
	printf "$(YELLOW)Do you want to bump the version before building? [y/N]: $(RESET)"; \
	read answer; \
	if [ "$$answer" = "y" ] || [ "$$answer" = "Y" ] || [ "$$answer" = "yes" ] || [ "$$answer" = "Yes" ]; then \
		echo ""; \
		$(MAKE) version-bump; \
		echo ""; \
	fi; \
	if [ -f .env ]; then \
		set -a; source .env; set +a; \
	fi; \
	if [ -z "$$TAURI_SIGNING_PRIVATE_KEY" ] && [ -f ~/.tauri/kubeli.key ]; then \
		export TAURI_SIGNING_PRIVATE_KEY="$$(cat ~/.tauri/kubeli.key)"; \
	fi; \
	if [ -z "$$TAURI_SIGNING_PRIVATE_KEY_PASSWORD" ]; then \
		export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""; \
	fi; \
	echo "$(CYAN)Starting build...$(RESET)"; \
	npm run tauri:build

web-build: ## Build Next.js web app only
	npm run build

tauri-build: ## Build Tauri app (alias for build)
	npm run tauri:build

build-universal: ## Build Universal Binary (Apple Silicon + Intel)
	@echo "$(CYAN)Building Universal Binary for macOS...$(RESET)"
	@echo "$(YELLOW)Step 1: Building for Apple Silicon (arm64)...$(RESET)"
	@cd src-tauri && cargo build --release --target aarch64-apple-darwin
	@echo "$(YELLOW)Step 2: Building for Intel (x86_64)...$(RESET)"
	@cd src-tauri && cargo build --release --target x86_64-apple-darwin
	@echo "$(YELLOW)Step 3: Creating Universal Binary...$(RESET)"
	@mkdir -p src-tauri/target/universal/release
	@lipo -create \
		src-tauri/target/aarch64-apple-darwin/release/kubeli \
		src-tauri/target/x86_64-apple-darwin/release/kubeli \
		-output src-tauri/target/universal/release/kubeli
	@echo "$(YELLOW)Step 4: Copying Universal Binary to bundle...$(RESET)"
	@cp src-tauri/target/universal/release/kubeli src-tauri/target/release/kubeli
	@echo "$(YELLOW)Step 5: Rebuilding bundle with Universal Binary...$(RESET)"
	@npm run tauri:build -- --bundles app
	@echo "$(GREEN)✓ Universal Binary created successfully$(RESET)"
	@file src-tauri/target/release/kubeli

dmg: ## Create DMG from built .app bundle
	@echo "$(CYAN)Creating DMG from .app bundle...$(RESET)"
	@APP_PATH="src-tauri/target/release/bundle/macos/Kubeli.app"; \
	if [ ! -d "$$APP_PATH" ]; then \
		echo "$(YELLOW)Error: App bundle not found at $$APP_PATH$(RESET)"; \
		echo "$(YELLOW)Please run 'make build' first$(RESET)"; \
		exit 1; \
	fi; \
	BINARY_PATH="$$APP_PATH/Contents/MacOS/kubeli"; \
	if [ -f "$$BINARY_PATH" ]; then \
		ARCH=$$(file "$$BINARY_PATH" | grep -o "arm64\|x86_64\|universal" | head -1 || echo "unknown"); \
		if echo "$$ARCH" | grep -q "universal\|arm64.*x86_64"; then \
			DMG_NAME="Kubeli_0.1.0_universal.dmg"; \
		elif echo "$$ARCH" | grep -q "arm64"; then \
			DMG_NAME="Kubeli_0.1.0_aarch64.dmg"; \
		elif echo "$$ARCH" | grep -q "x86_64"; then \
			DMG_NAME="Kubeli_0.1.0_x86_64.dmg"; \
		else \
			DMG_NAME="Kubeli_0.1.0.dmg"; \
		fi; \
	else \
		DMG_NAME="Kubeli_0.1.0.dmg"; \
	fi; \
	DMG_PATH="src-tauri/target/release/bundle/dmg/$$DMG_NAME"; \
	mkdir -p "$$(dirname $$DMG_PATH)"; \
	echo "$(CYAN)Creating DMG: $$DMG_PATH$(RESET)"; \
	hdiutil create -volname "Kubeli" -srcfolder "$$APP_PATH" -ov -format UDZO "$$DMG_PATH"; \
	if [ $$? -eq 0 ]; then \
		echo "$(GREEN)✓ DMG created successfully: $$DMG_PATH$(RESET)"; \
	else \
		echo "$(YELLOW)✗ Failed to create DMG$(RESET)"; \
		exit 1; \
	fi

build-dmg: build dmg ## Build app and create DMG

build-universal-dmg: build-universal dmg ## Build Universal Binary and create DMG

## Astro Landing Page (web/)

astro: ## Start Astro dev server for landing page
	@echo "$(CYAN)Starting Astro dev server...$(RESET)"
	cd web && bun run dev

astro-build: ## Build Astro landing page
	@echo "$(CYAN)Building Astro landing page...$(RESET)"
	@if [ ! -d "web/node_modules" ]; then \
		echo "$(YELLOW)Installing web dependencies...$(RESET)"; \
		cd web && bun install; \
	fi
	cd web && bun run build
	@echo "$(GREEN)✓ Astro build complete (web/dist/)$(RESET)"

astro-public: astro-build ## Build and deploy landing page to FTP
	@echo "$(CYAN)Deploying Astro landing page to FTP...$(RESET)"
	@if [ -f .env ]; then \
		set -a; source .env; set +a; \
	fi; \
	if [ ! -d "web/dist" ]; then \
		echo "$(YELLOW)Error: web/dist not found. Run 'make astro-build' first.$(RESET)"; \
		exit 1; \
	fi; \
	echo "$(CYAN)Uploading to $$DEPLOY_LANDING_URL...$(RESET)"; \
	cd web/dist && for file in $$(find . -type f); do \
		echo "  Uploading: $$file"; \
		curl -s --ftp-create-dirs -T "$$file" --user "$$FTP_USER:$$FTP_PASSWORD" "ftp://$$FTP_HOST$$DEPLOY_LANDING_FTP_PATH/$$file"; \
	done; \
	echo "$(GREEN)✓ Landing page deployed to https://$$DEPLOY_LANDING_URL$(RESET)"

deploy-web: ## Deploy DMG to landing page for direct download
	@echo "$(CYAN)Deploying DMG to landing page...$(RESET)"
	@if [ -f .env ]; then \
		set -a; source .env; set +a; \
	fi; \
	DMG_DIR="src-tauri/target/release/bundle/dmg"; \
	DMG_FILE=$$(ls $$DMG_DIR/*.dmg 2>/dev/null | head -1); \
	if [ -z "$$DMG_FILE" ]; then \
		echo "$(YELLOW)Error: No DMG found in $$DMG_DIR. Run 'make build' first.$(RESET)"; \
		exit 1; \
	fi; \
	DMG_NAME=$$(basename "$$DMG_FILE"); \
	echo "$(CYAN)Uploading $$DMG_NAME to $$DEPLOY_LANDING_URL...$(RESET)"; \
	curl -# --ftp-create-dirs -T "$$DMG_FILE" --user "$$FTP_USER:$$FTP_PASSWORD" "ftp://$$FTP_HOST$$DEPLOY_LANDING_FTP_PATH/$$DMG_NAME"; \
	curl -# --ftp-create-dirs -T "$$DMG_FILE" --user "$$FTP_USER:$$FTP_PASSWORD" "ftp://$$FTP_HOST$$DEPLOY_LANDING_FTP_PATH/Kubeli_latest.dmg"; \
	echo "$(GREEN)✓ DMG deployed:$(RESET)"; \
	echo "  - https://$$DEPLOY_LANDING_URL/$$DMG_NAME"; \
	echo "  - https://$$DEPLOY_LANDING_URL/Kubeli_latest.dmg"

## Deployment

deploy: ## Deploy update files to FTP server
	@echo "$(CYAN)Deploying update files to FTP...$(RESET)"
	@if [ -f .env ]; then \
		set -a; source .env; set +a; \
	fi; \
	VERSION=$$(node -e "console.log(require('./package.json').version)"); \
	BUNDLE_DIR="src-tauri/target/release/bundle/macos"; \
	if [ ! -f "$$BUNDLE_DIR/Kubeli.app.tar.gz" ]; then \
		echo "$(YELLOW)Error: Update bundle not found. Run 'make build' first.$(RESET)"; \
		exit 1; \
	fi; \
	echo "$(CYAN)Creating latest.json...$(RESET)"; \
	SIG=$$(cat "$$BUNDLE_DIR/Kubeli.app.tar.gz.sig"); \
	DATE=$$(date -u +"%Y-%m-%dT%H:%M:%SZ"); \
	echo "{\n  \"version\": \"$$VERSION\",\n  \"notes\": \"Kubeli v$$VERSION\",\n  \"pub_date\": \"$$DATE\",\n  \"platforms\": {\n    \"darwin-aarch64\": {\n      \"signature\": \"$$SIG\",\n      \"url\": \"https://$$DEPLOY_API_URL/Kubeli_$$VERSION.app.tar.gz\"\n    },\n    \"darwin-x86_64\": {\n      \"signature\": \"$$SIG\",\n      \"url\": \"https://$$DEPLOY_API_URL/Kubeli_$$VERSION.app.tar.gz\"\n    }\n  }\n}" > "$$BUNDLE_DIR/latest.json"; \
	echo "$(GREEN)✓ latest.json created$(RESET)"; \
	echo "$(CYAN)Uploading to FTP...$(RESET)"; \
	curl -v -T "$$BUNDLE_DIR/Kubeli.app.tar.gz" --user "$$FTP_USER:$$FTP_PASSWORD" "ftp://$$FTP_HOST$$DEPLOY_API_FTP_PATH/Kubeli_$$VERSION.app.tar.gz" --ftp-create-dirs; \
	curl -v -T "$$BUNDLE_DIR/Kubeli.app.tar.gz.sig" --user "$$FTP_USER:$$FTP_PASSWORD" "ftp://$$FTP_HOST$$DEPLOY_API_FTP_PATH/Kubeli_$$VERSION.app.tar.gz.sig" --ftp-create-dirs; \
	curl -v -T "$$BUNDLE_DIR/latest.json" --user "$$FTP_USER:$$FTP_PASSWORD" "ftp://$$FTP_HOST$$DEPLOY_API_FTP_PATH/latest.json" --ftp-create-dirs; \
	echo "$(GREEN)✓ Files uploaded to $$DEPLOY_API_URL$(RESET)"; \
	echo "$(GREEN)✓ Update URL: https://$$DEPLOY_API_URL/latest.json$(RESET)"

build-deploy: build deploy generate-changelog sbom astro-public github-release ## Build, deploy, and create GitHub release

generate-changelog: ## Generate changelog using Claude Code CLI
	@echo "$(CYAN)Generating changelog with Claude Code CLI...$(RESET)"
	@node scripts/generate-changelog.js
	@if [ -f .release-notes.md ]; then \
		echo "$(GREEN)✓ Changelog files updated$(RESET)"; \
	fi

github-release: ## Create GitHub release with DMG and SBOMs
	@VERSION=$$(node -e "console.log(require('./package.json').version)"); \
	DMG_FILE="src-tauri/target/release/bundle/dmg/Kubeli_$${VERSION}_aarch64.dmg"; \
	if [ ! -f "$$DMG_FILE" ]; then \
		echo "$(YELLOW)Error: DMG not found at $$DMG_FILE$(RESET)"; \
		exit 1; \
	fi; \
	echo "$(CYAN)Creating GitHub release v$$VERSION...$(RESET)"; \
	SBOM_FILES=""; \
	if [ -f sbom-npm.json ]; then SBOM_FILES="$$SBOM_FILES sbom-npm.json"; fi; \
	if [ -f sbom-rust.json ]; then SBOM_FILES="$$SBOM_FILES sbom-rust.json"; fi; \
	if gh release view "v$$VERSION" --repo atilladeniz/Kubeli > /dev/null 2>&1; then \
		echo "$(YELLOW)Release v$$VERSION already exists, updating notes...$(RESET)"; \
		if [ -f .release-notes.md ]; then \
			gh release edit "v$$VERSION" --repo atilladeniz/Kubeli --notes-file .release-notes.md; \
			echo "$(GREEN)✓ Release notes updated$(RESET)"; \
		fi; \
		if [ -n "$$SBOM_FILES" ]; then \
			gh release upload "v$$VERSION" --repo atilladeniz/Kubeli --clobber $$SBOM_FILES; \
			echo "$(GREEN)✓ SBOMs uploaded$(RESET)"; \
		fi; \
	else \
		NOTES="See [CHANGELOG.md](https://github.com/atilladeniz/Kubeli/blob/main/CHANGELOG.md) for details."; \
		if [ -f .release-notes.md ]; then \
			NOTES=$$(cat .release-notes.md); \
		fi; \
		gh release create "v$$VERSION" \
			--repo atilladeniz/Kubeli \
			--title "Kubeli v$$VERSION" \
			--notes "$$NOTES" \
			"$$DMG_FILE" $$SBOM_FILES; \
		echo "$(GREEN)✓ GitHub release v$$VERSION created$(RESET)"; \
	fi; \
	rm -f .release-notes.md

## Code Quality

lint: ## Run ESLint
	npm run lint

format: ## Format code with Prettier
	npx prettier --write "src/**/*.{ts,tsx,js,jsx,json,css}"

check: ## Run type checking
	npm run typecheck

rust-check: ## Check Rust code
	cd src-tauri && cargo check

rust-fmt: ## Format Rust code
	cd src-tauri && cargo fmt

rust-lint: ## Lint Rust code with clippy
	cd src-tauri && cargo clippy

## Testing

test: ## Run all tests
	npm run test

test-watch: ## Run tests in watch mode
	npm run test:watch

rust-test: ## Run Rust tests
	cd src-tauri && cargo test

## Cleanup

clean: ## Clean build artifacts
	rm -rf .next
	rm -rf out
	rm -rf node_modules/.cache
	cd src-tauri && cargo clean

clean-all: clean ## Deep clean including node_modules
	rm -rf node_modules
	rm -rf src-tauri/target

## Installation

install: ## Install all dependencies
	npm install
	cd src-tauri && cargo fetch

reinstall: clean-all install ## Clean and reinstall all dependencies

## Kubernetes (for local development)

minikube-start: ## Start minikube cluster with addons and sample resources
	@echo "$(CYAN)Starting minikube...$(RESET)"
	@minikube start
	@echo "$(CYAN)Enabling metrics-server addon...$(RESET)"
	@minikube addons enable metrics-server
	@echo "$(CYAN)Enabling ingress addon...$(RESET)"
	@minikube addons enable ingress
	@echo "$(CYAN)Waiting for ingress controller to be ready...$(RESET)"
	@kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s 2>/dev/null || true
	@echo "$(CYAN)Applying sample Kubernetes resources...$(RESET)"
	@$(MAKE) minikube-setup-samples
	@echo "$(GREEN)✓ Minikube ready with sample resources$(RESET)"

minikube-setup-samples: ## Apply sample Kubernetes resources for testing
	@echo "$(CYAN)Applying sample manifests from .dev/k8s-samples/...$(RESET)"
	@if [ -d ".dev/k8s-samples" ]; then \
		kubectl apply -f .dev/k8s-samples/01-namespace.yaml 2>/dev/null || true; \
		sleep 1; \
		kubectl apply -f .dev/k8s-samples/ 2>&1 | grep -v "unchanged" || true; \
		echo "$(GREEN)✓ Sample resources applied$(RESET)"; \
		echo ""; \
		echo "$(CYAN)Resources created in kubeli-demo namespace:$(RESET)"; \
		echo "  - Deployments: demo-web (3), demo-api (2)"; \
		echo "  - StatefulSet: demo-db"; \
		echo "  - DaemonSet: demo-log-collector"; \
		echo "  - Job: demo-migration, CronJob: demo-cleanup"; \
		echo "  - Ingresses: demo-web-ingress, demo-secure-ingress"; \
		echo "  - NetworkPolicies: 4 policies"; \
		echo "  - HPAs: demo-web-hpa, demo-api-hpa (v2)"; \
		echo "  - PDBs: demo-web-pdb, demo-api-pdb"; \
		echo "  - PV/PVC: demo-pv-1, demo-pv-2, demo-pvc"; \
		echo "  - RBAC: Roles, RoleBindings, ServiceAccount"; \
		echo "  - Quotas: ResourceQuota, LimitRange"; \
	else \
		echo "$(YELLOW)Warning: .dev/k8s-samples/ directory not found$(RESET)"; \
	fi

minikube-clean-samples: ## Remove sample Kubernetes resources
	@echo "$(CYAN)Removing sample resources...$(RESET)"
	@kubectl delete namespace kubeli-demo --ignore-not-found=true
	@kubectl delete pv demo-pv-1 demo-pv-2 --ignore-not-found=true
	@kubectl delete ingressclass demo-ingress-class --ignore-not-found=true
	@echo "$(GREEN)✓ Sample resources removed$(RESET)"

minikube-stop: ## Stop minikube cluster
	minikube stop

minikube-status: ## Check minikube status
	@minikube status
	@echo ""
	@echo "$(CYAN)Sample resources status:$(RESET)"
	@kubectl get pods -n kubeli-demo --no-headers 2>/dev/null | wc -l | xargs -I{} echo "  Pods in kubeli-demo: {}" || echo "  kubeli-demo namespace not found"

k8s-pods: ## List all pods across namespaces
	kubectl get pods -A

k8s-services: ## List all services across namespaces
	kubectl get services -A

k8s-namespaces: ## List all namespaces
	kubectl get namespaces

## Security / SBOM

sbom-npm: ## Generate npm SBOM (CycloneDX JSON)
	npm run sbom:npm

sbom-rust: ## Generate Rust SBOM (CycloneDX JSON)
	cd src-tauri && cargo cyclonedx --format json --spec-version 1.5 --no-build-deps --override-filename sbom-rust
	mv src-tauri/sbom-rust.json sbom-rust.json

sbom: sbom-npm sbom-rust ## Generate both SBOM files

## Utilities

version-bump: ## Bump version interactively (or use TYPE=patch|minor|major)
	@TYPE="$(TYPE)"; \
	if [ -z "$$TYPE" ]; then \
		CURRENT_VERSION=$$(node -e "console.log(require('./package.json').version)"); \
		echo "$(CYAN)Current version: $(GREEN)$$CURRENT_VERSION$(RESET)"; \
		echo ""; \
		echo "$(YELLOW)Select version bump type:$(RESET)"; \
		echo "  $(GREEN)1$(RESET)) patch  (e.g., 0.1.5 → 0.1.6)"; \
		echo "  $(GREEN)2$(RESET)) minor  (e.g., 0.1.5 → 0.2.0)"; \
		echo "  $(GREEN)3$(RESET)) major  (e.g., 0.1.5 → 1.0.0)"; \
		echo ""; \
		printf "$(CYAN)Enter choice [1-3]: $(RESET)"; \
		read choice; \
		case $$choice in \
			1) TYPE=patch ;; \
			2) TYPE=minor ;; \
			3) TYPE=major ;; \
			*) echo "$(YELLOW)Invalid choice. Exiting.$(RESET)"; exit 1 ;; \
		esac; \
	else \
		case $$TYPE in \
			1|patch) TYPE=patch ;; \
			2|minor) TYPE=minor ;; \
			3|major) TYPE=major ;; \
			*) echo "$(YELLOW)Error: TYPE must be 1/patch, 2/minor, or 3/major$(RESET)"; exit 1 ;; \
		esac; \
	fi; \
	echo "$(CYAN)Bumping version ($$TYPE)...$(RESET)"; \
	OLD_VERSION=$$(node -e "console.log(require('./package.json').version)"); \
	npm version $$TYPE --no-git-tag-version; \
	NEW_VERSION=$$(node -e "console.log(require('./package.json').version)"); \
	echo "$(CYAN)Updating Cargo.toml...$(RESET)"; \
	sed -i '' "s/version = \"$$OLD_VERSION\"/version = \"$$NEW_VERSION\"/" src-tauri/Cargo.toml; \
	echo "$(CYAN)Updating tauri.conf.json...$(RESET)"; \
	sed -i '' "s/\"version\": \"$$OLD_VERSION\"/\"version\": \"$$NEW_VERSION\"/" src-tauri/tauri.conf.json; \
	echo "$(CYAN)Updating footer in page.tsx...$(RESET)"; \
	sed -i '' "s/Kubeli v$$OLD_VERSION/Kubeli v$$NEW_VERSION/g" src/app/page.tsx; \
	echo "$(GREEN)✓ Version bumped from $$OLD_VERSION to $$NEW_VERSION$(RESET)"; \
	echo "$(CYAN)Updated files:$(RESET)"; \
	echo "  - package.json"; \
	echo "  - src-tauri/Cargo.toml"; \
	echo "  - src-tauri/tauri.conf.json"; \
	echo "  - src/app/page.tsx (footer)"

deps: ## Show outdated dependencies
	npm outdated || true
	cd src-tauri && cargo outdated 2>/dev/null || echo "Install cargo-outdated: cargo install cargo-outdated"

update-deps: ## Update all dependencies
	npm update
	cd src-tauri && cargo update

## Help

help: ## Show this help message
	@echo "$(CYAN)Kubeli Development Commands$(RESET)"
	@echo ""
	@echo "$(YELLOW)Usage:$(RESET) make [target]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(RESET) %s\n", $$1, $$2}'
