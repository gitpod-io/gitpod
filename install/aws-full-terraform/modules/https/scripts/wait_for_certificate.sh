#!/bin/bash
# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.


# While the certificate is not done being created do not let the program exit
until kubectl get certificates | awk "FNR == 2 { print $2 }" | grep -q "True"
do
  echo -n ''
done

echo "Done"
