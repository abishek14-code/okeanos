#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/../.."
firmware_test_bin="$(mktemp)"
trap 'rm -f "$firmware_test_bin"' EXIT
c++ -std=c++17 -Wall -Wextra -Itests/native/stubs -Itests/native/vendor tests/native/firmware_test.cpp -o "$firmware_test_bin"
"$firmware_test_bin"
