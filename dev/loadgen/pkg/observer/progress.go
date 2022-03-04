// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package observer

import (
	"github.com/cheggaaa/pb/v3"

	"github.com/gitpod-io/gitpod/loadgen/pkg/loadgen"
)

// NewProgressBarObserver produces a new progress bar
func NewProgressBarObserver(total int) chan<- *loadgen.SessionEvent {
	res := make(chan *loadgen.SessionEvent)
	// bar := pb.Full.New(total)
	tmpl := `{{ green "spinning up:" }} {{ bar . "[" "█" (cycle . "↖" "↗" "↘" "↙" ) " " "]"}} {{speed . }} {{counters . "%s/%s"}}`
	// start bar based on our template
	bar := pb.ProgressBarTemplate(tmpl).New(total)

	go func() {
		defer bar.Finish()
		for evt := range res {
			if evt.Kind != loadgen.SessionWorkspaceStart {
				continue
			}
			bar.Increment()
			bar.Write()
		}
	}()
	return res
}
