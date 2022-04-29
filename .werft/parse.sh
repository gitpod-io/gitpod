title=":x: *Workspace integration test failed*"
body=$(grep "\-\-\- FAIL: " entrypoing.sh.log)
echo "${title}"
echo "${body}"
# echo "[int-tests|FAIL]"
