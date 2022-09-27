// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package process

import (
	"github.com/prometheus/procfs"
)

// SigTerm does a depth-first traversion over a process tree
func VisitProcessTree(processID int, visitFunction func(process procfs.Proc) error) error {
	processes, err := procfs.AllProcs()
	if err != nil {
		return err
	}
	return visitProcessTreeRec(processID, processes, visitFunction)
}

func visitProcessTreeRec(processID int, processes []procfs.Proc, visitFunction func(process procfs.Proc) error) error {
	for _, p := range processes {
		stat, err := p.Stat()
		if err != nil {
			return err
		}
		if stat.PPID == processID {
			err := visitProcessTreeRec(stat.PID, processes, visitFunction)
			if err != nil {
				return err
			}
		} else if stat.PID == processID {
			defer visitFunction(p)
		}
	}
	return nil
}
