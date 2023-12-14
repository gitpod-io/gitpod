// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/go-errors/errors"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/gitpod"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	log "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"

	ide_metrics "github.com/gitpod-io/gitpod/ide-metrics-api"
)

const (
	rootCmdName = "gp"
)

type GpError struct {
	Err       error
	Message   string
	OutCome   string
	ErrorCode string
	ExitCode  *int
	Silence   bool
}

func (e GpError) Error() string {
	if e.Silence {
		return ""
	}
	ret := e.Message
	if ret != "" && e.Err != nil {
		ret += ": "
	}
	if e.Err != nil {
		ret += e.Err.Error()
	}
	return ret
}

func GetCommandName(path string) []string {
	return strings.Fields(strings.TrimSpace(strings.TrimPrefix(path, rootCmdName)))
}

var lastSignal os.Signal

var rootCmd = &cobra.Command{
	Use:           rootCmdName,
	SilenceErrors: true,
	Short:         "Command line interface for Gitpod",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		cmd.SilenceUsage = true
		cmdName := GetCommandName(cmd.CommandPath())
		usedFlags := []string{}
		flags := cmd.Flags()
		flags.VisitAll(func(flag *pflag.Flag) {
			if flag.Changed {
				usedFlags = append(usedFlags, flag.Name)
			}
		})
		utils.TrackCommandUsageEvent.Args = int64(len(args))
		utils.TrackCommandUsageEvent.Command = cmdName
		utils.TrackCommandUsageEvent.Flags = usedFlags
		ctx, cancel := context.WithCancel(cmd.Context())
		cmd.SetContext(ctx)

		go func() {
			signals := make(chan os.Signal, 1)
			signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM, syscall.SIGHUP)
			lastSignal = <-signals
			cancel()
		}()
	},
}

var noColor bool

// Execute runs the root command
func Execute() {
	entrypoint := strings.TrimPrefix(filepath.Base(os.Args[0]), "gp-")
	for _, c := range rootCmd.Commands() {
		if c.Name() == entrypoint {
			// we can't call subcommands directly (they just call their parents - thanks cobra),
			// so instead we have to manipulate the os.Args
			os.Args = append([]string{os.Args[0], entrypoint}, os.Args[1:]...)
			break
		}
	}

	err := rootCmd.Execute()

	file, ferr := os.OpenFile(os.TempDir()+"/gitpod-cli-errors.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if ferr == nil {
		log.SetOutput(file)
		defer file.Close()
	} else {
		log.SetLevel(log.FatalLevel)
	}

	exitCode := 0
	utils.TrackCommandUsageEvent.Outcome = utils.Outcome_Success
	utils.TrackCommandUsageEvent.Duration = time.Since(time.UnixMilli(utils.TrackCommandUsageEvent.Timestamp)).Milliseconds()

	if err != nil {
		utils.TrackCommandUsageEvent.Outcome = utils.Outcome_SystemErr
		exitCode = 1
		if gpErr, ok := err.(GpError); ok {
			if gpErr.OutCome != "" {
				utils.TrackCommandUsageEvent.Outcome = gpErr.OutCome
			}
			if gpErr.ErrorCode != "" {
				utils.TrackCommandUsageEvent.ErrorCode = gpErr.ErrorCode
			}
			if gpErr.ExitCode != nil {
				exitCode = *gpErr.ExitCode
			}
		}
		if utils.TrackCommandUsageEvent.ErrorCode == "" {
			switch utils.TrackCommandUsageEvent.Outcome {
			case utils.Outcome_UserErr:
				utils.TrackCommandUsageEvent.ErrorCode = utils.UserErrorCode
			case utils.Outcome_SystemErr:
				utils.TrackCommandUsageEvent.ErrorCode = utils.SystemErrorCode
			}
		}
		if utils.TrackCommandUsageEvent.Outcome == utils.Outcome_SystemErr {
			errorReport(err)
		}
	}

	sendAnalytics()

	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(exitCode)
	}
	if sig, ok := lastSignal.(syscall.Signal); ok {
		os.Exit(128 + int(sig))
	}
}

func sendAnalytics() {
	if len(utils.TrackCommandUsageEvent.Command) == 0 {
		return
	}
	data, err := utils.TrackCommandUsageEvent.ExportToJson()
	if err != nil {
		return
	}
	cmd := exec.Command(
		"/.supervisor/supervisor",
		"send-analytics",
		"--event",
		"gp_command",
		"--data",
		data,
	)
	cmd.Stdout = ioutil.Discard
	cmd.Stderr = ioutil.Discard

	// fire and release
	err = cmd.Start()
	if err != nil {
		log.WithError(err).Error("cannot start send-analytics process")
		return
	}
	if cmd.Process != nil {
		_ = cmd.Process.Release()
	}
}

func errorReport(err error) {
	if err == nil {
		return
	}
	reportErrorRequest := &ide_metrics.ReportErrorRequest{
		ErrorStack: errors.New(err).ErrorStack(),
		Component:  "gitpod-cli",
		Version:    gitpod.Version,
	}

	payload, err := json.Marshal(reportErrorRequest)
	if err != nil {
		log.WithError(err).Error("failed to marshal json while attempting to report error")
		return
	}

	if err != nil {
		return
	}
	cmd := exec.Command(
		"/.supervisor/supervisor",
		"error-report",
		"--data",
		string(payload),
	)
	cmd.Stdout = ioutil.Discard
	cmd.Stderr = ioutil.Discard

	// fire and release
	err = cmd.Start()
	if err != nil {
		log.WithError(err).Error("cannot start error-report process")
		return
	}
	if cmd.Process != nil {
		_ = cmd.Process.Release()
	}
}
