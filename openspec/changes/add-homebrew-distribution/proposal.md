# Change: Add Homebrew Distribution

## Why
Users expect to install macOS applications via Homebrew (`brew install --cask kubeli`). Currently,
Kubeli can only be downloaded manually from the landing page or GitHub releases. Adding a Homebrew
Cask will improve discoverability, simplify installation, and enable automatic updates via
`brew upgrade`.

## What Changes
- Create a Homebrew Tap repository (`homebrew-kubeli` or `homebrew-tap`)
- Add Cask formula for Kubeli with SHA256 verification
- Integrate Cask update into release workflow
- Add `make brew-update` command for local Cask updates
- Document installation via Homebrew in README

## Distribution Strategy

### Option A: Personal Tap (Recommended for now)
```bash
brew tap atilladeniz/kubeli
brew install --cask kubeli
```
- Full control over formula
- No review process
- Easy to maintain

### Option B: Homebrew Cask Core (Future)
```bash
brew install --cask kubeli
```
- Requires popularity threshold (~75 GitHub stars)
- Goes through review process
- More discoverable

## Cask Formula Structure
```ruby
cask "kubeli" do
  version "0.2.41"
  sha256 "abc123..."

  url "https://github.com/atilladeniz/Kubeli/releases/download/v#{version}/Kubeli_#{version}_aarch64.dmg",
      verified: "github.com/atilladeniz/Kubeli/"
  name "Kubeli"
  desc "Modern Kubernetes management desktop application"
  homepage "https://kubeli.app"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true
  depends_on macos: ">= :catalina"

  app "Kubeli.app"

  zap trash: [
    "~/Library/Application Support/com.kubeli",
    "~/Library/Caches/com.kubeli",
    "~/Library/Preferences/com.kubeli.plist",
  ]
end
```

## Future: Windows Distribution
After Homebrew is established, similar distribution can be added for Windows:
- **winget** (Windows Package Manager) - Microsoft's official package manager
- **Chocolatey** - Community package manager
- **Scoop** - Developer-focused package manager

## Impact
- Affected specs: distribution
- Affected code:
  - New repository: `homebrew-kubeli/`
  - `.github/workflows/release.yml` (Cask update step)
  - `Makefile` (brew-update target)
  - `README.md` (installation instructions)
  - `web/` (landing page installation section)
