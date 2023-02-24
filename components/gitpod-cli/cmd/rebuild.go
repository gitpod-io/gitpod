// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"bufio"
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

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"golang.org/x/xerrors"

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
	logLevel, err := logrus.ParseLevel(rebuildOpts.LogLevel)
	if err != nil {
		return GpError{Err: err, OutCome: utils.Outcome_UserErr, ErrorCode: utils.RebuildErrorCode_InvaligLogLevel}
	}

	// 1. validate configuration
	wsInfo, err := supervisorClient.Info.WorkspaceInfo(ctx, &api.WorkspaceInfoRequest{})
	if err != nil {
		return err
	}

	checkoutLocation := rebuildOpts.WorkspaceFolder
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
		image = "gitpod/workspace-full:latest"
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
	if rebuildOpts.Prebuild {
		workspaceType = api.DebugWorkspaceType_prebuild
	} else if rebuildOpts.From == "prebuild" {
		contentSource = api.ContentSource_from_prebuild
	} else if rebuildOpts.From == "snapshot" {
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
	workspaceEnvs, err := getWorkspaceEnvs(ctx, &connectToServerOptions{supervisorClient, wsInfo, serverLog})
	if err != nil {
		return err
	}

	var envs string
	for _, env := range debugEnvs.Envs {
		envs += env + "\n"
	}
	for _, env := range rebuildOpts.GitpodEnvs {
		envs += env + "\n"
	}
	for _, env := range workspaceEnvs {
		envs += fmt.Sprintf("%s=%s\n", env.Name, env.Value)
	}

	envFile := filepath.Join(tmpDir, ".env")
	err = os.WriteFile(envFile, []byte(envs), 0644)
	if err != nil {
		return err
	}

	// we don't pass context on purporse to handle graceful shutdown
	// and output all logs properly below
	runCmd := exec.Command(
		dockerPath,
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

		// volumes
		"-v", "/workspace:/workspace",
		"-v", "/.supervisor:/.supervisor",
		"-v", "/var/run/docker.sock:/var/run/docker.sock",
		"-v", "/ide:/ide",
		// "-v", "/ide-desktop:/ide-desktop", // TODO fix desktop IDEs later
		// "-v", "/ide-desktop-plugins:/ide-desktop-plugins", // TODO refactor to keep all IDE deps under ide or ide-desktop

		image,
		"/.supervisor/supervisor", "init",
	)

	debugSupervisor, err := supervisor.New(ctx, &supervisor.SupervisorClientOption{
		Address: "localhost:24999",
	})
	if err != nil {
		return err
	}

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
		err := notify(ctx, supervisorClient, workspaceUrl.String(), "The workspace is UP.")
		if err != nil && ctx.Err() == nil {
			log.WithError(err).Error("failed to notify")
		}
	}()

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

func notify(ctx context.Context, supervisorClient *supervisor.SupervisorClient, workspaceUrl, message string) error {
	response, err := supervisorClient.Notification.Notify(ctx, &api.NotifyRequest{
		Level:   api.NotifyRequest_INFO,
		Message: message,
		Actions: []string{"Open"},
	})
	if err != nil {
		return err
	}
	if response.Action == "Open" {
		gpPath, err := exec.LookPath("gp")
		if err != nil {
			return err
		}
		gpCmd := exec.CommandContext(ctx, gpPath, "preview", "--external", workspaceUrl)
		gpCmd.Stdout = os.Stdout
		gpCmd.Stderr = os.Stderr
		return gpCmd.Run()
	}
	return nil
}

var rebuildOpts struct {
	WorkspaceFolder string
	LogLevel        string
	From            string
	Prebuild        bool

	// internal
	GitpodEnvs []string
}

var rebuildCmd = &cobra.Command{
	Use:    "rebuild",
	Short:  "[experimental] Re-builds the workspace (useful to debug a workspace configuration)",
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

	rootCmd.AddCommand(rebuildCmd)
	rebuildCmd.PersistentFlags().StringVarP(&rebuildOpts.WorkspaceFolder, "workspace-folder", "w", workspaceFolder, "Path to the workspace folder.")
	rebuildCmd.PersistentFlags().StringVarP(&rebuildOpts.LogLevel, "log", "", "error", "Log level to use. Allowed values are 'error', 'warn', 'info', 'debug', 'trace'.")
	rebuildCmd.PersistentFlags().StringVarP(&rebuildOpts.From, "from", "", "", "Starts from 'prebuild' or 'snapshot'.")
	rebuildCmd.PersistentFlags().BoolVarP(&rebuildOpts.Prebuild, "prebuild", "", false, "starts as a prebuild workspace (--from is ignored).")

	// internal
	rebuildCmd.PersistentFlags().StringArrayVarP(&rebuildOpts.GitpodEnvs, "gitpod-env", "", nil, "")
	rebuildCmd.PersistentFlags().MarkHidden("gitpod-env")
}
