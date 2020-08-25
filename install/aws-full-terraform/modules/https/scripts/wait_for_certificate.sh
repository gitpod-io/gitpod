#!/bin/bash

# While the certificate is not done being created do not let the program exit
until kubectl get certificates | awk "FNR == 2 { print $2 }" | grep -q "True"
do
  echo -n ''
done

echo "Done"
