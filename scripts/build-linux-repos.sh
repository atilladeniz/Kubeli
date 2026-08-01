#!/usr/bin/env bash
#
# Builds the signed APT and DNF repositories that Linux users install from.
#
# Both are rebuilt from scratch on every release, with the packages pulled
# from the GitHub releases rather than from whatever the publish host happens
# to hold. FTP offers no reliable way to list or diff remote state, so
# reconstructing from the releases keeps the result reproducible and makes a
# failed upload recoverable by rerunning.
#
# Usage: build-linux-repos.sh <output-dir> [max-releases]
set -euo pipefail

MAX_RELEASES="${2:-20}"

: "${GPG_KEY_ID:?GPG_KEY_ID must be set}"
: "${REPO_SLUG:=atilladeniz/Kubeli}"

# Absolute, because the APT stage has to cd into its own tree and every path
# derived here would otherwise resolve against the new working directory.
mkdir -p "${1:?output directory required}"
OUT_DIR="$(cd "$1" && pwd)"

APT_DIR="$OUT_DIR/apt"
RPM_DIR="$OUT_DIR/rpm"
PKG_DIR="$OUT_DIR/.packages"

rm -rf "$OUT_DIR"
mkdir -p "$APT_DIR/pool/main" "$APT_DIR/dists/stable/main/binary-amd64" "$RPM_DIR" "$PKG_DIR"

# Drafts are included on purpose: the release being published is still a draft
# while this runs, and excluding drafts would leave the newest version out of
# the very repository built to ship it.
echo "Collecting packages from the last $MAX_RELEASES releases..."
tags=$(gh release list --repo "$REPO_SLUG" --limit "$MAX_RELEASES" \
  --json tagName --jq '.[].tagName')

for tag in $tags; do
  gh release download "$tag" --repo "$REPO_SLUG" \
    --pattern '*.deb' --pattern '*.rpm' --dir "$PKG_DIR" --skip-existing 2>/dev/null || true
done

deb_count=$(find "$PKG_DIR" -name '*.deb' | wc -l | tr -d ' ')
rpm_count=$(find "$PKG_DIR" -name '*.rpm' | wc -l | tr -d ' ')
echo "Found $deb_count deb and $rpm_count rpm packages"

# A repo with no packages would publish as an empty but valid index, silently
# removing every version from users' package managers.
if [ "$deb_count" -eq 0 ] || [ "$rpm_count" -eq 0 ]; then
  echo "Refusing to publish: expected at least one deb and one rpm" >&2
  exit 1
fi

# ---------------------------------------------------------------- APT --------
echo "Building APT repository..."
cp "$PKG_DIR"/*.deb "$APT_DIR/pool/main/"
cd "$APT_DIR"

apt-ftparchive packages pool/main > dists/stable/main/binary-amd64/Packages
gzip -kf dists/stable/main/binary-amd64/Packages

# ValidTime is 90 days: long enough to survive a gap between releases, which
# would otherwise expire the repository for every user at once, and short
# enough to bound how long a stale signed index stays replayable.
cat > /tmp/apt-release.conf <<'CONF'
APT::FTPArchive::Release::Origin "Kubeli";
APT::FTPArchive::Release::Label "Kubeli";
APT::FTPArchive::Release::Suite "stable";
APT::FTPArchive::Release::Codename "stable";
APT::FTPArchive::Release::Architectures "amd64";
APT::FTPArchive::Release::Components "main";
APT::FTPArchive::Release::Description "Kubeli - Kubernetes Management Desktop App";
APT::FTPArchive::Release::ValidTime "7776000";
CONF
apt-ftparchive -c /tmp/apt-release.conf release dists/stable > dists/stable/Release

# InRelease (inline signature) is what modern apt fetches; Release.gpg is kept
# for older clients that still ask for the detached form.
gpg --batch --yes --local-user "$GPG_KEY_ID" \
  --clearsign -o dists/stable/InRelease dists/stable/Release
gpg --batch --yes --local-user "$GPG_KEY_ID" \
  -abs -o dists/stable/Release.gpg dists/stable/Release

# Binary, not ASCII-armored: apt requires the dearmored form under
# /usr/share/keyrings, and an armored file there fails with NO_PUBKEY.
gpg --export "$GPG_KEY_ID" > "$APT_DIR/kubeli-archive-keyring.gpg"

# ---------------------------------------------------------------- RPM --------
echo "Building RPM repository..."
cp "$PKG_DIR"/*.rpm "$RPM_DIR/"

cat > "$HOME/.rpmmacros" <<MACROS
%_signature gpg
%_gpg_name $GPG_KEY_ID
%__gpg /usr/bin/gpg
%_gpg_sign_cmd_extra_args --batch --pinentry-mode loopback
MACROS

# Re-signing an already-signed package is a no-op, so this stays correct when
# older releases are reprocessed on later runs.
rpm --addsign "$RPM_DIR"/*.rpm >/dev/null

createrepo_c --quiet "$RPM_DIR"
gpg --batch --yes --local-user "$GPG_KEY_ID" \
  --detach-sign --armor "$RPM_DIR/repodata/repomd.xml"

# dnf reads the armored form, so the RPM side ships the opposite encoding
# from APT's keyring on purpose.
gpg --armor --export "$GPG_KEY_ID" > "$RPM_DIR/RPM-GPG-KEY-kubeli"

echo "Done: $(find "$OUT_DIR" -type f | wc -l | tr -d ' ') files"
