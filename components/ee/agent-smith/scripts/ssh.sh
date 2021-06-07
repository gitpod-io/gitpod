#!/usr/bin/env bash

sshpass  -p 'root' ssh -o StrictHostKeychecking=no -p 2222 root@127.0.0.1 "$@"
