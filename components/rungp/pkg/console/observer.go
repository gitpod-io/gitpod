// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package console

import (
	"bufio"
	"io"
	"strings"
)

func Observe(log Log) Logs {
	rr, rw := io.Pipe()

	var (
		steady string
		phase  = "starting"
	)
	p := log.StartPhase("["+phase+"]", "workspace image")

	go func() {
		extensions := make(map[string]struct{})

		scanner := bufio.NewScanner(rr)
		for scanner.Scan() {
			var (
				resetPhase = true
				failure    string
			)
			line := scanner.Text()

			switch {
			case strings.Contains(line, "Web UI available"):
				phase = "running"
				steady = "workspace at http://localhost:8080"
			case strings.Contains(line, "Installing extensions"):
				phase = "installing extensions"
				steady = "running " + steady
			case strings.Contains(line, "IDE was stopped"):
				phase = "restarting"
				steady = "the workspace"
				failure = "IDE was stopped"
			case strings.Contains(line, "Installing extension:"):
				segs := strings.Split(line, "Installing extension:")
				extensions[segs[1]] = struct{}{}
				resetPhase = false
			case strings.Contains(line, "Downloaded extension"):
				for k := range extensions {
					if strings.Contains(line, k) {
						delete(extensions, k)
					}
				}
				if len(extensions) == 0 {
					phase = "ready"
				} else {
					resetPhase = false
				}
			default:
				resetPhase = false
			}

			if !resetPhase {
				continue
			}
			if failure != "" {
				p.Failure(failure)
			} else {
				p.Success()
			}
			failure = ""
			p = log.StartPhase("["+phase+"]", steady)
		}
	}()

	logs := log.Log()
	return noopWriteCloser{io.MultiWriter(rw, logs)}
}
