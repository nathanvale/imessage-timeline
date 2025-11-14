#!/usr/bin/env bash
# Basic smoke tests for shell scripts
# Tests syntax validity and basic structure

set -e

echo "🧪 Running shell script smoke tests..."
echo

# Test 1: Syntax check all scripts
echo "✓ Test 1: Checking syntax for all .sh files"
for script in .github/scripts/*.sh; do
  echo "  Checking: $(basename "$script")"
  bash -n "$script"
done
echo "  ✅ All scripts have valid syntax"
echo

# Test 2: Verify all scripts have shebangs
echo "✓ Test 2: Checking for shebangs"
for script in .github/scripts/*.sh; do
  first_line=$(head -n 1 "$script")
  if [[ ! "$first_line" =~ ^#!.*bash ]]; then
    echo "  ❌ Missing or invalid shebang in $(basename "$script")"
    exit 1
  fi
  echo "  ✅ $(basename "$script") has valid shebang"
done
echo

# Test 3: Verify all scripts are executable
echo "✓ Test 3: Checking file permissions"
for script in .github/scripts/*.sh; do
  if [[ ! -x "$script" ]]; then
    echo "  ⚠️  $(basename "$script") is not executable (this is OK for CI, but recommended for local use)"
  else
    echo "  ✅ $(basename "$script") is executable"
  fi
done
echo

echo "✅ All smoke tests passed!"
