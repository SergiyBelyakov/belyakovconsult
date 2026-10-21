#!/bin/bash
cd "$(dirname "$0")" || exit 1
bash ./deploy_main.sh
status=$?
echo
read -r -p "Press Return to close this window... " _
exit "$status"
