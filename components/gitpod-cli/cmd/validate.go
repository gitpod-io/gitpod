// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/gitpod-io/gitpod/supervisor/api"
	prefixed "github.com/x-cray/logrus-prefixed-formatter"
)

func stopDebugContainer(ctx context.Context, dockerPath string) error {
	cmd := exec.CommandContext(ctx, dockerPath, "ps", "-q", "-f", "label=gp-rebuild")
	containerIds, err := cmd.Output()
	if err != nil {
		return nil
	}

	for _, id := range strings.Split(string(containerIds), "\n") {
		if len(id) == 0 {
			continue
		}
		_ = exec.CommandContext(ctx, dockerPath, "stop", id).Run()
		_ = exec.CommandContext(ctx, dockerPath, "rm", "-f", id).Run()
	}
	return nil
}

func runRebuild(ctx context.Context, supervisorClient *supervisor.SupervisorClient) error {
	logLevel, err := logrus.ParseLevel(validateOpts.LogLevel)
	if err != nil {
		return GpError{Err: err, OutCome: utils.Outcome_UserErr, ErrorCode: utils.RebuildErrorCode_InvaligLogLevel}
	}

	// 1. validate configuration
	wsInfo, err := supervisorClient.Info.WorkspaceInfo(ctx, &api.WorkspaceInfoRequest{})
	if err != nil {
		return err
	}

	checkoutLocation := validateOpts.WorkspaceFolder
	if checkoutLocation == "" {
		checkoutLocation = wsInfo.CheckoutLocation
	}

	gitpodConfig, err := utils.ParseGitpodConfig(checkoutLocation)
	if err != nil {
		fmt.Println("The .gitpod.yml file cannot be parsed: please check the file and try again")
		fmt.Println("")
		fmt.Println("For help check out the reference page:")
		fmt.Println("https://www.gitpod.io/docs/references/gitpod-yml#gitpodyml")
		return GpError{Err: err, OutCome: utils.Outcome_UserErr, ErrorCode: utils.RebuildErrorCode_MalformedGitpodYaml, Silence: true}
	}

	if gitpodConfig == nil {
		fmt.Println("To test the image build, you need to configure your project with a .gitpod.yml file")
		fmt.Println("")
		fmt.Println("For a quick start, try running:\n$ gp init -i")
		fmt.Println("")
		fmt.Println("Alternatively, check out the following docs for getting started configuring your project")
		fmt.Println("https://www.gitpod.io/docs/configure#configure-gitpod")
		return GpError{Err: err, OutCome: utils.Outcome_UserErr, ErrorCode: utils.RebuildErrorCode_MissingGitpodYaml, Silence: true}
	}

	var image string
	var dockerfilePath string
	var dockerContext string
	switch img := gitpodConfig.Image.(type) {
	case nil:
		image, err = getDefaultWorkspaceImage(ctx, wsInfo)
		if err != nil {
			return err
		}
		if image == "" {
			image = "gitpod/workspace-full:latest"
		}
		fmt.Println("Using default workspace image:", image)
	case string:
		image = img
	case map[interface{}]interface{}:
		dockerfilePath = filepath.Join(checkoutLocation, img["file"].(string))
		dockerContext = checkoutLocation
		if context, ok := img["context"].(string); ok {
			dockerContext = filepath.Join(checkoutLocation, context)
		}

		if _, err := os.Stat(dockerfilePath); os.IsNotExist(err) {
			fmt.Println("Your .gitpod.yml points to a Dockerfile that doesn't exist: " + dockerfilePath)
			return GpError{Err: err, OutCome: utils.Outcome_UserErr, Silence: true}
		}
		if _, err := os.Stat(dockerContext); os.IsNotExist(err) {
			fmt.Println("Your image context doesn't exist: " + dockerContext)
			return GpError{Err: err, OutCome: utils.Outcome_UserErr, Silence: true}
		}
		dockerfile, err := os.ReadFile(dockerfilePath)
		if err != nil {
			return err
		}
		if string(dockerfile) == "" {
			fmt.Println("Your Gitpod's Dockerfile is empty")
			fmt.Println("")
			fmt.Println("To learn how to customize your workspace, check out the following docs:")
			fmt.Println("https://www.gitpod.io/docs/configure/workspaces/workspace-image#use-a-custom-dockerfile")
			fmt.Println("")
			fmt.Println("Once you configure your Dockerfile, re-run this command to validate your changes")
			return GpError{Err: err, OutCome: utils.Outcome_UserErr, Silence: true}
		}
	default:
		fmt.Println("Check your .gitpod.yml and make sure the image property is configured correctly")
		return GpError{Err: err, OutCome: utils.Outcome_UserErr, ErrorCode: utils.RebuildErrorCode_MalformedGitpodYaml, Silence: true}
	}

	// 2. build image
	fmt.Println("Building the workspace image...")

	tmpDir, err := os.MkdirTemp("", "gp-rebuild-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	dockerPath, err := exec.LookPath("docker")
	if err == nil {
		// smoke test user docker cli
		err = exec.CommandContext(ctx, dockerPath, "--version").Run()
	}
	if err != nil {
		dockerPath = "/.supervisor/gitpod-docker-cli"
	}

	var dockerCmd *exec.Cmd
	if image != "" {
		err = exec.CommandContext(ctx, dockerPath, "image", "inspect", image).Run()
		if err == nil {
			fmt.Printf("%s: image found\n", image)
		} else {
			dockerCmd = exec.CommandContext(ctx, dockerPath, "image", "pull", image)
		}
	} else {
		image = "gp-rebuild-temp-build"
		dockerCmd = exec.CommandContext(ctx, dockerPath, "build", "-t", image, "-f", dockerfilePath, dockerContext)
	}
	if dockerCmd != nil {
		dockerCmd.Stdout = os.Stdout
		dockerCmd.Stderr = os.Stderr

		imageBuildStartTime := time.Now()
		err = dockerCmd.Run()
		if _, ok := err.(*exec.ExitError); ok {
			fmt.Println("Image Build Failed")
			return GpError{Err: err, OutCome: utils.Outcome_UserErr, ErrorCode: utils.RebuildErrorCode_ImageBuildFailed, Silence: true}
		} else if err != nil {
			fmt.Println("Docker error")
			return GpError{Err: err, ErrorCode: utils.RebuildErrorCode_DockerErr, Silence: true}
		}
		utils.TrackCommandUsageEvent.ImageBuildDuration = time.Since(imageBuildStartTime).Milliseconds()
	}

	// 3. start debug
	fmt.Println("")
	runLog := log.New()
	runLog.Logger.SetLevel(logrus.TraceLevel)
	setLoggerFormatter(runLog.Logger)
	runLog.Logger.SetOutput(os.Stdout)
	runLog.Info("Starting the workspace...")

	if wsInfo.DebugWorkspaceType != api.DebugWorkspaceType_noDebug {
		runLog.Error("It is not possible to restart the workspace while you are currently inside it.")
		return GpError{Err: err, OutCome: utils.Outcome_UserErr, ErrorCode: utils.RebuildErrorCode_AlreadyInDebug, Silence: true}
	}
	stopDebugContainer(ctx, dockerPath)

	workspaceUrl, err := url.Parse(wsInfo.WorkspaceUrl)
	if err != nil {
		return err
	}
	workspaceUrl.Host = "debug-" + workspaceUrl.Host

	// TODO validate that checkout and workspace locations don't leave /workspace folder
	workspaceLocation := gitpodConfig.WorkspaceLocation
	if workspaceLocation != "" {
		if !filepath.IsAbs(workspaceLocation) {
			workspaceLocation = filepath.Join("/workspace", workspaceLocation)
		}
	} else {
		workspaceLocation = checkoutLocation
	}

	// TODO what about auto derived by server, i.e. JB for prebuilds? we should move them into the workspace then
	tasks, err := json.Marshal(gitpodConfig.Tasks)
	if err != nil {
		return err
	}

	workspaceType := api.DebugWorkspaceType_regular
	contentSource := api.ContentSource_from_other
	if validateOpts.Prebuild {
		workspaceType = api.DebugWorkspaceType_prebuild
	} else if validateOpts.From == "prebuild" {
		contentSource = api.ContentSource_from_prebuild
	} else if validateOpts.From == "snapshot" {
		contentSource = api.ContentSource_from_backup
	}
	debugEnvs, err := supervisorClient.Control.CreateDebugEnv(ctx, &api.CreateDebugEnvRequest{
		WorkspaceType:     workspaceType,
		ContentSource:     contentSource,
		WorkspaceUrl:      workspaceUrl.String(),
		CheckoutLocation:  checkoutLocation,
		WorkspaceLocation: workspaceLocation,
		Tasks:             string(tasks),
		LogLevel:          logLevel.String(),
	})
	if err != nil {
		return err
	}

	serverLog := logrus.NewEntry(logrus.New())
	serverLog.Logger.SetLevel(logLevel)
	setLoggerFormatter(serverLog.Logger)
	workspaceEnvs, err := getWorkspaceEnvs(ctx, &connectToServerOptions{supervisorClient, wsInfo, serverLog, envScopeRepo})
	if err != nil {
		return err
	}

	var envs string
	for _, env := range debugEnvs.Envs {
		envs += env + "\n"
	}
	for _, env := range validateOpts.GitpodEnvs {
		envs += env + "\n"
	}
	if validateOpts.Headless {
		envs += "GITPOD_HEADLESS=true\n"
	}
	for _, env := range workspaceEnvs {
		envs += fmt.Sprintf("%s=%s\n", env.Name, env.Value)
	}

	envFile := filepath.Join(tmpDir, ".env")
	err = os.WriteFile(envFile, []byte(envs), 0644)
	if err != nil {
		return err
	}

	type mnte struct {
		IsFile     bool
		Target     string
		Source     string
		Permission os.FileMode
		Optional   bool
	}

	prepareFS := []mnte{
		{Source: "/workspace"},
		{Source: "/.supervisor"},
		{Source: "/ide"},
		{Source: "/ide-desktop", Optional: true},
		{Source: "/ide-desktop-plugins", Optional: true},
		{Source: "/workspace/.gitpod-debug/.docker-root", Target: "/workspace/.docker-root", Permission: 0710},
		{Source: "/workspace/.gitpod-debug/.gitpod", Target: "/workspace/.gitpod", Permission: 0751},
		{Source: "/workspace/.gitpod-debug/.vscode-remote", Target: "/workspace/.vscode-remote", Permission: 0751},
		{Source: "/workspace/.gitpod-debug/.cache", Target: "/workspace/.cache", Permission: 0751},
		{Source: "/workspace/.gitpod-debug/.config", Target: "/workspace/.config", Permission: 0751},
		{Source: "/usr/bin/docker-up", IsFile: true},
		{Source: "/usr/bin/runc-facade", IsFile: true},
		{Source: "/usr/local/bin/docker-compose", IsFile: true},
	}

	dockerArgs := []string{
		"run",
		"--rm",
		"--user", "root",
		"--privileged",
		"--label", "gp-rebuild=true",
		"--env-file", envFile,

		// ports
		"-p", "24999:22999", // supervisor
		"-p", "25000:23000", // Web IDE
		"-p", "25001:23001", // SSH
		// 23002 dekstop IDE port, but it is covered by debug workspace proxy
		"-p", "25003:23003", // debug workspace proxy
	}

	for _, mnt := range prepareFS {
		fd, err := os.Stat(mnt.Source)
		if err != nil {
			if (os.IsPermission(err) || os.IsNotExist(err)) && mnt.Optional {
				continue
			}
			if !os.IsNotExist(err) {
				return err
			}
			if mnt.IsFile {
				return err
			}
			err = os.MkdirAll(mnt.Source, mnt.Permission)
			if err != nil {
				return err
			}
			fd, err = os.Stat(mnt.Source)
			if err != nil {
				return err
			}
		}
		if fd.IsDir() != !mnt.IsFile {
			return xerrors.Errorf("invalid file type for %s", mnt.Source)
		}
		if mnt.Target == "" {
			mnt.Target = mnt.Source
		} else if !mnt.IsFile {
			// if target is not same with source and it not a file, ensure target is created by gitpod user
			_, err = os.Stat(mnt.Target)
			if err != nil {
				if (os.IsPermission(err) || os.IsNotExist(err)) && mnt.Optional {
					continue
				}
				if !os.IsNotExist(err) {
					return err
				}
				err = os.MkdirAll(mnt.Target, mnt.Permission)
				if err != nil {
					return err
				}
				_, err = os.Stat(mnt.Target)
				if err != nil {
					return err
				}
			}
		}
		dockerArgs = append(dockerArgs, "-v", fmt.Sprintf("%s:%s", mnt.Source, mnt.Target))
	}

	dockerArgs = append(dockerArgs, image, "/.supervisor/supervisor", "init")

	// we don't pass context on purporse to handle graceful shutdown
	// and output all logs properly below
	runCmd := exec.Command(
		dockerPath,
		dockerArgs...,
	)

	debugSupervisor, err := supervisor.New(ctx, &supervisor.SupervisorClientOption{
		Address: "localhost:24999",
	})
	if err != nil {
		return err
	}

	if validateOpts.Headless {
		go func() {
			tasks, ok := waitForAllTasksToOpen(ctx, debugSupervisor, runLog)
			if !ok {
				return
			}
			for _, task := range tasks {
				go pipeTask(ctx, task, debugSupervisor, runLog)
			}
		}()
	} else {
		go func() {
			debugSupervisor.WaitForIDEReady(ctx)
			if ctx.Err() != nil {
				return
			}

			ssh := "ssh 'debug-" + wsInfo.WorkspaceId + "@" + workspaceUrl.Host + ".ssh." + wsInfo.WorkspaceClusterHost + "'"
			sep := strings.Repeat("=", len(ssh))
			runLog.Infof(`The workspace is UP!
%s

Open in Browser at:
%s

Connect using SSH keys (https://gitpod.io/keys):
%s

%s`, sep, workspaceUrl, ssh, sep)
			err := openWindow(ctx, workspaceUrl.String())
			if err != nil && ctx.Err() == nil {
				log.WithError(err).Error("failed to open window")
			}
		}()
	}

	pipeLogs := func(input io.Reader, ideLevel logrus.Level) {
		reader := bufio.NewReader(input)
		for {
			line, _, err := reader.ReadLine()
			if err != nil {
				return
			}
			if len(line) == 0 {
				continue
			}
			msg := make(logrus.Fields)
			err = json.Unmarshal(line, &msg)
			if err != nil {
				if ideLevel > logLevel {
					continue
				}

				runLog.WithFields(msg).Log(ideLevel, string(line))
			} else {
				wsLevel, err := logrus.ParseLevel(fmt.Sprintf("%v", msg["level"]))
				if err != nil {
					wsLevel = logrus.DebugLevel
				}
				if wsLevel == logrus.FatalLevel {
					wsLevel = logrus.ErrorLevel
				}
				if wsLevel > logLevel {
					continue
				}

				message := fmt.Sprintf("%v", msg["message"])
				delete(msg, "message")
				delete(msg, "level")
				delete(msg, "time")
				delete(msg, "severity")
				delete(msg, "@type")

				component := fmt.Sprintf("%v", msg["component"])
				if wsLevel != logrus.DebugLevel && wsLevel != logrus.TraceLevel {
					delete(msg, "file")
					delete(msg, "func")
					delete(msg, "serviceContext")
					delete(msg, "component")
				} else if component == "grpc" {
					continue
				}

				runLog.WithFields(msg).Log(wsLevel, message)
			}
		}
	}

	stdout, err := runCmd.StdoutPipe()
	if err != nil {
		return err
	}
	go pipeLogs(stdout, logrus.InfoLevel)

	stderr, err := runCmd.StderrPipe()
	if err != nil {
		return err
	}
	go pipeLogs(stderr, logrus.ErrorLevel)

	err = runCmd.Start()
	if err != nil {
		fmt.Println("Failed to run a workspace")
		return GpError{Err: err, OutCome: utils.Outcome_UserErr, ErrorCode: utils.RebuildErrorCode_DockerRunFailed, Silence: true}
	}

	stopped := make(chan struct{})
	go func() {
		_ = runCmd.Wait()
		close(stopped)
	}()

	select {
	case <-ctx.Done():
		fmt.Println("")
		logrus.Info("Gracefully stopping the workspace...")
		stopDebugContainer(context.Background(), dockerPath)
	case <-stopped:
	}

	return nil
}

func setLoggerFormatter(logger *logrus.Logger) {
	logger.SetFormatter(&prefixed.TextFormatter{
		TimestampFormat: "2006-01-02 15:04:05",
		FullTimestamp:   true,
		ForceFormatting: true,
		ForceColors:     true,
	})
}

func openWindow(ctx context.Context, workspaceUrl string) error {
	gpPath, err := exec.LookPath("gp")
	if err != nil {
		return err
	}
	gpCmd := exec.CommandContext(ctx, gpPath, "preview", "--external", workspaceUrl)
	gpCmd.Stdout = os.Stdout
	gpCmd.Stderr = os.Stderr
	return gpCmd.Run()
}

func waitForAllTasksToOpen(ctx context.Context, supervisor *supervisor.SupervisorClient, runLog *logrus.Entry) (tasks []*api.TaskStatus, allTasksOpened bool) {
	for !allTasksOpened {
		time.Sleep(1 * time.Second)
		if ctx.Err() != nil {
			return
		}
		listener, err := supervisor.Status.TasksStatus(ctx, &api.TasksStatusRequest{
			Observe: true,
		})
		if err != nil {
			continue
		}
		tasks, allTasksOpened = checkAllTasksOpened(ctx, listener, runLog)
	}
	return
}

func checkAllTasksOpened(ctx context.Context, listener api.StatusService_TasksStatusClient, runLog *logrus.Entry) (tasks []*api.TaskStatus, allTasksOpened bool) {
	for !allTasksOpened {
		resp, err := listener.Recv()
		if err != nil {
			return
		}
		tasks = resp.GetTasks()
		allTasksOpened = areTasksOpened(tasks)
	}
	return
}

func areTasksOpened(tasks []*api.TaskStatus) bool {
	for _, task := range tasks {
		if task.State == api.TaskState_opening {
			return false
		}
	}
	return true
}

func pipeTask(ctx context.Context, task *api.TaskStatus, supervisor *supervisor.SupervisorClient, runLog *logrus.Entry) {
	for {
		err := listenTerminal(ctx, task, supervisor, runLog)
		if err == nil || ctx.Err() != nil {
			return
		}
		status, ok := status.FromError(err)
		if ok && status.Code() == codes.NotFound {
			return
		}
		runLog.WithError(err).Errorf("%s: failed to listen, retrying...", task.Presentation.Name)
		time.Sleep(1 * time.Second)
	}
}

// TerminalReader is an interface for anything that can receive terminal data (this is abstracted for use in testing)
type TerminalReader interface {
	Recv() ([]byte, error)
}

type LinePrinter func(string)

// processTerminalOutput reads from a TerminalReader, processes the output, and calls the provided LinePrinter for each complete line.
// It handles UTF-8 decoding of characters split across chunks and control characters (\n \r \b).
func processTerminalOutput(reader TerminalReader, printLine LinePrinter) error {
	var buffer, line bytes.Buffer

	flushLine := func() {
		if line.Len() > 0 {
			printLine(line.String())
			line.Reset()
		}
	}

	for {
		data, err := reader.Recv()
		if err != nil {
			if err == io.EOF {
				flushLine()
				return nil
			}
			return err
		}

		buffer.Write(data)

		for {
			r, size := utf8.DecodeRune(buffer.Bytes())
			if r == utf8.RuneError && size == 0 {
				break // incomplete character at the end
			}

			char := buffer.Next(size)

			switch r {
			case '\r':
				flushLine()
			case '\n':
				flushLine()
			case '\b':
				if line.Len() > 0 {
					line.Truncate(line.Len() - 1)
				}
			default:
				line.Write(char)
			}
		}
	}
}

func listenTerminal(ctx context.Context, task *api.TaskStatus, supervisor *supervisor.SupervisorClient, runLog *logrus.Entry) error {
	listen, err := supervisor.Terminal.Listen(ctx, &api.ListenTerminalRequest{Alias: task.Terminal})
	if err != nil {
		return err
	}

	terminalReader := &TerminalReaderAdapter{listen}
	printLine := func(line string) {
		runLog.Infof("%s: %s", task.Presentation.Name, line)
	}

	return processTerminalOutput(terminalReader, printLine)
}

type TerminalReaderAdapter struct {
	client api.TerminalService_ListenClient
}

func (t *TerminalReaderAdapter) Recv() ([]byte, error) {
	resp, err := t.client.Recv()
	if err != nil {
		return nil, err
	}
	return resp.GetData(), nil
}

var validateOpts struct {
	WorkspaceFolder string
	LogLevel        string
	From            string
	Prebuild        bool
	Headless        bool

	// internal
	GitpodEnvs []string
}

var validateCmd = &cobra.Command{
	Use:    "validate",
	Short:  "[experimental] Validates the workspace (useful to debug a workspace configuration)",
	Hidden: false,
	RunE: func(cmd *cobra.Command, args []string) error {
		supervisorClient, err := supervisor.New(cmd.Context())
		if err != nil {
			return xerrors.Errorf("Could not get workspace info required to build: %w", err)
		}
		defer supervisorClient.Close()

		return runRebuild(cmd.Context(), supervisorClient)
	},
}

var rebuildCmd = &cobra.Command{
	Hidden:     true,
	Use:        "rebuild",
	Deprecated: "please use `gp validate` instead.",
	Short:      validateCmd.Short,
	RunE:       validateCmd.RunE,
}

func init() {
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	var workspaceFolder string
	client, err := supervisor.New(ctx)
	if err == nil {
		wsInfo, err := client.Info.WorkspaceInfo(ctx, &api.WorkspaceInfoRequest{})
		if err == nil {
			workspaceFolder = wsInfo.CheckoutLocation
		}
	}

	setFlags := func(cmd *cobra.Command) {
		cmd.PersistentFlags().BoolVarP(&validateOpts.Prebuild, "prebuild", "", false, "starts as a prebuild workspace.")
		cmd.PersistentFlags().StringVarP(&validateOpts.LogLevel, "log", "", "error", "Log level to use. Allowed values are 'error', 'warn', 'info', 'debug', 'trace'.")

		// internal
		cmd.PersistentFlags().StringArrayVarP(&validateOpts.GitpodEnvs, "gitpod-env", "", nil, "")
		cmd.PersistentFlags().StringVarP(&validateOpts.WorkspaceFolder, "workspace-folder", "w", workspaceFolder, "Path to the workspace folder.")
		cmd.PersistentFlags().StringVarP(&validateOpts.From, "from", "", "", "Starts from 'prebuild' or 'snapshot'.")
		cmd.PersistentFlags().BoolVarP(&validateOpts.Headless, "headless", "", false, "Starts in headless mode.")
		_ = cmd.PersistentFlags().MarkHidden("gitpod-env")
		_ = cmd.PersistentFlags().MarkHidden("workspace-folder")
		_ = cmd.PersistentFlags().MarkHidden("from")
		_ = cmd.PersistentFlags().MarkHidden("headless")
	}

	setFlags(validateCmd)
	setFlags(rebuildCmd)

	rootCmd.AddCommand(validateCmd)
	rootCmd.AddCommand(rebuildCmd)
}
