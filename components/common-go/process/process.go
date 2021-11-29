// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package process

// IsNotChildProcess checks if an error returned by a command
// execution is an error related to no child processes running
// This can be seen, for instance, in short lived commands.
func IsNotChildProcess(err error) bool {
	if err == nil {
		return false
	}

	return (err.Error() == "wait: no child processes" || err.Error() == "waitid: no child processes")
}
