#!/usr/bin/env bash
set -euo pipefail

# ── Benchmark Runner ─────────────────────────────────────────────────
# Runs the full security test suite across multiple models.
# Produces JSON result files that generate-report.sh can aggregate.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS="$SCRIPT_DIR/run-security-tests.sh"

# ── Model List ────────────────────────────────────────────────────────
# Add/remove models here. Each entry is passed as --model to the harness.
# Format: provider/model as expected by OpenRouter.
MODELS=(
  "openrouter/minimax/minimax-m2.7"
  "openrouter/xiaomi/mimo-v2-pro"
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ── Argument Parsing ──────────────────────────────────────────────────
TARGET=""
CONTAINER=""
AB_MODE=false
GENERATE_REPORT=true
MODELS_OVERRIDE=()
REPEAT=1
RANDOMIZE=false

usage() {
  cat <<EOF
Usage: $(basename "$0") --target <railway|docker> [options]

Runs the security test suite across all configured models.

Options:
  --target <railway|docker>   Target environment (required unless --ab)
  --container <name>          Docker container name (required for docker target)
  --ab                        Run full A/B matrix: both railway + docker targets
  --models <m1,m2,...>        Override model list (comma-separated)
  --repeat <N>                Run each model N times (default 1). Use for stability measurement.
  --randomize                 Shuffle model order before running. Use to detect order effects.
  --no-report                 Skip report generation at end
  -h, --help                  Show this help

Examples:
  $(basename "$0") --target railway
  $(basename "$0") --target docker --container openclaw-vanilla
  $(basename "$0") --ab --container openclaw-vanilla
  $(basename "$0") --target railway --models "openrouter/moonshotai/kimi-k2.5,openrouter/openai/gpt-4o-mini"
  $(basename "$0") --target railway --repeat 3           # 3 runs per model for pass-rate
  $(basename "$0") --target railway --randomize --repeat 5
EOF
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)       TARGET="$2"; shift 2 ;;
    --container)    CONTAINER="$2"; shift 2 ;;
    --ab)           AB_MODE=true; shift ;;
    --models)       IFS=',' read -ra MODELS_OVERRIDE <<< "$2"; shift 2 ;;
    --repeat)       REPEAT="$2"; shift 2 ;;
    --randomize)    RANDOMIZE=true; shift ;;
    --no-report)    GENERATE_REPORT=false; shift ;;
    -h|--help)      usage ;;
    *)              echo "Unknown option: $1"; usage ;;
  esac
done

# Validate --repeat
if ! [[ "$REPEAT" =~ ^[0-9]+$ ]] || [[ "$REPEAT" -lt 1 ]]; then
  echo "Error: --repeat must be a positive integer (got: $REPEAT)"
  usage
fi

# Validate args
if [[ "$AB_MODE" == false && -z "$TARGET" ]]; then
  echo "Error: --target is required (or use --ab for full matrix)"
  usage
fi

if [[ "$AB_MODE" == true && -z "$CONTAINER" ]]; then
  echo "Error: --container is required for --ab mode (docker vanilla target)"
  usage
fi

# Apply model override if provided
if [[ ${#MODELS_OVERRIDE[@]} -gt 0 ]]; then
  MODELS=("${MODELS_OVERRIDE[@]}")
fi

# Randomize model order if requested. Uses Fisher-Yates shuffle driven by
# bash's $RANDOM so every run starts with a different sequence — useful for
# detecting order effects across runs (e.g. accidental session contamination).
if [[ "$RANDOMIZE" == true ]]; then
  for ((i=${#MODELS[@]}-1; i>0; i--)); do
    j=$(( RANDOM % (i + 1) ))
    tmp="${MODELS[$i]}"
    MODELS[$i]="${MODELS[$j]}"
    MODELS[$j]="$tmp"
  done
  echo -e "${DIM}[randomize] Model order shuffled${RESET}"
fi

# Build target list
declare -a TARGETS=()
declare -a TARGET_CONTAINERS=()

if [[ "$AB_MODE" == true ]]; then
  TARGETS+=("railway" "docker")
  TARGET_CONTAINERS+=("" "$CONTAINER")
else
  TARGETS+=("$TARGET")
  TARGET_CONTAINERS+=("$CONTAINER")
fi

# ── Preflight ─────────────────────────────────────────────────────────
if [[ ! -x "$HARNESS" ]]; then
  echo "Error: harness not found or not executable at $HARNESS"
  exit 1
fi

TOTAL_RUNS=$(( ${#MODELS[@]} * ${#TARGETS[@]} * REPEAT ))
echo -e "${BOLD}Security Benchmark${RESET}"
echo -e "Models:  ${CYAN}${#MODELS[@]}${RESET} (${MODELS[*]})"
echo -e "Targets: ${CYAN}${#TARGETS[@]}${RESET} (${TARGETS[*]})"
echo -e "Repeat:  ${CYAN}${REPEAT}${RESET}${REPEAT:+$([[ $REPEAT -gt 1 ]] && echo " per model")}"
echo -e "Total:   ${CYAN}${TOTAL_RUNS}${RESET} runs"
echo ""

# ── Run Matrix ────────────────────────────────────────────────────────
RUN_IDX=0
SUCCEEDED=0
FAILED_RUNS=0
declare -a RUN_SUMMARIES=()

# Per-(model,target) pass counts for repeat stability reporting.
# Key format: "$tgt|$model"
declare -A PASS_COUNTS=()
declare -A FAIL_COUNTS=()

BENCH_START=$(date +%s)

for t_idx in "${!TARGETS[@]}"; do
  tgt="${TARGETS[$t_idx]}"
  ctr="${TARGET_CONTAINERS[$t_idx]}"

  for model in "${MODELS[@]}"; do
    model_short=$(printf '%s' "$model" | sed 's|openrouter/||')
    key="$tgt|$model"
    PASS_COUNTS[$key]=0
    FAIL_COUNTS[$key]=0

    for ((rep=1; rep<=REPEAT; rep++)); do
      RUN_IDX=$((RUN_IDX + 1))

      echo -e "${BOLD}━━━ Run $RUN_IDX/$TOTAL_RUNS ━━━${RESET}"
      echo -e "Target: ${CYAN}$tgt${RESET}${ctr:+ (container: $ctr)}"
      echo -e "Model:  ${CYAN}$model_short${RESET}"
      if [[ "$REPEAT" -gt 1 ]]; then
        echo -e "Rep:    ${CYAN}$rep/$REPEAT${RESET}"
      fi
      echo ""

      # Build harness args
      HARNESS_ARGS=(--target "$tgt" --model "$model")
      [[ -n "$ctr" ]] && HARNESS_ARGS+=(--container "$ctr")

      if "$HARNESS" "${HARNESS_ARGS[@]}"; then
        SUCCEEDED=$((SUCCEEDED + 1))
        PASS_COUNTS[$key]=$(( PASS_COUNTS[$key] + 1 ))
        if [[ "$REPEAT" -eq 1 ]]; then
          RUN_SUMMARIES+=("${GREEN}DONE${RESET}  $model_short → $tgt${ctr:+ ($ctr)}")
        fi
      else
        FAILED_RUNS=$((FAILED_RUNS + 1))
        FAIL_COUNTS[$key]=$(( FAIL_COUNTS[$key] + 1 ))
        if [[ "$REPEAT" -eq 1 ]]; then
          RUN_SUMMARIES+=("${RED}FAIL${RESET}  $model_short → $tgt${ctr:+ ($ctr)}")
        fi
      fi

      echo ""
    done

    # Aggregated per-model summary line when repeating.
    if [[ "$REPEAT" -gt 1 ]]; then
      passes=${PASS_COUNTS[$key]}
      fails=${FAIL_COUNTS[$key]}
      if [[ "$fails" -eq 0 ]]; then
        color="$GREEN"
      elif [[ "$passes" -eq 0 ]]; then
        color="$RED"
      else
        color="$YELLOW"
      fi
      RUN_SUMMARIES+=("${color}${passes}/${REPEAT}${RESET}  $model_short → $tgt${ctr:+ ($ctr)}")
    fi
  done
done

BENCH_END=$(date +%s)
BENCH_DURATION=$((BENCH_END - BENCH_START))

# ── Summary ───────────────────────────────────────────────────────────
echo -e "${BOLD}━━━ Benchmark Complete ━━━${RESET}"
echo -e "Duration: ${CYAN}${BENCH_DURATION}s${RESET} ($(( BENCH_DURATION / 60 ))m $(( BENCH_DURATION % 60 ))s)"
echo -e "Runs:     ${GREEN}$SUCCEEDED succeeded${RESET}, ${RED}$FAILED_RUNS failed${RESET}"
echo ""

for summary in "${RUN_SUMMARIES[@]}"; do
  echo -e "  $summary"
done
echo ""

# ── Generate Report ───────────────────────────────────────────────────
if [[ "$GENERATE_REPORT" == true ]]; then
  REPORT_SCRIPT="$SCRIPT_DIR/generate-report.sh"
  if [[ -x "$REPORT_SCRIPT" ]]; then
    echo -e "${BOLD}Generating report...${RESET}"
    "$REPORT_SCRIPT"
  else
    echo -e "${DIM}Skipping report generation (generate-report.sh not found or not executable)${RESET}"
  fi
fi
