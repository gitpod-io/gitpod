// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package helm

import (
	"bytes"
	"context"
	"fmt"
	"github.com/pkg/errors"
	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/chart/loader"
	"helm.sh/helm/v3/pkg/cli"
	"helm.sh/helm/v3/pkg/downloader"
	"helm.sh/helm/v3/pkg/getter"
	"helm.sh/helm/v3/pkg/repo"
	"helm.sh/helm/v3/pkg/storage/driver"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"
)

type Config struct {
	CertManager bool
	ConfigFile  string
	Debug       bool
	DryRun      bool
	Jaeger      bool
	KubeConfig  string
	KubeContext string
	Name        string
	Namespace   string
	Timeout     time.Duration
}

func settingsFactory(config *Config, chart string) Settings {
	settings := Settings{
		ActionConfig: new(action.Configuration),
		Config:       config,
		Env:          cli.New(),
		Chart:        chart, // This can be a directory or a change name
	}

	if config.KubeConfig != "" {
		settings.Env.KubeConfig = config.KubeConfig
	}

	if config.KubeContext != "" {
		settings.Env.KubeContext = config.KubeContext
	}

	if !settings.Config.Debug {
		// If not debugging, send logs to a buffer
		log.SetOutput(&bytes.Buffer{})
	}

	return settings
}

func generateValuesYaml() error {
	return nil
}

func generateGitpodYaml(settings Settings, gitpodYaml *bytes.Buffer) error {
	if err := os.WriteFile(fmt.Sprintf("%s/%s/%s", settings.Chart, HelmTemplatesDirectory, "gitpod.yaml"), gitpodYaml.Bytes(), 0644); err != nil {
		return err
	}

	return nil
}

func kubernetesInit(settings Settings) error {
	settings.Write("Initializing Kubernetes")
	return settings.ActionConfig.Init(settings.Env.RESTClientGetter(), settings.Env.Namespace(), os.Getenv("HELM_DRIVER"), settings.Write)
}

func getContext(settings Settings) context.Context {
	// Create context and prepare the handle of SIGTERM
	ctx := context.Background()
	ctx, cancel := context.WithCancel(ctx)

	// Handle SIGTERM
	cSignal := make(chan os.Signal)
	signal.Notify(cSignal, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-cSignal
		settings.Write("Release of Gitpod has been cancelled.")
		cancel()
	}()

	return ctx
}

func installDependencies(settings Settings) error {
	settings.Write("Downloading dependencies for Gitpod chart")

	client := action.NewDependency()

	man := &downloader.Manager{
		Out:              log.Writer(),
		ChartPath:        settings.Chart,
		Keyring:          client.Keyring,
		SkipUpdate:       client.SkipRefresh,
		Verify:           downloader.VerifyNever,
		RegistryClient:   settings.ActionConfig.RegistryClient,
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

func helmInstall(settings Settings) error {
	settings.Write("Installing %s from %s", settings.Config.Name, settings.Chart)

	client := action.NewInstall(settings.ActionConfig)
	client.Atomic = true
	client.CreateNamespace = true
	client.DryRun = settings.Config.DryRun
	client.Namespace = settings.Config.Namespace
	client.Timeout = settings.Config.Timeout
	client.Wait = true

	args := []string{
		settings.Config.Name,
		settings.Chart,
	}

	name, _, err := client.NameAndChart(args)
	if err != nil {
		return err
	}
	client.ReleaseName = name

	chartRequested, err := loader.Load(settings.Chart)
	if err != nil {
		return err
	}

	_, err = client.RunWithContext(getContext(settings), chartRequested, nil)
	if err != nil {
		return err
	}

	return nil
}

func helmUninstall(settings Settings) error {
	client := action.NewUninstall(settings.ActionConfig)
	client.DryRun = settings.Config.DryRun
	client.Timeout = settings.Config.Timeout
	client.Wait = true

	res, err := client.Run(settings.Config.Name)
	if err != nil {
		return err
	}

	if res != nil && res.Info != "" {
		settings.Write(res.Info)
	}
	return nil
}

func helmUpgrade(settings Settings) error {
	settings.Write("Upgrading %s from %s", settings.Config.Name, settings.Chart)

	client := action.NewUpgrade(settings.ActionConfig)
	client.Atomic = true
	client.CleanupOnFail = true
	client.DryRun = settings.Config.DryRun
	client.Namespace = settings.Config.Namespace
	client.ResetValues = true
	client.Timeout = settings.Config.Timeout
	client.Wait = true

	chartRequested, err := loader.Load(settings.Chart)
	if err != nil {
		return err
	}

	_, err = client.RunWithContext(getContext(settings), settings.Config.Name, chartRequested, nil)
	if err != nil {
		return err
	}

	return nil
}

func installOrUpgrade(settings Settings) error {
	histClient := action.NewHistory(settings.ActionConfig)
	histClient.Max = 1
	settings.Write("Checking if installed")
	if _, err := histClient.Run(settings.Config.Name); err == driver.ErrReleaseNotFound {
		// Installing for the first time
		return helmInstall(settings)
	} else if err != nil {
		return err
	}

	// Already installed - upgrade
	return helmUpgrade(settings)
}

func mkdir() (*string, error) {
	dir, err := os.MkdirTemp("", GitpodDirectory)
	if err != nil {
		return nil, err
	}

	if err := os.Mkdir(fmt.Sprintf("%s/%s", dir, HelmTemplatesDirectory), 0700); err != nil {
		return nil, err
	}

	return &dir, nil
}

func writeHelmChart(settings Settings) error {
	if err := os.WriteFile(fmt.Sprintf("%s/%s", settings.Chart, "Chart.yaml"), gitpodChart, 0644); err != nil {
		return err
	}

	if err := os.WriteFile(fmt.Sprintf("%s/%s", settings.Chart, "values.yaml"), gitpodValues, 0644); err != nil {
		return err
	}

	return nil
}

func addRepoAndUpdate(settings Settings, repoName string, repoURL string) error {
	entry := repo.Entry{
		Name: repoName,
		URL:  repoURL,
	}

	chartRepo, err := repo.NewChartRepository(&entry, getter.All(settings.Env))
	if err != nil {
		return err
	}

	if _, err := chartRepo.DownloadIndexFile(); err != nil {
		return errors.Wrapf(err, "looks like %q is not a valid chart repository or cannot be reached", repoURL)
	}

	return nil
}

func Install(config *Config, gitpodYaml *bytes.Buffer) (*Settings, error) {
	// Create a temporary directory to save files to
	dir, err := mkdir()
	if err != nil {
		return nil, err
	}

	settings := settingsFactory(config, *dir)

	settings.Write("Temp directory created: %s", dir)

	if err := kubernetesInit(settings); err != nil {
		return nil, err
	}

	//if config.CertManager {
	//	certManagerConfig := config
	//	certManagerConfig.Name = CertManagerName
	//	certManagerConfig.Namespace = CertManagerNamespace
	//	certManagerSettings := settingsFactory(config, CertManagerChart)
	//
	//	if err := addRepoAndUpdate(certManagerSettings, CertManagerRepoName, CertManagerRepoURL); err != nil {
	//		return nil, err
	//	}
	//
	//	if err = installOrUpgrade(certManagerSettings); err != nil {
	//		return nil, err
	//	}
	//}
	//
	//if config.Jaeger {
	//	jaegerConfig := config
	//	jaegerConfig.Name = JaegerName
	//	jaegerConfig.Namespace = JaegerNamespace
	//	jaegerConfigSettings := settingsFactory(config, JaegerChart)
	//
	//	if err := addRepoAndUpdate(jaegerConfigSettings, JaegerRepoName, JaegerRepoURL); err != nil {
	//		return nil, err
	//	}
	//
	//	if err = installOrUpgrade(jaegerConfigSettings); err != nil {
	//		return nil, err
	//	}
	//}

	if err := writeHelmChart(settings); err != nil {
		return nil, err
	}

	if err := installDependencies(settings); err != nil {
		return nil, err
	}

	if err := generateGitpodYaml(settings, gitpodYaml); err != nil {
		return nil, err
	}

	if err = installOrUpgrade(settings); err != nil {
		return nil, err
	}

	return &settings, nil
}

func Uninstall(config *Config) (*Settings, error) {
	settings := settingsFactory(config, "")

	if err := kubernetesInit(settings); err != nil {
		return nil, err
	}

	if err := helmUninstall(settings); err != nil {
		return nil, err
	}

	if config.Jaeger {
		jaegerConfig := config
		jaegerConfig.Name = JaegerName
		jaegerConfig.Namespace = JaegerNamespace
		jaegerConfigSettings := settingsFactory(config, JaegerChart)

		if err := helmUninstall(jaegerConfigSettings); err != nil {
			return nil, err
		}
	}

	if config.CertManager {
		certManagerConfig := config
		certManagerConfig.Name = CertManagerName
		certManagerConfig.Namespace = CertManagerNamespace
		certManagerSettings := settingsFactory(config, CertManagerChart)

		if err := helmUninstall(certManagerSettings); err != nil {
			return nil, err
		}
	}

	return &settings, nil
}
