// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"io/ioutil"
	"testing"

	"github.com/gitpod-io/gitpod/installer/pkg/config"
	configv1 "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
	"github.com/google/go-cmp/cmp"
	"sigs.k8s.io/yaml"
)

var (
	testVersionsManifest = versions.Manifest{
		Version: "test",
		Components: versions.Components{
			AgentSmith: versions.Versioned{
				Version: "test",
			},
			Blobserve: versions.Versioned{
				Version: "test",
			},
			CAUpdater: versions.Versioned{
				Version: "test",
			},
			ContentService: versions.Versioned{
				Version: "test",
			},
			Dashboard: versions.Versioned{
				Version: "test",
			},
			DBMigrations: versions.Versioned{
				Version: "test",
			},
			DBSync: versions.Versioned{
				Version: "test",
			},
			IDEProxy: versions.Versioned{
				Version: "test",
			},
			ImageBuilder: versions.Versioned{
				Version: "test",
			},
			ImageBuilderMk3: struct {
				versions.Versioned
				BuilderImage versions.Versioned "json:\"builderImage\""
			}{
				versions.Versioned{
					Version: "test",
				},
				versions.Versioned{
					Version: "test",
				},
			},
			InstallationTelemetry: versions.Versioned{
				Version: "test",
			},
			IntegrationTests: versions.Versioned{
				Version: "test",
			},
			Kedge: versions.Versioned{
				Version: "test",
			},
			OpenVSXProxy: versions.Versioned{
				Version: "test",
			},
			PaymentEndpoint: versions.Versioned{
				Version: "test",
			},
			Proxy: versions.Versioned{
				Version: "test",
			},
			RegistryFacade: versions.Versioned{
				Version: "test",
			},
			Server: versions.Versioned{
				Version: "test",
			},
			ServiceWaiter: versions.Versioned{
				Version: "test",
			},
			Workspace: struct {
				CodeImage        versions.Versioned "json:\"codeImage\""
				DockerUp         versions.Versioned "json:\"dockerUp\""
				Supervisor       versions.Versioned "json:\"supervisor\""
				Workspacekit     versions.Versioned "json:\"workspacekit\""
				DesktopIdeImages struct {
					CodeDesktopImage         versions.Versioned "json:\"codeDesktop\""
					CodeDesktopImageInsiders versions.Versioned "json:\"codeDesktopInsiders\""
					IntelliJImage            versions.Versioned "json:\"intellij\""
					GoLandImage              versions.Versioned "json:\"goland\""
					PyCharmImage             versions.Versioned "json:\"pycharm\""
					PhpStormImage            versions.Versioned "json:\"phpstorm\""
				} "json:\"desktopIdeImages\""
			}{
				CodeImage: versions.Versioned{
					Version: "test",
				},
				DockerUp: versions.Versioned{
					Version: "test",
				},
				Supervisor: versions.Versioned{
					Version: "test",
				},
				Workspacekit: versions.Versioned{
					Version: "test",
				},
				DesktopIdeImages: struct {
					CodeDesktopImage         versions.Versioned "json:\"codeDesktop\""
					CodeDesktopImageInsiders versions.Versioned "json:\"codeDesktopInsiders\""
					IntelliJImage            versions.Versioned "json:\"intellij\""
					GoLandImage              versions.Versioned "json:\"goland\""
					PyCharmImage             versions.Versioned "json:\"pycharm\""
					PhpStormImage            versions.Versioned "json:\"phpstorm\""
				}{
					CodeDesktopImage: versions.Versioned{
						Version: "test",
					},
					CodeDesktopImageInsiders: versions.Versioned{
						Version: "test",
					},
					IntelliJImage: versions.Versioned{
						Version: "test",
					},
					GoLandImage: versions.Versioned{
						Version: "test",
					},
					PyCharmImage: versions.Versioned{
						Version: "test",
					},
					PhpStormImage: versions.Versioned{
						Version: "test",
					},
				},
			},
			WSDaemon: struct {
				versions.Versioned
				UserNamespaces struct {
					SeccompProfileInstaller versions.Versioned "json:\"seccompProfileInstaller\""
					ShiftFSModuleLoader     versions.Versioned "json:\"shiftfsModuleLoader\""
				} "json:\"userNamespaces\""
			}{
				versions.Versioned{
					Version: "test",
				},
				struct {
					SeccompProfileInstaller versions.Versioned "json:\"seccompProfileInstaller\""
					ShiftFSModuleLoader     versions.Versioned "json:\"shiftfsModuleLoader\""
				}{
					SeccompProfileInstaller: versions.Versioned{
						Version: "test",
					},
					ShiftFSModuleLoader: versions.Versioned{
						Version: "test",
					},
				},
			},
			WSManager: versions.Versioned{
				Version: "test",
			},
			WSManagerBridge: versions.Versioned{
				Version: "test",
			},
			WSProxy: versions.Versioned{
				Version: "test",
			},
		},
	}
)

func TestRenderKubernetesObjects(t *testing.T) {
	tests := []struct {
		cfg        map[string]interface{}
		outputFile string
	}{
		{
			map[string]interface{}{
				"domain": "www.gitpod-example.com",
			},
			"install_default.golden",
		},
	}

	for _, test := range tests {
		t.Run(fmt.Sprintf("Testing for `%s`", test.outputFile), func(t *testing.T) {

			// Load full config
			cfg, err := loadDefaults(test.cfg)
			if err != nil {
				t.Error("Unexpected error: ", err)
			}

			outputResources, err := renderKubernetesObjects("v1", cfg, &testVersionsManifest)
			if err != nil {
				t.Error("Unexpected error: ", err)
			}

			var output string
			for _, op := range outputResources {
				output = output + "\n" + op
			}

			rawBytes, err := ioutil.ReadFile("test/install_default.golden")
			if err != nil {
				t.Error("Unexpected error: ", err)
			}

			expectedOutput := string(rawBytes)
			if diff := cmp.Diff(expectedOutput, output); diff != "" {
				t.Errorf("Expected output mis-match (-want +got):\n%s", diff)
			}
		})
	}
}

// loadDefaults loads the default configuration
// for the currentVersion along with the overrides
func loadDefaults(overrideConfig map[string]interface{}) (*configv1.Config, error) {
	rawOverrideConfig, err := yaml.Marshal(overrideConfig)
	if err != nil {
		return nil, err
	}

	rawCfg, _, err := config.Load(string(rawOverrideConfig))
	if err != nil {
		return nil, fmt.Errorf("error loading config: %w", err)
	}

	cfg := rawCfg.(*configv1.Config)

	return cfg, nil
}
