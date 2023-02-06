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
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/supervisor/api"
	prefixed "github.com/x-cray/logrus-prefixed-formatter"
)

func stopDebugContainer(ctx context.Context, dockerPath string) {
	cmd := exec.CommandContext(ctx, dockerPath, "ps", "-q", "-f", "label=gp-rebuild")
	containerIds, err := cmd.Output()
	if err != nil {
		return
	}

	for _, id := range strings.Split(string(containerIds), "\n") {
		if len(id) == 0 {
			continue
		}
		_ = exec.CommandContext(ctx, dockerPath, "stop", id).Run()
		_ = exec.CommandContext(ctx, dockerPath, "rm", "-f", id).Run()
	}
}

func runRebuild(ctx context.Context, supervisorClient *supervisor.SupervisorClient, event *utils.AnalyticsEvent) (string, error) {
	logLevel, err := logrus.ParseLevel(rebuildOpts.LogLevel)
	if err != nil {
		event.Data.ErrorCode = utils.RebuildErrorCode_InvaligLogLevel
		return utils.Outcome_UserErr, err
	}

	// 1. validate configuration
	wsInfo, err := supervisorClient.Info.WorkspaceInfo(ctx, &api.WorkspaceInfoRequest{})
	if err != nil {
		return utils.Outcome_SystemErr, err
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
		event.Set("ErrorCode", utils.RebuildErrorCode_MalformedGitpodYaml)
		return utils.Outcome_UserErr, err
	}

	if gitpodConfig == nil {
		fmt.Println("To test the image build, you need to configure your project with a .gitpod.yml file")
		fmt.Println("")
		fmt.Println("For a quick start, try running:\n$ gp init -i")
		fmt.Println("")
		fmt.Println("Alternatively, check out the following docs for getting started configuring your project")
		fmt.Println("https://www.gitpod.io/docs/configure#configure-gitpod")
		event.Set("ErrorCode", utils.RebuildErrorCode_MissingGitpodYaml)
		return utils.Outcome_UserErr, nil
	}

	var baseimage string
	switch img := gitpodConfig.Image.(type) {
	case nil:
		baseimage = "FROM gitpod/workspace-full:latest"
	case string:
		baseimage = "FROM " + img
	case map[interface{}]interface{}:
		dockerfilePath := filepath.Join(checkoutLocation, img["file"].(string))

		if _, err := os.Stat(dockerfilePath); os.IsNotExist(err) {
			fmt.Println("Your .gitpod.yml points to a Dockerfile that doesn't exist: " + dockerfilePath)
			return utils.Outcome_UserErr, err
		}
		dockerfile, err := os.ReadFile(dockerfilePath)
		if err != nil {
			return utils.Outcome_SystemErr, err
		}
		if string(dockerfile) == "" {
			fmt.Println("Your Gitpod's Dockerfile is empty")
			fmt.Println("")
			fmt.Println("To learn how to customize your workspace, check out the following docs:")
			fmt.Println("https://www.gitpod.io/docs/configure/workspaces/workspace-image#use-a-custom-dockerfile")
			fmt.Println("")
			fmt.Println("Once you configure your Dockerfile, re-run this command to validate your changes")
			return utils.Outcome_UserErr, nil
		}
		baseimage = "\n" + string(dockerfile) + "\n"
	default:
		fmt.Println("Check your .gitpod.yml and make sure the image property is configured correctly")
		event.Set("ErrorCode", utils.RebuildErrorCode_MalformedGitpodYaml)
		return utils.Outcome_UserErr, nil
	}

	if baseimage == "" {
		fmt.Println("Your project is not using any custom Docker image.")
		fmt.Println("Check out the following docs, to know how to get started")
		fmt.Println("")
		fmt.Println("https://www.gitpod.io/docs/configure/workspaces/workspace-image#use-a-public-docker-image")
		event.Set("ErrorCode", utils.RebuildErrorCode_NoCustomImage)
		return utils.Outcome_UserErr, nil
	}

	// 2. build image
	tmpDir, err := os.MkdirTemp("", "gp-rebuild-*")
	if err != nil {
		return utils.Outcome_SystemErr, err
	}
	defer os.RemoveAll(tmpDir)

	dockerFile := filepath.Join(tmpDir, "Dockerfile")
	err = os.WriteFile(dockerFile, []byte(baseimage), 0644)
	if err != nil {
		fmt.Println("Could not write the temporary Dockerfile")
		return utils.Outcome_SystemErr, err
	}

	dockerPath, err := exec.LookPath("docker")
	if err == nil {
		// smoke test user docker cli
		err = exec.CommandContext(ctx, dockerPath, "--version").Run()
	}
	if err != nil {
		dockerPath = "/.supervisor/gitpod-docker-cli"
	}

	imageTag := "gp-rebuild-temp-build"

	fmt.Println("Building the workspace image...")
	dockerCmd := exec.CommandContext(ctx, dockerPath, "build", "-t", imageTag, "-f", dockerFile, checkoutLocation)
	dockerCmd.Stdout = os.Stdout
	dockerCmd.Stderr = os.Stderr

	imageBuildStartTime := time.Now()
	err = dockerCmd.Run()
	if _, ok := err.(*exec.ExitError); ok {
		fmt.Println("Image Build Failed")
		event.Set("ErrorCode", utils.RebuildErrorCode_ImageBuildFailed)
		return utils.Outcome_UserErr, nil
	} else if err != nil {
		fmt.Println("Docker error")
		event.Set("ErrorCode", utils.RebuildErrorCode_DockerErr)
		return utils.Outcome_SystemErr, err
	}
	ImageBuildDuration := time.Since(imageBuildStartTime).Milliseconds()
	event.Set("ImageBuildDuration", ImageBuildDuration)

	// 3. start debug
	fmt.Println("")
	runLog := log.New()
	runLog.Logger.SetLevel(logrus.TraceLevel)
	runLog.Logger.SetFormatter(&prefixed.TextFormatter{
		TimestampFormat: "2006-01-02 15:04:05",
		FullTimestamp:   true,
		ForceFormatting: true,
		ForceColors:     true,
	})
	runLog.Logger.SetOutput(os.Stdout)
	runLog.Info("Starting the debug workspace...")

	if wsInfo.DebugWorkspaceType != api.DebugWorkspaceType_noDebug {
		runLog.Error("It is not possible to restart the debug workspace while you are currently inside it.")
		event.Set("ErrorCode", utils.RebuildErrorCode_AlreadyInDebug)
		return utils.Outcome_UserErr, nil
	}
	stopDebugContainer(ctx, dockerPath)

	workspaceUrl, err := url.Parse(wsInfo.WorkspaceUrl)
	if err != nil {
		return utils.Outcome_SystemErr, err
	}
	workspaceUrl.Host = "debug-" + workspaceUrl.Host

	workspaceLocation := gitpodConfig.WorkspaceLocation
	if workspaceLocation == "" {
		workspaceLocation = checkoutLocation
	}

	// TODO what about auto derived by server, i.e. JB for prebuilds? we should move them into the workspace then
	tasks, err := json.Marshal(gitpodConfig.Tasks)
	if err != nil {
		return utils.Outcome_SystemErr, err
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
		return utils.Outcome_SystemErr, err
	}

	// TODO project? - should not it be covered by gp env?
	// Should we allow to provide additiona envs to test such, i.e. gp rebuild -e foo=bar
	userEnvs, err := exec.CommandContext(ctx, "gp", "env").CombinedOutput()
	if err != nil {
		return utils.Outcome_SystemErr, err
	}

	var envs string
	for _, env := range debugEnvs.Envs {
		envs += env + "\n"
	}
	envs += string(userEnvs)

	envFile := filepath.Join(tmpDir, ".env")
	err = os.WriteFile(envFile, []byte(envs), 0644)
	if err != nil {
		return utils.Outcome_SystemErr, err
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
		"-v", "/ide-desktop:/ide-desktop",
		"-v", "/ide-desktop-plugins:/ide-desktop-plugins", // TODO refactor to keep all IDE deps under ide or ide-desktop

		imageTag,
		"/.supervisor/supervisor", "init",
	)

	debugSupervisor, err := supervisor.New(ctx, &supervisor.SupervisorClientOption{
		Address: "localhost:24999",
	})
	if err != nil {
		return utils.Outcome_SystemErr, err
	}

	go func() {
		debugSupervisor.WaitForIDEReady(ctx)
		if ctx.Err() != nil {
			return
		}

		ssh := "ssh 'debug-" + wsInfo.WorkspaceId + "@" + workspaceUrl.Host + ".ssh." + wsInfo.WorkspaceClusterHost + "'"
		sep := strings.Repeat("=", len(ssh))
		runLog.Infof(`The Debug Workspace is UP!
%s

Open in Browser at:
%s

Connect using SSH keys (https://gitpod.io/keys):
%s

%s`, sep, workspaceUrl, ssh, sep)
		err := notify(ctx, supervisorClient, workspaceUrl.String(), "The Debug Workspace is UP.")
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
		return utils.Outcome_SystemErr, err
	}
	go pipeLogs(stdout, logrus.InfoLevel)

	stderr, err := runCmd.StderrPipe()
	if err != nil {
		return utils.Outcome_SystemErr, err
	}
	go pipeLogs(stderr, logrus.ErrorLevel)

	err = runCmd.Start()
	if err != nil {
		fmt.Println("Failed to run a debug workspace")
		event.Set("ErrorCode", utils.RebuildErrorCode_DockerRunFailed)
		return utils.Outcome_UserErr, err
	}

	stopped := make(chan struct{})
	go func() {
		_ = runCmd.Wait()
		close(stopped)
	}()

	select {
	case <-ctx.Done():
		fmt.Println("")
		logrus.Info("Gracefully stopping the debug workspace...")
		stopDebugContainer(context.Background(), dockerPath)
	case <-stopped:
	}

	return utils.Outcome_Success, nil
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
}

var rebuildCmd = &cobra.Command{
	Use:    "rebuild",
	Short:  "[experimental] Re-builds the workspace (useful to debug a workspace configuration)",
	Hidden: false,
	Run: func(cmd *cobra.Command, args []string) {
		ctx, cancel := context.WithCancel(context.Background())
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM, syscall.SIGHUP)
		go func() {
			<-sigChan
			cancel()
		}()
		supervisorClient, err := supervisor.New(ctx)
		if err != nil {
			utils.LogError(ctx, err, "Could not get workspace info required to build", supervisorClient)
			return
		}
		defer supervisorClient.Close()

		event := utils.NewAnalyticsEvent(ctx, supervisorClient, &utils.TrackCommandUsageParams{
			Command: cmd.Name(),
		})

		outcome, err := runRebuild(ctx, supervisorClient, event)
		event.Set("Outcome", outcome)

		if outcome != utils.Outcome_Success && event.Data.ErrorCode == "" {
			switch outcome {
			case utils.Outcome_UserErr:
				event.Set("ErrorCode", utils.UserErrorCode)
			case utils.Outcome_SystemErr:
				event.Set("ErrorCode", utils.SystemErrorCode)
			}
		}

		event.Send(ctx)

		if err != nil {
			utils.LogError(ctx, err, "Failed to rebuild", supervisorClient)
			os.Exit(1)
		}
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
}
