#!/usr/bin/env bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

set -exuo pipefail

# https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html#installing-ansible-on-ubuntu

sudo apt update
sudo apt --yes install software-properties-common
sudo add-apt-repository --yes --update ppa:ansible/ansible
sudo apt --yes install ansible

pip install google-auth
