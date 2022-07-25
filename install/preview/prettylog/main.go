// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the MIT License. See License-MIT.txt in the project root for license information.

package main

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/pterm/pterm"
	"gopkg.in/segmentio/analytics-go.v3"
)

const (
	telemetryEvent = "localpreview_status"
)

var (
	segmentIOToken string
	msgs           = []struct {
		Fail    string
		Success string
		Status  string

		Msg string
	}{
		{Msg: "checking prerequisites", Fail: "requires a system with at least", Success: "Gitpod Domain:", Status: "checking prerequisites"},
		{Msg: "preparing system", Success: "extracting images to download ahead"},
		{Msg: "downloading images", Success: "--output-split-files"},
		{Msg: "preparing Gitpod preview installation", Success: "rm -rf /var/lib/rancher/k3s/server/manifests/gitpod"},
		{Msg: "starting Gitpod", Success: "Gitpod pods are ready", Status: "starting gitpod"},
		{Msg: fmt.Sprintf("Gitpod is running. Visit https://%s to access the dashboard", os.Getenv("DOMAIN")), Status: "gitpod ready"},
	}
)

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
	// send Telemetry update for the first phase
	send_telemetry(msgs[msgIdx].Status)
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
		// send Telemetry for phase update
		send_telemetry(msgs[msgIdx].Status)

	}
	err = scan.Err()
	if errors.Is(err, io.EOF) {
		err = nil
	}
	if err != nil {
		panic(err)
	}
}

func send_telemetry(status string) {
	if os.Getenv("DO_NOT_TRACK") != "1" && status != "" {
		if segmentIOToken == "" {
			panic("No segmentIOToken set during build")
		}

		client, _ := analytics.NewWithConfig(segmentIOToken, analytics.Config{})
		defer func() {
			client.Close()

		}()

		telemetry := analytics.Track{
			UserId: os.Getenv("USER_ID"),
			Event:  telemetryEvent,
			Properties: analytics.NewProperties().
				Set("status", status),
		}
		client.Enqueue(telemetry)
	}
}
