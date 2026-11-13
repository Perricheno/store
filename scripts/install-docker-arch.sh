#!/usr/bin/env bash
set -euo pipefail
cat <<'TEXT'
On Arch Linux, an administrator can run:
  sudo pacman -S docker docker-compose
  sudo systemctl enable --now docker
  sudo usermod -aG docker "$USER"
Then sign out and back in for group membership. Docker group grants root-equivalent access.
This script does not run privileged commands or perform a system upgrade.
TEXT
