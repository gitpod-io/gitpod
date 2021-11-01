#!/bin/sh
# Copyright (c) 2020 TypeFox GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License-AGPL.txt in the project root for license information.

# Created by Jacob Hrbek <kreyren@rixotstudio.cz> under WTFPL license <http://www.wtfpl.net/txt/copying/>

###! This script is designed to be run in docker environment

# Required for docker to terminate the build on failure
set -e

myName="EL Layer"

efixme() {
	if [ "$IGNORE_FIXME" != 1 ]; then
		printf 'FIXME: %s\n' "$1"
	else
		# NOTICE(Krey): Terminates the script otherwise
		true
	fi
}
edebug() {
	if [ "$DEBUG" = 1 ]; then
		printf 'DEBUG: %s\n' "$1"
	else
		# NOTICE(Krey): Terminates the script otherwise
		true
	fi
}
die() {
	case "$1" in
		1|3) printf 'FATAL: %s\n' "$2" ;;
		26) printf 'SECURITY: %s\n' "$2" ;;
		*)
			printf 'FATAL: %s\n' "$2"
			exit 1
	esac

	exit "$1"
}

# Expects to be run as root
if [ "$(id -u)" != 0 ]; then
	die 3 "EL wrapper is not expected to be invoked on non-root"
elif [ "$(id -u)" = 0 ]; then
	# FIXME(Kreyren): Sanitization needed
	true
else
	die 255 "Checking for root acces in EL layer"
fi

# Disable root login
# Notice(Krey): Not a big deal according to jankermones
if ! command -v passwd; then
	true
elif command -v passwd; then
	passwd -l root || true
else
	die 255 "Unexpected happend while checking for passwd command"
fi

# Create gp-preview symlink required for the browser variable
ln -s /usr/bin/gp /usr/bin/gp-preview || die 1 "Unable to symlink gp to gp-preview"

## Gitpod user
expected_user="gitpod"
expected_uid="33333"
## Gitpod group
expected_group="gitpod"
expected_gid="33333"

# Disable repository protection
# HOTFIX(Krey): Results in `packages excluded due to repository priority protections` on gitpod for unknown reason
printf '%s\n' "[main]" "enabled = 0" > /etc/yum/pluginconf.d/priorities.conf

# Install git and vim
yum install -y git || die 1 "Unable to install required git package"
yum install -y vim || die 1 "Unable to install required vim package"
# DNM(Krey): Hotfix due weird behaviour
##yum install -y bash || die 1 "Unable to install required bash package"

# Create Gitpod user
# INFO(Kreyren): This is stripped from https://github.com/jankeromnes/gitpod-layers/pull/3
# Resolve expected group
if grep -q "$expected_group:.*:$expected_gid:" /etc/group; then
	edebug "Expected group $expected_group with gid $expected_gid is already present, skipping resolution logic"
elif ! grep -q "$expected_group:.*:$expected_gid:" /etc/group; then
	edebug "Expected group '$expected_group' with expected gid '$expected_gid' is not present, resolving.."
	# CORE - Make a new group if needed
	if command -v groupadd >/dev/null; then
		edebug "Detected that command 'groupadd' is available for us to use"
		groupadd \
			--gid "$expected_gid" \
			"$expected_group" \
		|| die 1 "Command groupadd failed to create expected group $expected_group with expected gid $expected_gid"
		edebug "Command groupadd returned true for creating expected group $expected_group with expected gid $expected_gid"
	elif ! command -v groupadd; then
		die 1 "Expected command 'groupadd' is not present, unable to create expected group $expected_group with gid $expected_gid"
	else
		die 255 "processing expected group $expected_group with expected id $expected_gid in $myName"
	fi
fi

# Self-check: Resolve expected group
edebug "processing 'Self-check: Resolve expected group' step in $myName"
if grep -q "$expected_group:.*:$expected_gid:" /etc/group; then
	edebug "Expected group $expected_group with expected gid $expected_gid passed self-check"
elif ! grep -q "$expected_group:.*:$expected_gid:" /etc/group; then
	die 23 "Expected group $expected_group with expected gid $expected_gid failed self-check, see output of command 'grep -q \"$expected_group:.*:$expected_gid:\" /etc/group': $(grep "$expected_group:.*:$expected_gid:" /etc/group)"
else
	die 255 "self-checking Resolve expected group step"
fi

# Resolve expected user
if grep -q "$expected_user:.*:$expected_uid:$expected_gid:.*" /etc/passwd; then
	edebug "Expected user $expected_user with expected uid $expected_uid is already present, skipping resolution.."
elif ! grep -q "$expected_user:.*:$expected_uid:$expected_gid:.*" /etc/passwd; then
	edebug "Expected user $expected_user with expected uid $expected_uid is not present, resolving.."
	# CORE - Make a new user if needed
	if command -v useradd >/dev/null; then
		edebug "Found command useradd for resolution"
		# We need --no-log-init due https://github.com/golang/go/issues/13548, see https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user
		# FIXME: Implement logic that applies --no-log-init based on provided bug state
		useradd \
			--create-home --home-dir "/home/$expected_user" \
			--no-log-init \
			--uid "$expected_uid" \
			--gid "$expected_group" \
			--password "$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c10)" \
			--comment "Created by $myName for gitpod usage" \
			"$expected_user" \
		|| die 1 "Command useradd failed to create expected user $expected_user with uid $expected_uid"
		edebug "Expected user $expected_user with expected uid $expected_uid has been created according to command useradd"
	elif command -v adduser >/dev/null; then
		# FIXME: Blocked by https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user
		die 23 "Command useradd is not available and we are refusing to sue adduser due to the https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user"
	elif ! command -v useradd >/dev/null && ! command -v adduser >/dev/null; then
		die 23 "Neither of expected commands useradd nor adduser are available on this environment, this usage of gitpod is unexpected and most likely malicious injection of altered dockerfile. Instance $GITPOD_WORKSPACE_ID with user $GITPOD_GIT_USER_EMAIL has been reported to upstream"
	else
		die 255 "Resolving expected user"
	fi
else
	die 255 "Checking if expected user is present"
fi

# Self-check
if grep -q "$expected_user:.*:$expected_uid:$expected_gid:.*" /etc/passwd; then
	edebug "Expected user $expected_user with expected uid $expected_uid passed self-check"
elif ! grep -q "$expected_user:.*:$expected_uid:$expected_gid:.*" /etc/passwd; then
	edebug "Output of 'grep \"$expected_user\" /etc/passwd' is: '$(grep "$expected_user" /etc/passwd)'"
	efixme "Logic for self-check of expected user is required"
	#die 23 "Expected user $expected_user with expected uid $expected_uid failed self-check"
else
	die 255 "Self-checking expected user"
fi