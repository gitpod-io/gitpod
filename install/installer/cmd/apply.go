// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	_ "embed"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/spf13/cobra"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/serializer/yaml"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/discovery"
	memory "k8s.io/client-go/discovery/cached"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"
	"k8s.io/client-go/tools/clientcmd"
)

// applyCmd represents the render command
var applyCmd = &cobra.Command{
	Use:   "apply",
	Short: "Applies the Kubernetes manifests required to install Gitpod",
	Long: `Applies the Kubernetes manifests required to install Gitpod

A config file is required which can be generated with the init command.`,

	RunE: func(cmd *cobra.Command, args []string) error {
		kubecfg, err := kubeconfig()
		if err != nil {
			return err
		}

		yaml, err := renderFn()
		if err != nil {
			return err
		}

		for _, doc := range yaml {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			err := doSSA(ctx, doc, kubecfg)
			cancel()
			if err != nil {
				return err
			}
		}

		return nil
	},
}

func kubeconfig() (res *rest.Config, err error) {
	if kubeconfig := os.Getenv("KUBECONFIG"); kubeconfig != "" {
		return clientcmd.BuildConfigFromFlags("", kubeconfig)
	}

	return rest.InClusterConfig()
}

var decUnstructured = yaml.NewDecodingSerializer(unstructured.UnstructuredJSONScheme)

func doSSA(ctx context.Context, deploymentYAML string, cfg *rest.Config) error {
	// 1. Prepare a RESTMapper to find GVR
	dc, err := discovery.NewDiscoveryClientForConfig(cfg)
	if err != nil {
		return err
	}
	mapper := restmapper.NewDeferredDiscoveryRESTMapper(memory.NewMemCacheClient(dc))

	// 2. Prepare the dynamic client
	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return err
	}

	// 3. Decode YAML manifest into unstructured.Unstructured
	obj := &unstructured.Unstructured{}
	_, gvk, err := decUnstructured.Decode([]byte(deploymentYAML), nil, obj)
	if err != nil {
		return err
	}

	// 4. Find GVR
	mapping, err := mapper.RESTMapping(gvk.GroupKind(), gvk.Version)
	if err != nil {
		return err
	}

	// 5. Obtain REST interface for the GVR
	var dr dynamic.ResourceInterface
	if mapping.Scope.Name() == meta.RESTScopeNameNamespace {
		// namespaced resources should specify the namespace
		dr = dyn.Resource(mapping.Resource).Namespace(obj.GetNamespace())
	} else {
		// for cluster-wide resources
		dr = dyn.Resource(mapping.Resource)
	}

	log.Infof("applying %s/", obj.GetNamespace(), obj.GetName())

	// 6. Marshal object into JSON
	data, err := json.Marshal(obj)
	if err != nil {
		return err
	}

	// 7. Create or Update the object with SSA
	//     types.ApplyPatchType indicates SSA.
	//     FieldManager specifies the field owner ID.
	_, err = dr.Patch(ctx, obj.GetName(), types.ApplyPatchType, data, metav1.PatchOptions{
		FieldManager: "gitpod-installer",
	})

	return err
}

func init() {
	rootCmd.AddCommand(applyCmd)

	dir, err := os.Getwd()
	if err != nil {
		log.WithError(err).Fatal("Failed to get working directory")
	}

	applyCmd.PersistentFlags().StringVarP(&renderOpts.ConfigFN, "config", "c", getEnvvar("GITPOD_INSTALLER_CONFIG", filepath.Join(dir, "gitpod.config.yaml")), "path to the config file, use - for stdin")
	applyCmd.PersistentFlags().StringVarP(&renderOpts.Namespace, "namespace", "n", getEnvvar("NAMESPACE", "default"), "namespace to deploy to")
	applyCmd.Flags().BoolVar(&renderOpts.ValidateConfigDisabled, "no-validation", false, "if set, the config will not be validated before running")
	applyCmd.Flags().BoolVar(&renderOpts.UseExperimentalConfig, "use-experimental-config", false, "enable the use of experimental config that is prone to be changed")
}
