// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

// This utility can take an event trace log and turn it into a set of test fixtures

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
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

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		var data EventTraceEntry
		err = json.Unmarshal(scanner.Bytes(), &data)
		if err != nil {
			panic(err)
		}

		phase := data.Status.Phase
		glob, err := filepath.Glob(fmt.Sprintf("status_%s_%s*.json", *prefix, phase))
		if err != nil {
			panic(err)
		}

		idx := len(glob)
		fn := fmt.Sprintf("status_%s_%s%02d.json", *prefix, phase, idx)
		err = ioutil.WriteFile(fn, data.Objects, 0644)
		if err != nil {
			panic(err)
		}

		fmt.Printf("Wrote %s\n", fn)
	}
}
