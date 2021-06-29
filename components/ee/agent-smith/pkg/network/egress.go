// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package network

import (
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"path"
	"strconv"
	"strings"
)

func readDeviceEgress(inpt io.Reader, dev string) (total int64, err error) {
	csvreader := csv.NewReader(inpt)
	csvreader.Comma = ' '
	csvreader.FieldsPerRecord = 17
	csvreader.TrimLeadingSpace = true

	var totalEgress int64 = -1
	//nolint:errcheck,staticcheck
	for rec, err := csvreader.Read(); rec != nil; rec, err = csvreader.Read() {
		if len(rec) < 9 {
			continue
		}
		if !strings.HasPrefix(rec[0], dev) {
			continue
		}

		totalEgress, err = strconv.ParseInt(rec[9], 10, 64)
		if err != nil {
			return 0, err
		}
		break
	}
	if totalEgress < 0 {
		return 0, fmt.Errorf("did not find interface")
	}

	return totalEgress, nil
}

func GetEgressTraffic(pid string) (int64, error) {
	file, err := os.OpenFile(path.Join("/proc", pid, "/net/dev"), os.O_RDONLY, 0600)
	if err != nil {
		return 0, err
	}
	defer file.Close()

	totalEgress, err := readDeviceEgress(file, "eth0")
	if err != nil {
		return 0, err
	}

	return totalEgress, nil
}
