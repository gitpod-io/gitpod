// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package main

import (
	"bufio"
	"errors"
	"io"
	"os"
	"strings"

	"github.com/pterm/pterm"
)

var msgs = []struct {
	Fail    string
	Success string

	Msg string
}{
	{Msg: "checking prerequisites", Fail: "requires a system with at least", Success: "Gitpod Domain:"},
	{Msg: "preparing system", Success: "extracting images to download ahead"},
	{Msg: "downloading images", Success: "--output-split-files"},
	{Msg: "preparing Gitpod preview installation", Success: "rm -rf /var/lib/rancher/k3s/server/manifests/gitpod"},
	{Msg: "starting Gitpod", Success: "gitpod-telemetry-init"},
	{Msg: "Gitpod is running"},
}

func main() {
	dmp, err := os.OpenFile("logs.txt", os.O_WRONLY|os.O_TRUNC|os.O_CREATE, 0644)
	if err != nil {
		panic(err)
	}
	defer dmp.Close()

	r := io.TeeReader(os.Stdin, dmp)

	scan := bufio.NewScanner(r)
	var msgIdx int
	lastSpinner, _ := pterm.DefaultSpinner.Start(msgs[msgIdx].Msg)
	for scan.Scan() {
		line := scan.Text()
		msg := msgs[msgIdx]

		var next bool
		switch {
		case msg.Fail != "" && strings.Contains(line, msg.Fail):
			lastSpinner.Fail()
			next = true
		case msg.Success != "" && strings.Contains(line, msg.Success):
			lastSpinner.Success()
			next = true
		}

		if !next {
			continue
		}

		msgIdx++
		if msgIdx >= len(msgs) {
			return
		}
		lastSpinner, _ = pterm.DefaultSpinner.Start(msgs[msgIdx].Msg)
	}
	err = scan.Err()
	if errors.Is(err, io.EOF) {
		err = nil
	}
	if err != nil {
		panic(err)
	}
}
