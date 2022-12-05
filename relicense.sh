#!/bin/bash

# const tmplMIT = `Copyright (c) {{.Year}} {{.Holder}}. All rights reserved.
# Licensed under the MIT License. See License-MIT.txt in the project root for license information.`

# const tmplAGPL = `Copyright (c) {{.Year}} {{.Holder}}. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.`

# const tmplGPSHF = `Copyright (c) {{.Year}} {{.Holder}}. All rights reserved.
# Licensed under the Gitpod Enterprise Source Code License,
# See License.enterprise.txt in the project root folder.`



leeway collect files --format-string '{{ range . }}{{ .Name }}{{"\n"}}{{ end }}' | uniq > files.txt
find . -iname "*.libsonnet" -or  -iname "*.jsonnet" >> files.txt

L1="Licensed under the GNU Affero General Public License (AGPL)."
L2="See License.AGPL.txt in the project root for license information."

cat < files.txt | while IFS= read -r line
do
  echo "$line"
  # ------ MIT -------
  # bash, YAML, Dockerfile
  sed -i "s/# Licensed under the MIT License. See License-MIT.txt in the project root for license information./# $L1\n# $L2/" "$line"
  # go
  sed -i "s/\/\ Licensed under the MIT License. See License-MIT.txt in the project root for license information./\/\/ $L1\n\/\/ $L2/" "$line"
  # SQL
  sed -i "s/-- Licensed under the MIT License. See License-MIT.txt in the project root for license information./-- $L1\n-- $L2/" "$line"
  # TypeScript
  sed -i "s/* Licensed under the MIT License. See License-MIT.txt in the project root for license information./* $L1\n* $L2/" "$line"
  # ------- Enterprise ------
  sed -i "s/# Licensed under the Gitpod Enterprise Source Code License,/# $L1/" "$line"
  sed -i "s/* Licensed under the Gitpod Enterprise Source Code License,/* $L1/" "$line"
  sed -i "s/\/\ Licensed under the Gitpod Enterprise Source Code License,/\/\ $L1/" "$line"

  sed -i "s/# See License.enterprise.txt in the project root folder./# $L2/" "$line"
  sed -i "s/* See License.enterprise.txt in the project root folder./* $L2/" "$line"
  sed -i "s/\/\ See License.enterprise.txt in the project root folder./\/\ $L2/" "$line"

done

# for f in $(cat files.txt); do
#     echo "$f"
# done
