// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/gitpod-io/installer/pkg/gcp"
	"github.com/gitpod-io/installer/pkg/sources"
	"github.com/gitpod-io/installer/pkg/terraform"
	"github.com/gitpod-io/installer/pkg/ui"
	"github.com/spf13/cobra"
)

// gcpCmd represents the gcp command
var gcpCmd = &cobra.Command{
	Use:   "gcp",
	Short: "Installs Gitpod in a GCP project",
	Run: func(cmd *cobra.Command, args []string) {
		ui.Infof("Copying installation scripts")
		layout := getLayout()
		err := sources.CloneAndOwn(layout, getCloneAndOwnOpts())
		if err != nil {
			ui.Fatalf("cannot prepare the installation scripts:\n\t%q", err)
		}

		if skip, _ := cmd.Flags().GetBool("assume-gcp-access"); skip {
			ui.Warnf("Assuming we have access to GCP - not checking")
		} else {
			ui.Infof("Making sure we have access to GCP")
			err = gcp.EnsureLoggedIn()
			if err != nil {
				ui.Fatalf("cannot login to GCP:\n\t%q", err)
			}
		}

		ui.Infof("Gathering information")
		basedir := layout.TerraformDestination("gcp")
		tfvarsfn := filepath.Join(basedir, "main.auto.tfvars")
		err = terraform.PersistVariable(tfvarsfn, gcp.RequiredTerraformVariables...)
		if err != nil {
			ui.Fatalf("cannot update the required terraform variables:\n\t%q", err)
		}

		var (
			projectID, _ = terraform.GetVariableValue(tfvarsfn, "project")
			domain, _    = terraform.GetVariableValue(tfvarsfn, "domain")
			ipDomain     bool
		)
		if domain == "" || domain == "ipDomain" {
			ui.Infof("\nWe won't use a custom domain for this installation, but one based on ip.mygitpod.com.\n" +
				"To this end, terraform will run twice: once to set everything up, including the loadbalancer IP, then to apply the domain based on that IP.\n")
			time.Sleep(5 * time.Second)
			ipDomain = true

			err = terraform.PersistVariable(tfvarsfn, terraform.PersistVariableOpts{
				Name: "domain",
				Sources: []terraform.VariableValueSource{
					func(name string, spec terraform.VariableSpec) (value string, ok bool) { return "ipDomain", true },
				},
			})
			if err != nil {
				ui.Fatalf("cannot update the \"domain\" terraform variables:\n\t%q", err)
			}
		}

		terraform.Run([]string{"init"}, terraform.WithBasedir(basedir), terraform.WithFatalErrors)
		err = terraform.Run([]string{"apply"},
			terraform.WithBasedir(basedir),
			terraform.WithRetry(gcp.BackendErrorRetry(projectID), 30*time.Second),
		)
		if err != nil {
			ui.Fatalf("terraform failed:\n\t%q", err)
		}

		// lookup the domain and ensure it matches the static ip from the terraform run
		// if it doesn't, tell the user to modify their DNS records, wait for confirmation and try again
		publicIP, err := terraform.GetOutputValue(basedir, "public_ip")
		if err != nil || publicIP == "" {
			// TODO(cw): produce a more helpful message, e.g. manually setting the ip.gitpod-self-hosted.com domain
			ui.Fatalf("cannot get public ip from terraform state:\n\t%q", err)
		} else if ipDomain {
			// now that we know that static IP we can update the terraform config and re-run
			domain = fmt.Sprintf("%s.ip.mygitpod.com", strings.ReplaceAll(publicIP, ".", "-"))
			err = terraform.PersistVariable(tfvarsfn, terraform.PersistVariableOpts{
				Name: "domain",
				Sources: []terraform.VariableValueSource{
					func(name string, spec terraform.VariableSpec) (value string, ok bool) {
						return domain, true
					},
				},
				ForceOverwrite: true,
			}, terraform.PersistVariableOpts{Name: "force_https", ForceOverwrite: true, Sources: []terraform.VariableValueSource{
				func(name string, spec terraform.VariableSpec) (value string, ok bool) {
					return "true", true
				},
			}})
			if err != nil {
				ui.Fatalf("cannot update the \"domain\" terraform variables - please re-run this installer:\n\t%q", err)
			}
			ui.Infof("re-running terraform to use the new domain %s", domain)
			terraform.Run([]string{"apply", "-auto-approve"}, terraform.WithBasedir(basedir), terraform.WithFatalErrors)
		} else if !strings.Contains(domain, "ip.mygitpod.com") {
			ui.Infof("Please update your DNS records so that %s points to %s.", domain, publicIP)
		}

		// TODO(cw): wait for the installation to actually become available

		ui.Infof("🎉  Your installation is ready at https://%s/workspaces/", domain)

		// TODO(cw): smoke-test the installation
	},
}

func init() {
	rootCmd.AddCommand(gcpCmd)

	gcpCmd.Flags().Bool("assume-gcp-access", false, "don't check if we can GCP access or attempt to login to GCP")
}
