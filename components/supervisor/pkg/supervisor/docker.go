// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/cenkalti/backoff/v4"
	"golang.org/x/xerrors"

	"github.com/gitpod-io/gitpod/common-go/analytics"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/common-go/process"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/gitpod-io/gitpod/supervisor/pkg/activation"
	"github.com/gitpod-io/gitpod/supervisor/pkg/dropwriter"
	"github.com/gitpod-io/gitpod/supervisor/pkg/terminal"
)

// if exit error happens one after another within dockerStartErrorBurstDuration then we're in the burst
// and should stop trying after maxBurstDockerStartAttempts
const (
	maxBurstDockerStartAttempts   = 8
	dockerStartErrorBurstDuration = time.Minute * 1
	maxIntervalBetweenDockerStart = 15 * time.Second

	logsDir             = "/workspace/.gitpod/logs"
	dockerUpLogFilePath = logsDir + "/docker-up.log"
)

var (
	failedForRetryError = errors.New("failed for retry start docker-up")
)

func socketActivationForDocker(parentCtx context.Context, wg *sync.WaitGroup, term *terminal.Mux, cfg *Config, telemetry analytics.Writer, notifications *NotificationService, cstate ContentState) {
	defer wg.Done()

	ctx, cancel := context.WithCancel(parentCtx)
	defer cancel()

	// only start activation if content is ready
	<-cstate.ContentReady()

	if ctx.Err() != nil {
		return
	}

	logFile, err := openDockerUpLogFile()
	if err != nil {
		log.WithError(err).Error("docker-up: cannot open log file")
	} else {
		defer logFile.Close()
	}

	var notificationSent bool
	var notificationDisabled = cfg.isHeadless() || logFile == nil
	notifyDockerUpFail := func() error {
		if notificationDisabled || notificationSent {
			return nil
		}
		notificationSent = true
		defer func() {
			notificationSent = false
		}()
		openLogs := "Open Logs"
		dontShowAgain := "Don't Show Again"
		resp, err := notifications.Notify(ctx, &api.NotifyRequest{
			Level:   api.NotifyRequest_ERROR,
			Message: "Docker daemon is failing to start.",
			Actions: []string{openLogs, dontShowAgain},
		})
		if err != nil {
			return err
		}
		telemetry.Track(analytics.TrackMessage{
			Identity: analytics.Identity{UserID: cfg.OwnerId},
			Event:    "gitpod_activate_docker_fail_notification",
			Properties: map[string]interface{}{
				"instanceId":     cfg.WorkspaceInstanceID,
				"workspaceId":    cfg.WorkspaceID,
				"debugWorkspace": cfg.isDebugWorkspace(),
				"action":         resp.Action,
			},
		})
		if resp.Action == dontShowAgain {
			notificationDisabled = true
			return nil
		}
		if resp.Action != openLogs {
			return nil
		}
		gpPath, err := exec.LookPath("gp")
		if err != nil {
			return err
		}
		gpCmd := exec.CommandContext(ctx, gpPath, "open", dockerUpLogFilePath)
		gpCmd.Env = childProcEnvvars
		gpCmd.Stdout = os.Stdout
		gpCmd.Stderr = os.Stderr
		return gpCmd.Run()
	}

	var stdout, stderr io.Writer

	stdout = os.Stdout
	stderr = os.Stderr
	if cfg.WorkspaceLogRateLimit > 0 {
		limit := int64(cfg.WorkspaceLogRateLimit)
		stdout = dropwriter.Writer(stdout, dropwriter.NewBucket(limit*1024*3, limit*1024))
		stderr = dropwriter.Writer(stderr, dropwriter.NewBucket(limit*1024*3, limit*1024))
		log.WithField("limit_kb_per_sec", limit).Info("docker-up: rate limiting log output")
	}

	if logFile != nil {
		stdout = io.MultiWriter(stdout, logFile)
		stderr = io.MultiWriter(stderr, logFile)
	}

	for ctx.Err() == nil {
		err := listenToDockerSocket(ctx, term, cfg, telemetry, logFile, stdout, stderr)
		if ctx.Err() != nil {
			return
		}

		if errors.Is(err, failedForRetryError) {
			go func() {
				notifyErr := notifyDockerUpFail()
				if notifyErr != nil && !errors.Is(notifyErr, context.Canceled) {
					log.WithError(notifyErr).Error("cannot notify about docker-up failure")
				}
			}()
		}

		time.Sleep(1 * time.Second)
	}
}

// listenToDockerSocket listens to the docker socket and starts the docker-up process
// if it fails to start with sometimes retry then listener is closed to requests all incoming requests and prevent infinite try
func listenToDockerSocket(parentCtx context.Context, term *terminal.Mux, cfg *Config, telemetry analytics.Writer, logFile *os.File, stdout, stderr io.Writer) error {
	ctx, cancel := context.WithCancel(parentCtx)
	defer cancel()

	fn := "/var/run/docker.sock"
	l, err := net.Listen("unix", fn)
	if err != nil {
		return err
	}

	go func() {
		<-ctx.Done()
		l.Close()
	}()

	_ = os.Chown(fn, gitpodUID, gitpodGID)

	var lastExitErrorTime time.Time
	burstAttempts := 0
	backoffStrategy := backoff.NewExponentialBackOff()
	backoffStrategy.MaxInterval = maxIntervalBetweenDockerStart

	for ctx.Err() == nil {
		err = activation.Listen(ctx, l, func(socketFD *os.File) error {
			defer socketFD.Close()
			startTime := time.Now()
			telemetry.Track(analytics.TrackMessage{
				Identity: analytics.Identity{UserID: cfg.OwnerId},
				Event:    "gitpod_activate_docker",
				Properties: map[string]interface{}{
					"instanceId":     cfg.WorkspaceInstanceID,
					"workspaceId":    cfg.WorkspaceID,
					"debugWorkspace": cfg.isDebugWorkspace(),
				},
			})

			if logFile != nil {
				defer fmt.Fprintf(logFile, "\n======= Stop docker-up at %s =======\n", time.Now().Format(time.RFC3339))
				fmt.Fprintf(logFile, "======= Start docker-up at %s =======\n", startTime.Format(time.RFC3339))
			}

			cmd := exec.CommandContext(ctx, "/usr/bin/docker-up")
			cmd.Env = append(os.Environ(), "LISTEN_FDS=1")
			cmd.ExtraFiles = []*os.File{socketFD}
			cmd.Stdout = stdout
			cmd.Stderr = stderr

			err = cmd.Start()
			if err != nil {
				return err
			}
			ptyCtx, cancel := context.WithCancel(ctx)
			go func(ptyCtx context.Context) {
				select {
				case <-ctx.Done():
					_ = cmd.Process.Signal(syscall.SIGTERM)
				case <-ptyCtx.Done():
				}
			}(ptyCtx)
			err = cmd.Wait()
			cancel()
			return err
		})

		if ctx.Err() != nil {
			return ctx.Err()
		}

		var exitError *exec.ExitError
		if err != nil {
			exitError, _ = err.(*exec.ExitError)
		}
		if exitError != nil && exitError.ExitCode() > 0 {
			// docker-up or daemon exited with an error - we'll try again
			// it can be a transient condition like apt is locked by another process to install prerequisites
			// or permament like misconfigured env var, image which does not allow to install prerequisites at all
			// or any general issue with docker daemon startup
			if time.Since(lastExitErrorTime) <= dockerStartErrorBurstDuration {
				// we're in the exit error burst
				burstAttempts++
			} else {
				// no burst, reset the counter
				burstAttempts = 0
				backoffStrategy.Reset()
			}
			lastExitErrorTime = time.Now()

		} else {
			// transient condition like a docker daemon get killed because of OOM
			burstAttempts = 0
			backoffStrategy.Reset()
		}

		nextBackOff := backoffStrategy.NextBackOff()

		if nextBackOff == backoff.Stop || burstAttempts >= maxBurstDockerStartAttempts {
			cancel()
			log.WithError(err).WithField("attempts", burstAttempts).Error("cannot activate docker after maximum attempts, stopping trying permanently")
			if logFile != nil {
				fmt.Fprintln(logFile, "Cannot activate docker after maximum attempts, stopping trying permanently.")
				fmt.Fprintln(logFile, "Please check logs above, fix the configuration, use `gp validate` to verify change, and commit to apply.")
				fmt.Fprintf(logFile, "If it does not help, please reach out to the support. Don't forget to share your workspace ID: %s.\n", cfg.WorkspaceID)
			}
			return failedForRetryError
		}

		if err != nil &&
			!errors.Is(err, context.Canceled) &&
			!process.IsNotChildProcess(err) &&
			!strings.Contains(err.Error(), "signal: ") {
			// don't log typical transient errors
			log.WithError(err).WithField("attempts", burstAttempts).WithField("backoff", nextBackOff.String()).Error("cannot activate docker, retrying...")
		}
		time.Sleep(nextBackOff)
	}
	return ctx.Err()
}

func openDockerUpLogFile() (*os.File, error) {
	if err := os.MkdirAll(logsDir, 0755); err != nil {
		return nil, xerrors.Errorf("cannot create logs dir: %w", err)
	}
	if err := os.Chown(logsDir, gitpodUID, gitpodGID); err != nil {
		return nil, xerrors.Errorf("cannot chown logs dir: %w", err)
	}
	logFile, err := os.OpenFile(dockerUpLogFilePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, xerrors.Errorf("cannot open docker-up log file: %w", err)
	}

	if err := os.Chown(dockerUpLogFilePath, gitpodUID, gitpodGID); err != nil {
		_ = logFile.Close()
		return nil, xerrors.Errorf("cannot chown docker-up log file: %w", err)
	}
	return logFile, nil
}
