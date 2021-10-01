// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package helm

import (
	"bytes"
	"context"
	"fmt"
	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/chart/loader"
	"helm.sh/helm/v3/pkg/cli"
	"helm.sh/helm/v3/pkg/downloader"
	"helm.sh/helm/v3/pkg/getter"
	"helm.sh/helm/v3/pkg/storage/driver"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func getContext(settings Settings) context.Context {
	// Create context and prepare the handle of SIGTERM
	ctx := context.Background()
	ctx, cancel := context.WithCancel(ctx)

	// Handle SIGTERM
	cSignal := make(chan os.Signal)
	signal.Notify(cSignal, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-cSignal
		settings.Write("Release %s has been cancelled.", settings.Chart.Name)
		cancel()
	}()

	return ctx
}

func install(settings Settings) error {
	settings.Write("Installing %s", settings.Chart.Name)

	client := action.NewInstall(settings.Config)
	client.Atomic = true
	client.Timeout = time.Minute * 5
	client.Wait = true

	args := []string{
		settings.Chart.Name,
		settings.Directory,
	}

	name, _, err := client.NameAndChart(args)
	if err != nil {
		return err
	}
	client.ReleaseName = name

	chartRequested, err := loader.Load(settings.Directory)
	if err != nil {
		return err
	}

	_, err = client.RunWithContext(getContext(settings), chartRequested, nil)
	if err != nil {
		return err
	}

	return nil
}

func upgrade(settings Settings) error {
	settings.Write("Upgrading %s", settings.Chart.Name)

	client := action.NewUpgrade(settings.Config)
	client.Atomic = true
	client.CleanupOnFail = true
	client.ResetValues = true
	client.Timeout = time.Minute * 5
	client.Wait = true

	chartRequested, err := loader.Load(settings.Directory)
	if err != nil {
		return err
	}

	_, err = client.RunWithContext(getContext(settings), settings.Chart.Name, chartRequested, nil)
	if err != nil {
		return err
	}

	return nil
}

func writeHelmChart(settings Settings) error {
	err := os.WriteFile(fmt.Sprintf("%s/%s", settings.Directory, "Chart.yaml"), settings.Chart.Chart, 0644)
	if err != nil {
		return err
	}

	err = os.WriteFile(fmt.Sprintf("%s/%s", settings.Directory, "values.yaml"), settings.Chart.Values, 0644)
	if err != nil {
		return err
	}
	return nil
}

func GetDependencies(settings Settings) error {
	settings.Write("Downloading dependencies for %s", settings.Chart.Name)

	if err := writeHelmChart(settings); err != nil {
		return err
	}

	client := action.NewDependency()

	man := &downloader.Manager{
		Out:              log.Writer(),
		ChartPath:        settings.Directory,
		Keyring:          client.Keyring,
		SkipUpdate:       client.SkipRefresh,
		Verify:           downloader.VerifyNever,
		RegistryClient:   settings.Config.RegistryClient,
		Getters:          getter.All(settings.Env),
		RepositoryConfig: settings.Env.RepositoryConfig,
		RepositoryCache:  settings.Env.RepositoryCache,
		Debug:            settings.Env.Debug,
	}

	err := man.Update()
	if err != nil {
		return err
	}

	return nil
}

func InstallOrUpdate(settings Settings) error {
	histClient := action.NewHistory(settings.Config)
	histClient.Max = 1
	settings.Write("Checking if installed")
	if _, err := histClient.Run(settings.Chart.Name); err == driver.ErrReleaseNotFound {
		settings.Write("Installing %s", settings.Chart.Name)

		// Installing for the first time
		return install(settings)
	} else if err != nil {
		return err
	}

	settings.Write("Upgrading %s", settings.Chart.Name)
	return upgrade(settings)
}

func Wrapper(chart *Chart, debug bool) error {
	dir, err := os.MkdirTemp("", chart.Name)
	if err != nil {
		return err
	}

	settings := Settings{
		Config:    new(action.Configuration),
		Debug:     debug,
		Directory: dir,
		Chart:     chart,
		Env:       cli.New(),
	}

	if !debug {
		log.SetOutput(&bytes.Buffer{})
	}

	settings.Write("Initializing Kubernetes")
	if err = settings.Config.Init(settings.Env.RESTClientGetter(), settings.Env.Namespace(), os.Getenv("HELM_DRIVER"), settings.Write); err != nil {
		return err
	}

	settings.Write("Saving charts to %s", dir)

	if err = GetDependencies(settings); err != nil {
		fmt.Println("Failed to download dependencies")
		return err
	}

	if err = InstallOrUpdate(settings); err != nil {
		fmt.Println("Failed to install Helm chart")
		return err
	}

	// Always print final line
	fmt.Printf("Successfully installed %s to your Gitpod cluster\n", settings.Chart.Name)

	return nil
}
