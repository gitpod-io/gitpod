// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package helm

import (
	"bytes"
	"context"
	"fmt"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/third_party/charts"
	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/chart/loader"
	"helm.sh/helm/v3/pkg/downloader"
	"helm.sh/helm/v3/pkg/getter"
	"helm.sh/helm/v3/pkg/release"
	"os"
	"os/signal"
	"syscall"
)

// TemplateConfig
type TemplateConfig struct {
	Namespace string
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
	client := action.NewDependency()

	man := &downloader.Manager{
		Out:              &bytes.Buffer{},
		ChartPath:        settings.Chart,
		Keyring:          client.Keyring,
		SkipUpdate:       client.SkipRefresh,
		Verify:           downloader.VerifyNever,
		RegistryClient:   settings.ActionConfig.RegistryClient,
		Getters:          getter.All(settings.Env),
		RepositoryConfig: settings.Env.RepositoryConfig,
		RepositoryCache:  settings.Env.RepositoryCache,
		Debug:            false,
	}

	err := man.Update()
	if err != nil {
		return err
	}

	return nil
}

// runInstall emulates this function in Helm with simplified error handling
// https://github.com/helm/helm/blob/9fafb4ad6811afb017cc464b630be2ff8390ac63/cmd/helm/install.go#L177
func runInstall(settings Settings, client *action.Install) (*release.Release, error) {
	name, _, err := client.NameAndChart([]string{
		settings.Config.Name,
		settings.Chart,
	})
	if err != nil {
		return nil, err
	}
	client.ReleaseName = name

	p := getter.All(settings.Env)
	vals, err := settings.Values.MergeValues(p)
	if err != nil {
		return nil, err
	}

	chartRequested, err := loader.Load(settings.Chart)
	if err != nil {
		return nil, err
	}

	return client.RunWithContext(getContext(settings), chartRequested, vals)
}

func writeCharts(chart *charts.Chart) (*string, error) {
	dir, err := os.MkdirTemp("", chart.Name)
	if err != nil {
		return nil, err
	}

	if err := os.WriteFile(fmt.Sprintf("%s/%s", dir, "Chart.yaml"), chart.Chart, 0644); err != nil {
		return nil, err
	}

	if err := os.WriteFile(fmt.Sprintf("%s/%s", dir, "values.yaml"), chart.Values, 0644); err != nil {
		return nil, err
	}

	return &dir, nil
}

// ImportTemplate allows for Helm charts to be imported into the installer manifest
func ImportTemplate(chart *charts.Chart, templateCfg TemplateConfig, pkgConfig PkgConfig) common.HelmFunc {
	return func(cfg *common.RenderContext) ([]string, error) {
		helmConfig, err := pkgConfig(cfg)
		if err != nil {
			return nil, err
		}

		if !helmConfig.Enabled {
			return nil, nil
		}

		dir, err := writeCharts(chart)
		if err != nil {
			return nil, err
		}

		settings := SettingsFactory(
			&Config{
				Debug:     false,
				Name:      chart.Name,
				Namespace: cfg.Namespace,
			},
			*dir,
			helmConfig.Values,
		)

		if err := installDependencies(settings); err != nil {
			return nil, err
		}

		client := action.NewInstall(settings.ActionConfig)
		client.DryRun = true
		client.ReleaseName = "RELEASE-NAME"
		client.Replace = true // Skip the name check
		client.ClientOnly = true
		if templateCfg.Namespace == "" {
			client.Namespace = cfg.Namespace
		} else {
			client.Namespace = templateCfg.Namespace
		}

		rel, err := runInstall(settings, client)
		if err != nil {
			return nil, err
		}
		if rel == nil {
			return nil, fmt.Errorf("release for %s generated an empty value", settings.Config.Name)
		}

		// Fetch any additional Kubernetes files that need applying
		var templates []string
		if len(chart.KubeObjects) > 0 {
			for _, obj := range chart.KubeObjects {
				templates = append(templates, string(obj))
			}
		}

		return append(templates, rel.Manifest), nil
	}
}
