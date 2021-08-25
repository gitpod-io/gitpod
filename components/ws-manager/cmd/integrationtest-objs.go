// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"os/exec"

	"github.com/spf13/cobra"
	"golang.org/x/sync/errgroup"
	"k8s.io/apimachinery/pkg/util/yaml"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/ws-manager/pkg/test"
)

// integrationTestSetupCmd represents the integrationTestSetup command
var integrationTestSetupCmd = &cobra.Command{
	Use:   "objs <path-to-chart>",
	Short: "Get Kubernetes objects that need to be present in a namespace for integration tests",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		kubecfgfn, _ := cmd.Parent().PersistentFlags().GetString("kubeconfig")
		_, namespace, err := test.GetIntegrationTestClient(kubecfgfn)
		if err != nil {
			log.WithError(err).Fatal("cannot get kubernetes client")
		}

		err = getIntegrationTestPrerequisiteObjects(os.Stdout, namespace, args[0], "wsman-test")
		if err != nil {
			log.WithError(err).Fatal("cannot prepare namespace")
		}
	},
}

func init() {
	integrationTestCmd.AddCommand(integrationTestSetupCmd)
}

var desiredObjTypes = []string{
	"ServiceAccount",
	"PodSecurityPolicy",
}

func getIntegrationTestPrerequisiteObjects(out io.Writer, namespace, gpHelmChartPath, version string) error {
	var helm string
	for _, c := range []string{"helm3", "helm"} {
		if _, err := exec.LookPath(c); err == nil {
			helm = c
			break
		}
	}
	if helm == "" {
		return xerrors.Errorf("no helm executable found in path")
	}

	// This command renders the helm template and selects everything workspace related.
	// The "workspace selector" is a heuristic that seems to work well.

	var (
		eg     errgroup.Group
		ri, ro = io.Pipe()
	)
	eg.Go(func() error {
		helmCmd := exec.Command(helm, "template", "--set", "version="+version, "-n", namespace, ".")
		helmCmd.Dir = gpHelmChartPath
		helmCmd.Stdout = ro
		helmCmd.Stderr = os.Stderr
		err := helmCmd.Run()
		if err != nil {
			return xerrors.Errorf("cannot run helm: %w", err)
		}
		ro.Close()
		return nil
	})
	eg.Go(func() error {
		dr := yaml.NewDocumentDecoder(io.NopCloser(ri))
		buf := make([]byte, 100*4096)
		for {
			n, err := dr.Read(buf)
			if err == io.EOF {
				break
			}
			if err != nil {
				return xerrors.Errorf("cannot read YAML document: %w", err)
			}

			var ingest bool
			for _, dot := range desiredObjTypes {
				if !bytes.Contains(buf[0:n], []byte("workspace")) {
					continue
				}
				if !bytes.Contains(buf[0:n], []byte(dot)) {
					continue
				}

				ingest = true
				break
			}
			if !ingest {
				continue
			}

			fmt.Fprintf(out, "\n---\n")
			_, err = out.Write(buf[0:n])
			if err != nil {
				return err
			}
		}

		return nil
	})
	err := eg.Wait()
	if err != nil {
		return err
	}

	return nil
}
