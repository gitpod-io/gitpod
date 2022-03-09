#!/bin/bash
kubectl port-forward statefulset/mysql 3306:3306 &
mysql -h 127.0.0.1 -P 3306 -u gitpod -D gitpod --select-limit=200 --safe-updates --password="$(kubectl get secrets mysql -o jsonpath="{.data.password}" | base64 -d)"