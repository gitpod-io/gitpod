// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package agent

import (
	"github.com/prometheus/procfs"
)

func getEgressTraffic(pid int) (int64, error) {
	pproc, err := procfs.NewProc(pid)
	if err != nil {
		return -1, err
	}

	nd, err := pproc.NetDev()

	if err != nil {
		return -1, err
	}

	return int64(nd.Total().TxBytes), nil
}
