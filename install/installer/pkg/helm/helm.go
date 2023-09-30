// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package helm

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"

	"sigs.k8s.io/yaml"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/third_party/charts"
	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/chart/loader"
	"helm.sh/helm/v3/pkg/downloader"
	"helm.sh/helm/v3/pkg/getter"
	"helm.sh/helm/v3/pkg/release"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
		return fmt.Errorf("error pulling Helm dependency for %s: %w", settings.Chart, err)
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

func writeCharts(chart *charts.Chart) (string, error) {
	dir, err := os.MkdirTemp("", chart.Name)
	if err != nil {
		return "", err
	}

	err = chart.Export(dir)
	if err != nil {
		return "", err
	}

	return dir, nil
}

// AffinityYaml convert an affinity into a YAML byte array
func AffinityYaml(orLabels ...string) ([]byte, error) {
	affinities := nodeAffinity(orLabels...)

	marshal, err := yaml.Marshal(affinities)
	if err != nil {
		return nil, err
	}

	return marshal, nil
}

func nodeAffinity(orLabels ...string) *corev1.Affinity {
	var terms []corev1.NodeSelectorTerm
	for _, lbl := range orLabels {
		terms = append(terms, corev1.NodeSelectorTerm{
			MatchExpressions: []corev1.NodeSelectorRequirement{
				{
					Key:      lbl,
					Operator: corev1.NodeSelectorOpExists,
				},
			},
		})
	}

	return &corev1.Affinity{
		NodeAffinity: &corev1.NodeAffinity{
			RequiredDuringSchedulingIgnoredDuringExecution: &corev1.NodeSelector{
				NodeSelectorTerms: terms,
			},
		},
	}
}

func ImagePullSecrets(key string, ctx *common.RenderContext) string {
	if len(ctx.Config.ImagePullSecrets) > 0 {
		var pullSecrets []string
		for _, i := range ctx.Config.ImagePullSecrets {
			pullSecrets = append(pullSecrets, i.Name)
		}

		return KeyValueArray(key, pullSecrets)
	}

	// Nothing to be set
	return ""
}

// ImportTemplate allows for Helm charts to be imported into the installer manifest
func ImportTemplate(chart *charts.Chart, templateCfg TemplateConfig, pkgConfig PkgConfig) common.HelmFunc {
	return func(cfg *common.RenderContext) (r []string, err error) {
		defer func() {
			if err != nil {
				err = fmt.Errorf("cannot import template %s: %w", chart.Name, err)
			}
		}()

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
			dir,
			helmConfig.Values,
		)

		if _, err := os.Stat(filepath.Join(dir, "charts")); err != nil {
			err = installDependencies(settings)
			if err != nil {
				return nil, err
			}
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
		for _, obj := range chart.AdditionalFiles {
			b, err := chart.Content.ReadFile(obj)
			if err != nil {
				return nil, err
			}
			templates = append(templates, string(b))
		}

		return append(templates, rel.Manifest), nil
	}
}

// CustomizeAnnotation check for customized annotations and output in Helm format
func CustomizeAnnotation(registryValues []string, prefix string, ctx *common.RenderContext, component string, typeMeta metav1.TypeMeta, existingAnnotations ...func() map[string]string) []string {
	annotations := common.CustomizeAnnotation(ctx, component, typeMeta, existingAnnotations...)
	for k, v := range annotations {
		// Escape any dots in the keys so they're not expanded
		key := strings.Replace(k, ".", "\\.", -1)
		registryValues = append(registryValues, KeyValue(fmt.Sprintf("%s.%s", prefix, key), v))
	}

	return registryValues
}

// CustomizeLabel check for customized labels and output in Helm format - also removes the default labels, which conflict with Helm
func CustomizeLabel(registryValues []string, prefix string, ctx *common.RenderContext, component string, typeMeta metav1.TypeMeta, existingLabels ...func() map[string]string) []string {
	labels := common.CustomizeLabel(ctx, component, typeMeta, existingLabels...)

	// Remove the default labels
	for k := range common.DefaultLabels(component) {
		delete(labels, k)
	}

	for k, v := range labels {
		// Escape any dots in the keys so they're not expanded
		key := strings.Replace(k, ".", "\\.", -1)
		registryValues = append(registryValues, KeyValue(fmt.Sprintf("%s.%s", prefix, key), v))
	}

	return registryValues
}

// CustomizeEnvvar check for customized envvars and output in Helm format - assumes name/value only
func CustomizeEnvvar(registryValues []string, prefix string, ctx *common.RenderContext, component string, existingEnvvars ...[]corev1.EnvVar) []string {
	// Helm is unlikely to have any existing envvars, so treat them as optional
	envvars := common.CustomizeEnvvar(ctx, component, func() []corev1.EnvVar {
		envs := make([]corev1.EnvVar, 0)

		for _, e := range existingEnvvars {
			envs = append(envs, e...)
		}

		return envs
	}())

	for k, v := range envvars {
		registryValues = append(registryValues, KeyValue(fmt.Sprintf("%s[%d].name", prefix, k), v.Name))
		registryValues = append(registryValues, KeyValue(fmt.Sprintf("%s[%d].value", prefix, k), v.Value))
	}

	return registryValues
}
