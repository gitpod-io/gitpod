// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"archive/tar"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/supervisor"
	"github.com/gitpod-io/gitpod/gitpod-cli/pkg/utils"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/spf13/cobra"
)

func runRebuild(ctx context.Context, supervisorClient *supervisor.SupervisorClient, event *utils.EventTracker) (bool, error) {
	rebuildCtx := &rebuildContext{
		supervisorClient: supervisorClient,
		imageTag:         "gp-rebuild",
	}
	valid, err := validate(ctx, event, rebuildCtx)
	if !valid || err != nil {
		return valid, err
	}

	buildDir, err := os.MkdirTemp("", "gp-rebuild-*")
	if err != nil {
		event.Set("ErrorCode", utils.SystemErrorCode)
		return false, err
	}
	defer os.RemoveAll(buildDir)
	rebuildCtx.buildDir = buildDir

	err = buildImage(ctx, event, rebuildCtx)
	if err != nil {
		return false, err
	}
	err = debug(ctx, event, rebuildCtx)
	if err != nil {
		return false, err
	}
	return true, nil
}

type rebuildContext struct {
	supervisorClient *supervisor.SupervisorClient
	baseImage        string
	buildDir         string
	dockerPath       string
	imageTag         string
}

func validate(ctx context.Context, event *utils.EventTracker, rebuildCtx *rebuildContext) (bool, error) {
	wsInfo, err := rebuildCtx.supervisorClient.Info.WorkspaceInfo(ctx, &api.WorkspaceInfoRequest{})
	if err != nil {
		event.Set("ErrorCode", utils.SystemErrorCode)
		return false, err
	}

	// TODO make it flexible, look for first .gitopd.yml traversing parents?
	gitpodConfig, err := utils.ParseGitpodConfig(wsInfo.CheckoutLocation)
	if err != nil {
		fmt.Println("The .gitpod.yml file cannot be parsed: please check the file and try again")
		fmt.Println("")
		fmt.Println("For help check out the reference page:")
		fmt.Println("https://www.gitpod.io/docs/references/gitpod-yml#gitpodyml")
		event.Set("ErrorCode", utils.RebuildErrorCode_MalformedGitpodYaml)
		return false, err
	}

	if gitpodConfig == nil {
		fmt.Println("To test the image build, you need to configure your project with a .gitpod.yml file")
		fmt.Println("")
		fmt.Println("For a quick start, try running:\n$ gp init -i")
		fmt.Println("")
		fmt.Println("Alternatively, check out the following docs for getting started configuring your project")
		fmt.Println("https://www.gitpod.io/docs/configure#configure-gitpod")
		event.Set("ErrorCode", utils.RebuildErrorCode_MissingGitpodYaml)
		return false, err
	}

	var baseImage string
	switch img := gitpodConfig.Image.(type) {
	case nil:
		baseImage = ""
	case string:
		baseImage = "FROM " + img
	case map[interface{}]interface{}:
		dockerfilePath := filepath.Join(wsInfo.CheckoutLocation, img["file"].(string))

		if _, err := os.Stat(dockerfilePath); os.IsNotExist(err) {
			fmt.Println("Your .gitpod.yml points to a Dockerfile that doesn't exist: " + dockerfilePath)
			event.Set("ErrorCode", utils.RebuildErrorCode_DockerfileNotFound).Send(ctx)
			return false, err
		}
		dockerfile, err := os.ReadFile(dockerfilePath)
		if err != nil {
			event.Set("ErrorCode", utils.RebuildErrorCode_DockerfileCannotRead)
			return false, err
		}
		if string(dockerfile) == "" {
			fmt.Println("Your Gitpod's Dockerfile is empty")
			fmt.Println("")
			fmt.Println("To learn how to customize your workspace, check out the following docs:")
			fmt.Println("https://www.gitpod.io/docs/configure/workspaces/workspace-image#use-a-custom-dockerfile")
			fmt.Println("")
			fmt.Println("Once you configure your Dockerfile, re-run this command to validate your changes")
			event.Set("ErrorCode", utils.RebuildErrorCode_DockerfileEmpty)
			return false, err
		}
		baseImage = "\n" + string(dockerfile) + "\n"
	default:
		fmt.Println("Check your .gitpod.yml and make sure the image property is configured correctly")
		event.Set("ErrorCode", utils.RebuildErrorCode_MalformedGitpodYaml)
		return false, err
	}

	if baseImage == "" {
		fmt.Println("Your project is not using any custom Docker image.")
		fmt.Println("Check out the following docs, to know how to get started")
		fmt.Println("")
		fmt.Println("https://www.gitpod.io/docs/configure/workspaces/workspace-image#use-a-public-docker-image")
		event.Set("ErrorCode", utils.RebuildErrorCode_NoCustomImage)
		return false, err
	}
	rebuildCtx.baseImage = baseImage
	return true, nil
}

func buildImage(ctx context.Context, event *utils.EventTracker, rebuildCtx *rebuildContext) error {
	dockerPath, err := exec.LookPath("docker")
	if err != nil {
		fmt.Println("Docker is not installed in your workspace")
		event.Set("ErrorCode", utils.RebuildErrorCode_DockerNotFound)
		return err
	}
	rebuildCtx.dockerPath = dockerPath

	dockerFile := filepath.Join(rebuildCtx.buildDir, "Dockerfile")
	err = os.WriteFile(dockerFile, []byte(rebuildCtx.baseImage), 0644)
	if err != nil {
		fmt.Println("Could not write the temporary Dockerfile")
		event.Set("ErrorCode", utils.RebuildErrorCode_DockerfileCannotWirte)
		return err
	}

	imageBuildStartTime := time.Now()
	fmt.Println("building the workspace image...")
	dockerCmd := exec.Command(dockerPath, "build", "-t", rebuildCtx.imageTag, ".", "-f", dockerFile)
	dockerCmd.Stdout = os.Stdout
	dockerCmd.Stderr = os.Stderr
	dockerCmd.Env = append(os.Environ(), "DOCKER_BUILDKIT=1")
	err = dockerCmd.Run()
	if _, ok := err.(*exec.ExitError); ok {
		fmt.Println("Image Build Failed")
		event.Set("ErrorCode", utils.RebuildErrorCode_DockerBuildFailed)
		return err
	} else if err != nil {
		fmt.Println("Docker error")
		event.Set("ErrorCode", utils.RebuildErrorCode_DockerErr)
		return err
	}
	ImageBuildDuration := time.Since(imageBuildStartTime).Milliseconds()
	event.Set("ImageBuildDuration", ImageBuildDuration)
	return err
}

func debug(ctx context.Context, event *utils.EventTracker, rebuildCtx *rebuildContext) (err error) {
	// TODO: stopDebug to release the root FS

	// TODO skip if image did not change, it is very slow, how to tune?
	exportStartTime := time.Now()
	exportPhase := "exporting the workspace root filesystem"
	fmt.Println(exportPhase + ", may take sometime...")
	err = exportRootFS(rebuildCtx)
	event.Data.ExportRootFileSystemDuration = time.Since(exportStartTime).Milliseconds()
	fmt.Printf(exportPhase+" finished in %s \n",
		(time.Duration(event.Data.ExportRootFileSystemDuration) * time.Millisecond).Round(time.Second).String(),
	)
	if err != nil {
		event.Data.ErrorCode = utils.RebuildErrorCode_ExportRootFSFailed
		return err
	}

	// TODO inline
	fmt.Println("starting a debug workspace...")
	err = exec.Command("/.supervisor/supervisor", "inner-loop").Run()
	if err != nil {
		event.Data.ErrorCode = utils.RebuildErrorCode_DebugFailed
		return err
	}
	return nil
}

var rootFS = "/.debug/rootfs"

func exportRootFS(rebuildCtx *rebuildContext) error {
	err := os.RemoveAll(rootFS)
	if err != nil {
		return err
	}
	err = os.MkdirAll(rootFS, 0700)
	if err != nil {
		return err
	}

	containerName := rebuildCtx.imageTag + "-0"

	rmCmd := exec.Command(rebuildCtx.dockerPath, "rm", "-f", containerName)
	rmCmd.Stderr = os.Stderr
	_ = rmCmd.Run()

	runCmd := exec.Command(rebuildCtx.dockerPath, "run", "--name", containerName, rebuildCtx.imageTag)
	runCmd.Stdout = os.Stdout
	runCmd.Stderr = os.Stderr
	err = runCmd.Run()
	if err != nil {
		return err
	}

	exportCmd := exec.Command(rebuildCtx.dockerPath, "export", containerName)
	exportCmd.Stderr = os.Stderr
	stdout, err := exportCmd.StdoutPipe()
	if err != nil {
		return err
	}

	err = exportCmd.Start()
	if err != nil {
		return err
	}

	tarReader := tar.NewReader(stdout)
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		path := filepath.Join(rootFS, header.Name)
		if header.FileInfo().IsDir() {
			err := os.MkdirAll(path, header.FileInfo().Mode())
			if err != nil {
				return err
			}
		} else {
			file, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, header.FileInfo().Mode())
			if err != nil {
				return err
			}
			_, err = io.Copy(file, tarReader)
			file.Close()
			if err != nil {
				return err
			}
		}
	}
	return exportCmd.Wait()
}

var buildCmd = &cobra.Command{
	Use:    "rebuild",
	Short:  "Re-builds the workspace (useful to debug a workspace configuration)",
	Hidden: false,
	Run: func(cmd *cobra.Command, args []string) {
		ctx := context.Background()

		supervisorClient, err := supervisor.New(ctx)
		if err != nil {
			utils.LogError(ctx, err, "Could not get workspace info required to build", supervisorClient)
			return
		}
		defer supervisorClient.Close()

		if os.Geteuid() != 0 {
			// TODO only run export rootfs under root
			cmd := exec.Command("sudo", os.Args...)
			cmd.Stdin = os.Stdin
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr
			_ = cmd.Run()
			os.Exit(cmd.ProcessState.ExitCode())
		}

		event := utils.TrackEvent(ctx, supervisorClient, &utils.TrackCommandUsageParams{
			Command: cmd.Name(),
		})

		ok, err := runRebuild(ctx, supervisorClient, event)
		if event.Data.ErrorCode == "" {
			if err != nil {
				event.Set("ErrorCode", utils.SystemErrorCode)
			} else if !ok {
				event.Set("ErrorCode", utils.UserErrorCode)
			}
		}
		event.Send(ctx)

		if err != nil {
			utils.LogError(ctx, err, "Failed to rebuild", supervisorClient)
		}
		var exitCode int
		if err != nil || !ok {
			exitCode = 1
		}
		os.Exit(exitCode)
	},
}

func init() {
	rootCmd.AddCommand(buildCmd)
}
