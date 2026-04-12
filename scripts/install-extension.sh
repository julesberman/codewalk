#!/usr/bin/env bash
set -euo pipefail

OWNER="${CODEWALK_GITHUB_OWNER:-julesberman}"
REPO="${CODEWALK_GITHUB_REPO:-codewalk}"
REF="${1:-${CODEWALK_GITHUB_REF:-main}}"
RAW_BASE_URL="${CODEWALK_RAW_BASE_URL:-https://raw.githubusercontent.com/${OWNER}/${REPO}/${REF}}"
VSIX_URL="${CODEWALK_VSIX_URL:-${RAW_BASE_URL}/downloads/code-walkthrough.vsix}"
SKILL_URL="${CODEWALK_SKILL_URL:-${RAW_BASE_URL}/codewalk-yaml-contract/SKILL.md}"
TMP_DIR="$(mktemp -d)"
VSIX_PATH="${TMP_DIR}/code-walkthrough.vsix"
SKILL_TMP_PATH="${TMP_DIR}/codewalk-yaml-contract-SKILL.md"
TTY_PATH="/dev/tty"

cleanup() {
  rm -rf "${TMP_DIR}"
}

trap cleanup EXIT

print_header() {
  echo "Code Walkthrough installer"
  echo "Repository: ${OWNER}/${REPO}"
  echo "Source ref: ${REF}"
  echo ""
}

print_step() {
  echo "==> $1"
}

fail() {
  echo "Error: $1" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Required command not found: $1"
  fi
}

read_from_tty() {
  local variable_name="$1"
  local value

  if [ ! -r "${TTY_PATH}" ]; then
    fail "Interactive input requires a terminal."
  fi

  IFS= read -r value < "${TTY_PATH}" || exit 1
  printf -v "${variable_name}" '%s' "${value}"
}

expand_path() {
  local raw_path="$1"

  case "${raw_path}" in
    "~")
      printf '%s\n' "${HOME}"
      ;;
    "~/"*)
      printf '%s\n' "${HOME}/${raw_path#~/}"
      ;;
    *)
      printf '%s\n' "${raw_path}"
      ;;
  esac
}

confirm() {
  local prompt="$1"
  local default="${2:-y}"
  local answer

  while true; do
    if [ "${default}" = "y" ]; then
      printf "%s [Y/n]: " "${prompt}" > "${TTY_PATH}"
    else
      printf "%s [y/N]: " "${prompt}" > "${TTY_PATH}"
    fi

    read_from_tty answer

    if [ -z "${answer}" ]; then
      answer="${default}"
    fi

    case "${answer}" in
      y|Y|yes|YES)
        return 0
        ;;
      n|N|no|NO)
        return 1
        ;;
    esac

    echo "Please answer yes or no."
  done
}

download_file() {
  local url="$1"
  local output_path="$2"

  print_step "Downloading ${url}"
  if ! curl --fail --location --silent --show-error "${url}" --output "${output_path}"; then
    fail "Download failed: ${url}"
  fi
}

choose_skill_destination() {
  local cwd
  cwd="$(pwd)"

  echo "" > "${TTY_PATH}"
  echo "Choose where to install the codewalk-yaml-contract skill:" > "${TTY_PATH}"
  echo "  1) ~/.codex/skills/codewalk-yaml-contract/SKILL.md" > "${TTY_PATH}"
  echo "  2) ~/.claude/skills/codewalk-yaml-contract.md" > "${TTY_PATH}"
  echo "  3) ${cwd}/.codex/skills/codewalk-yaml-contract/SKILL.md" > "${TTY_PATH}"
  echo "  4) ${cwd}/.claude/skills/codewalk-yaml-contract.md" > "${TTY_PATH}"
  echo "  5) Enter a custom path" > "${TTY_PATH}"

  while true; do
    printf "Selection [1-5]: " > "${TTY_PATH}"
    read_from_tty selection

    case "${selection}" in
      1)
        printf '%s\n' "${HOME}/.codex/skills/codewalk-yaml-contract/SKILL.md"
        return 0
        ;;
      2)
        printf '%s\n' "${HOME}/.claude/skills/codewalk-yaml-contract.md"
        return 0
        ;;
      3)
        printf '%s\n' "${cwd}/.codex/skills/codewalk-yaml-contract/SKILL.md"
        return 0
        ;;
      4)
        printf '%s\n' "${cwd}/.claude/skills/codewalk-yaml-contract.md"
        return 0
        ;;
      5)
        printf "Enter the full destination path: " > "${TTY_PATH}"
        read_from_tty custom_path
        [ -n "${custom_path}" ] || echo "Path cannot be empty." > "${TTY_PATH}"
        if [ -n "${custom_path}" ]; then
          printf '%s\n' "$(expand_path "${custom_path}")"
          return 0
        fi
        ;;
      *)
        echo "Please enter a number from 1 to 5." > "${TTY_PATH}"
        ;;
    esac
  done
}

install_skill() {
  local destination_path="$1"
  local destination_dir

  destination_dir="$(dirname "${destination_path}")"
  mkdir -p "${destination_dir}"

  if [ -e "${destination_path}" ] && ! confirm "Skill file already exists at ${destination_path}. Overwrite it?" "n"; then
    echo "Skipped skill installation."
    return 0
  fi

  cp "${SKILL_TMP_PATH}" "${destination_path}"
  echo "Installed skill to ${destination_path}"
}

print_header

case "$(uname -s)" in
  Linux|Darwin)
    ;;
  *)
    fail "This installer currently supports macOS and Linux only."
    ;;
esac

require_command "bash"
require_command "curl"

if ! confirm "Install the Code Walkthrough VS Code extension now?" "y"; then
  echo "Extension install cancelled."
  exit 0
fi

require_command "code"
download_file "${VSIX_URL}" "${VSIX_PATH}"

print_step "Installing VS Code extension"
code --install-extension "${VSIX_PATH}"
echo "Installed Code Walkthrough from ${VSIX_URL}"

if confirm "Also install the optional codewalk-yaml-contract skill file?" "y"; then
  download_file "${SKILL_URL}" "${SKILL_TMP_PATH}"
  SKILL_DESTINATION="$(choose_skill_destination)"
  install_skill "${SKILL_DESTINATION}"
else
  echo "Skipped skill installation."
fi

echo ""
echo "Done."
echo "Extension installed in VS Code."
echo "If the skill was installed, restart your coding tool if it does not pick it up immediately."
