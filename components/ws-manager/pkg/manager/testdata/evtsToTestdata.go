// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

// This utility can take an event trace log and turn it into a set of test fixtures

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/gitpod-io/gitpod/ws-manager/api"
)

var evtsPath = flag.String("evts", "/tmp/evts.json", "path to the event trace log file")
var prefix = flag.String("prefix", "", "fixture prefix to identify the set of fixtures")

// EventTraceEntry is an entry from an event trace log
type EventTraceEntry struct {
	Status  api.WorkspaceStatus `json:"status"`
	Objects json.RawMessage     `json:"objects"`
}

func main() {
	flag.Parse()
	if *prefix == "" {
		fmt.Fprintln(os.Stderr, "-prefix is required")
		os.Exit(1)
	}

	file, err := os.Open(*evtsPath)
	if err != nil {
		log.Fatal(err)
	}
	defer file.Close()

	var i int
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		var data EventTraceEntry
		err = json.Unmarshal(scanner.Bytes(), &data)
		if err != nil {
			panic(err)
		}

		phase := data.Status.Phase
		glob, err := filepath.Glob(fmt.Sprintf("status_%s_%03d_%s*.json", *prefix, i, phase))
		if err != nil {
			panic(err)
		}

		idx := len(glob)
		fn := fmt.Sprintf("status_%s_%03d_%s%02d.json", *prefix, i, phase, idx)
		ctnt, err := json.MarshalIndent(data.Objects, "", "  ")
		if err != nil {
			panic(err)
		}
		err = os.WriteFile(fn, ctnt, 0644)
		if err != nil {
			panic(err)
		}

		i++
		fmt.Printf("Wrote %s\n", fn)
	}
}
