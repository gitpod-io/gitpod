// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package telemetry

import (
	"errors"
	"log/slog"
	"math/rand"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/gitpod-io/local-app/pkg/prettyprint"
	segment "github.com/segmentio/analytics-go/v3"
	"github.com/spf13/cobra"
	"golang.org/x/exp/slices"
)

// Injected at build time
var segmentKey = "TgiJIVvFsBGwmxbnnt5NeeDaian9nr3n"

var opts struct {
	Enabled  bool
	Identity string
	Version  string

	client segment.Client
}

// Init initialises the telemetry
func Init(enabled bool, identity, version string) {
	opts.Enabled = enabled
	if !enabled {
		return
	}

	opts.Version = version
	opts.Identity = identity

	if segmentKey != "" {
		opts.client = segment.New(segmentKey)
	}
}

// DoNotTrack returns true if the user opted out of telemetry
// Implements the https://consoledonottrack.com/ proposal.
func DoNotTrack() bool {
	return os.Getenv("DO_NOT_TRACK") == "1"
}

// RandomIdentity generates a random identity
func RandomIdentity() string {
	letters := []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890")
	b := make([]rune, 32)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

func Close() {
	if opts.client != nil {
		opts.client.Close()
	}
}

// Identity returns the identity
func Identity() string {
	return opts.Identity
}

// Enabled returns true if the telemetry is enabled
func Enabled() bool {
	return opts.Enabled && opts.Identity != "" && opts.client != nil
}

func track(event string, props segment.Properties) {
	if !Enabled() {
		return
	}
	slog.Debug("tracking telemetry", "props", props, "event", event)

	err := opts.client.Enqueue(segment.Track{
		AnonymousId: opts.Identity,
		Event:       event,
		Timestamp:   time.Now(),
		Properties:  props,
	})
	if err != nil {
		slog.Debug("failed to track telemetry", "err", err)
	}
}

// RecordCommand records the execution of a CLI command
func RecordCommand(cmd *cobra.Command) {
	var command []string
	for c := cmd; c != nil; c = c.Parent() {
		command = append(command, c.Name())
	}
	slices.Reverse(command)

	track("gitpodcli_command", defaultProperties().
		Set("command", strings.Join(command, " ")))
}

// RecordError records an exception that occurred
func RecordError(err error) {
	var exception *prettyprint.ErrSystemException
	if !errors.As(err, &exception) {
		return
	}

	track("gitpodcli_exception", defaultProperties().
		Set("context", exception.Context).
		Set("error", exception.Err.Error()))
}

func defaultProperties() segment.Properties {
	return segment.NewProperties().
		Set("goos", runtime.GOOS).
		Set("goarch", runtime.GOARCH).
		Set("version", opts.Version)
}
