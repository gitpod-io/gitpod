#!/bin/bash
# Copyright (c) 2022 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.


# this script is intended to be called from .bashrc
# This is a workaround for not having something like supervisord

if [ ! -e /var/run/mysqld/gitpod-init.lock ]; then
	touch /var/run/mysqld/gitpod-init.lock

	# initialize database structures on disk, if needed
	[ ! -d /workspace/mysql ] && mysqld --initialize-insecure

	# launch database, if not running
	[ ! -e /var/run/mysqld/mysqld.pid ] && mysqld --daemonize

	rm /var/run/mysqld/gitpod-init.lock
fi
