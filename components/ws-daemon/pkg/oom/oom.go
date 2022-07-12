// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package oom

import (
	"github.com/google/cadvisor/utils/oomparser"

	"github.com/gitpod-io/gitpod/common-go/log"
)

func NewWatcher() error {
	outStream := make(chan *oomparser.OomInstance, 10)

	oomLog, err := oomparser.New()
	if err != nil {
		return err
	}

	go oomLog.StreamOoms(outStream)

	go func() {
		for oomInstance := range outStream {
			if oomInstance.ProcessName == "" || oomInstance.Pid == 0 {
				continue
			}

			log.WithField("pid", oomInstance.Pid).
				WithField("processName", oomInstance.ProcessName).
				WithField("timeOfDeath", oomInstance.TimeOfDeath).
				WithField("containerName", oomInstance.ContainerName).
				WithField("victimContainerName", oomInstance.VictimContainerName).
				WithField("constraint", oomInstance.Constraint).
				Warn("System OOM encountered")
		}
	}()

	return nil
}
