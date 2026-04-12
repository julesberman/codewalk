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
SKILL_NAME="codewalk-yaml-contract"
COLOR_RESET=""
COLOR_BOLD=""
COLOR_DIM=""
COLOR_BLUE=""
COLOR_CYAN=""
COLOR_GREEN=""
COLOR_YELLOW=""
COLOR_RED=""

setup_colors() {
  if [ -t 1 ] && command -v tput >/dev/null 2>&1 && [ "$(tput colors 2>/dev/null || printf '0')" -ge 8 ]; then
    COLOR_RESET="$(tput sgr0)"
    COLOR_BOLD="$(tput bold)"
    COLOR_DIM="$(tput dim)"
    COLOR_BLUE="$(tput setaf 4)"
    COLOR_CYAN="$(tput setaf 6)"
    COLOR_GREEN="$(tput setaf 2)"
    COLOR_YELLOW="$(tput setaf 3)"
    COLOR_RED="$(tput setaf 1)"
  fi
}

cleanup() {
  rm -rf "${TMP_DIR}"
}

trap cleanup EXIT

tty_print() {
  printf '%b' "$1" > "${TTY_PATH}"
}

tty_println() {
  printf '%b\n' "$1" > "${TTY_PATH}"
}

print_divider() {
  printf '%b\n' "${COLOR_DIM}------------------------------------------------------------${COLOR_RESET}"
}

print_header() {
  print_divider
  printf '%b\n' "${COLOR_BOLD}${COLOR_BLUE}Code Walkthrough Installer${COLOR_RESET}"
  printf '%b\n' "${COLOR_DIM}Repository:${COLOR_RESET} ${OWNER}/${REPO}"
  printf '%b\n' "${COLOR_DIM}Source ref:${COLOR_RESET} ${REF}"
  print_divider
  echo ""
}

print_step() {
  printf '%b\n' "${COLOR_CYAN}${COLOR_BOLD}==>${COLOR_RESET} $1"
}

print_info() {
  printf '%b\n' "${COLOR_BLUE}Info:${COLOR_RESET} $1"
}

print_success() {
  printf '%b\n' "${COLOR_GREEN}Success:${COLOR_RESET} $1"
}

print_warning() {
  printf '%b\n' "${COLOR_YELLOW}Warning:${COLOR_RESET} $1"
}

fail() {
  printf '%b\n' "${COLOR_RED}${COLOR_BOLD}Error:${COLOR_RESET} $1" >&2
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
      tty_print "${COLOR_BOLD}${prompt}${COLOR_RESET} ${COLOR_DIM}[Y/n]${COLOR_RESET}: "
    else
      tty_print "${COLOR_BOLD}${prompt}${COLOR_RESET} ${COLOR_DIM}[y/N]${COLOR_RESET}: "
    fi

    read_from_tty answer

    if [ -z "${answer}" ]; then
      answer="${default}"
    fi

    case "${answer}" in
      y|Y|yes|YES)
        tty_println "${COLOR_GREEN}Selected: yes${COLOR_RESET}"
        return 0
        ;;
      n|N|no|NO)
        tty_println "${COLOR_YELLOW}Selected: no${COLOR_RESET}"
        return 1
        ;;
    esac

    tty_println "${COLOR_YELLOW}Please answer yes or no.${COLOR_RESET}"
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
  local codex_home
  cwd="$(pwd)"
  codex_home="${CODEX_HOME:-${HOME}/.codex}"

  tty_println ""
  tty_println "${COLOR_BOLD}${COLOR_BLUE}Skill Install Destination${COLOR_RESET}"
  tty_println "${COLOR_DIM}Choose where to install ${SKILL_NAME}.${COLOR_RESET}"
  tty_println "  ${COLOR_CYAN}1)${COLOR_RESET} ${codex_home}/skills/${SKILL_NAME}/SKILL.md"
  tty_println "  ${COLOR_CYAN}2)${COLOR_RESET} ${HOME}/.claude/skills/${SKILL_NAME}/SKILL.md"
  tty_println "  ${COLOR_CYAN}3)${COLOR_RESET} ${cwd}/.codex/skills/${SKILL_NAME}/SKILL.md"
  tty_println "  ${COLOR_CYAN}4)${COLOR_RESET} ${cwd}/.claude/skills/${SKILL_NAME}/SKILL.md"
  tty_println "  ${COLOR_CYAN}5)${COLOR_RESET} Enter a custom path"

  while true; do
    tty_print "${COLOR_BOLD}Selection${COLOR_RESET} ${COLOR_DIM}[1-5]${COLOR_RESET}: "
    read_from_tty selection

    case "${selection}" in
      1)
        tty_println "${COLOR_GREEN}Using Codex global skills directory.${COLOR_RESET}"
        printf '%s\n' "${codex_home}/skills/${SKILL_NAME}/SKILL.md"
        return 0
        ;;
      2)
        tty_println "${COLOR_GREEN}Using Claude global skills directory.${COLOR_RESET}"
        printf '%s\n' "${HOME}/.claude/skills/${SKILL_NAME}/SKILL.md"
        return 0
        ;;
      3)
        tty_println "${COLOR_GREEN}Using project-local Codex skills directory.${COLOR_RESET}"
        printf '%s\n' "${cwd}/.codex/skills/${SKILL_NAME}/SKILL.md"
        return 0
        ;;
      4)
        tty_println "${COLOR_GREEN}Using project-local Claude skills directory.${COLOR_RESET}"
        printf '%s\n' "${cwd}/.claude/skills/${SKILL_NAME}/SKILL.md"
        return 0
        ;;
      5)
        tty_print "${COLOR_BOLD}Custom path${COLOR_RESET}: "
        read_from_tty custom_path
        [ -n "${custom_path}" ] || tty_println "${COLOR_YELLOW}Path cannot be empty.${COLOR_RESET}"
        if [ -n "${custom_path}" ]; then
          printf '%s\n' "$(normalize_skill_destination "$(expand_path "${custom_path}")")"
          return 0
        fi
        ;;
      *)
        tty_println "${COLOR_YELLOW}Please enter a number from 1 to 5.${COLOR_RESET}"
        ;;
    esac
  done
}

normalize_skill_destination() {
  local destination_path="$1"

  case "${destination_path}" in
    */SKILL.md)
      printf '%s\n' "${destination_path}"
      ;;
    *.md)
      printf '%s\n' "${destination_path}"
      ;;
    *)
      printf '%s\n' "${destination_path%/}/SKILL.md"
      ;;
  esac
}

install_skill() {
  local destination_path="$1"
  local destination_dir

  destination_path="$(normalize_skill_destination "${destination_path}")"

  destination_dir="$(dirname "${destination_path}")"
  mkdir -p "${destination_dir}"

  if [ -e "${destination_path}" ] && ! confirm "Skill file already exists at ${destination_path}. Overwrite it?" "n"; then
    print_warning "Skipped skill installation."
    return 0
  fi

  cp "${SKILL_TMP_PATH}" "${destination_path}"
  print_success "Installed skill to ${destination_path}"
}

setup_colors
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
  print_warning "Extension install cancelled."
  exit 0
fi

require_command "code"
download_file "${VSIX_URL}" "${VSIX_PATH}"

print_step "Installing VS Code extension"
code --install-extension "${VSIX_PATH}"
print_success "Installed Code Walkthrough from ${VSIX_URL}"

if confirm "Also install the optional codewalk-yaml-contract/SKILL.md file?" "y"; then
  download_file "${SKILL_URL}" "${SKILL_TMP_PATH}"
  SKILL_DESTINATION="$(choose_skill_destination)"
  install_skill "${SKILL_DESTINATION}"
else
  print_info "Skipped skill installation."
fi

echo ""
print_divider
printf '%b\n' "${COLOR_GREEN}${COLOR_BOLD}Done.${COLOR_RESET}"
print_info "Extension installed in VS Code."
print_info "If the skill was installed, restart your coding tool if it does not pick it up immediately."
print_divider
