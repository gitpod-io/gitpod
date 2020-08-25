// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gitpod-io/installer/pkg/aws"
	"github.com/gitpod-io/installer/pkg/sources"
	"github.com/gitpod-io/installer/pkg/terraform"
	"github.com/gitpod-io/installer/pkg/ui"
	"github.com/spf13/cobra"
)

// awsCmd represents the gcp command
var awsCmd = &cobra.Command{
	Use:   "aws",
	Short: "Installs Gitpod in AWS",
	Run: func(cmd *cobra.Command, args []string) {
		ui.Infof("Making sure we have access to AWS")
		if os.Getenv("AWS_ACCESS_KEY_ID") == "" || os.Getenv("AWS_SECRET_ACCESS_KEY") == "" {
			// TODO(cw): when running this installer as Docker container we can provide a better message here,
			//			 e.g. "... using `-e AWS_ACCESS_KEY_ID=<yourAccessKey> -e AWS_SECRET_ACCESS_KEY=<secretAccessKey>`"
			msg := "Please ensure that the AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables are set"
			if os.Getenv("GITPOD_INSTALLER_IN_DOCKER") != "" {
				msg += " by passing\n\t-e AWS_ACCESS_KEY_ID=<yourAccessKey> -e AWS_SECRET_ACCESS_KEY=<secretAccessKey>\nto your docker run command."
			} else {
				msg += "."
			}
			ui.Fatalf(msg)
		}

		ui.Infof("Copying installation scripts")
		layout := getLayout()
		err := sources.CloneAndOwn(layout, getCloneAndOwnOpts())
		if err != nil {
			ui.Fatalf("cannot prepare the installation scripts.\n\t%q", err)
		}

		ui.Infof("Gathering information")
		basedir := layout.TerraformDestination("aws")
		tfvarsfn := filepath.Join(basedir, "main.auto.tfvars")
		err = terraform.PersistVariable(tfvarsfn, aws.RequiredTerraformVariables...)
		if err != nil {
			ui.Fatalf("cannot update the required terraform variables.\n\t%q", err)
		}

		var (
			domain, _ = terraform.GetVariableValue(tfvarsfn, "domain")
			ipDomain  bool
		)
		if domain == "" || domain == "ipDomain" {
			ui.Infof("\nWe won't use a custom domain for this installation, but one based on ip.gitpod-self-hosted.com.\n" +
				"To this end, terraform will run twice: once to set everything up, including the loadbalancer IP, then to apply the domain based on that IP.\n")
			time.Sleep(5 * time.Second)
			ipDomain = true

			err = terraform.PersistVariable(tfvarsfn, terraform.PersistVariableOpts{
				Name: "domain",
				Sources: []terraform.VariableValueSource{
					func(name string, spec terraform.VariableSpec) (value string, ok bool) { return "ipDomain", true },
				},
				ForceOverwrite: true,
			})
			if err != nil {
				ui.Fatalf("cannot update the \"domain\" terraform variables.\n\t%q", err)
			}
		}

		terraform.Run([]string{"init"}, terraform.WithBasedir(basedir), terraform.WithFatalErrors)
		terraform.Run([]string{"apply"}, terraform.WithBasedir(basedir), terraform.WithRetry(aws.TerraformErrorRetry(
			func(name string) {
				err := terraform.UnsetVariable(tfvarsfn, name)
				if err != nil {
					ui.Errorf("Cannot unset %v, please manually edit aws/%s and remove the line starting with %s", name, tfvarsfn, name)
				}
			},
		), 0*time.Second))

		// lookup the domain and ensure it matches the static ip from the terraform run
		// if it doesn't, tell the user to modify their DNS records, wait for confirmation and try again
		ingressHostname, err := terraform.GetOutputValue(basedir, "ingress_hostname")
		if err != nil || ingressHostname == "" {
			// TODO(cw): produce a more helpful message, e.g. manually setting the ip.mygitpod.com domain
			ui.Fatalf("cannot get ingress hostname from terraform state.\n\t%q", err)
		} else if ipDomain {
			// now that we know that static IP we can update the terraform config and re-run
			segs := strings.Split(ingressHostname, ".")
			if len(segs) < 2 {
				ui.Fatalf("unexpected ingress hostname: %s", ingressHostname)
			}

			domain = fmt.Sprintf("%s--%s.ip.mygitpod.com", segs[0], segs[1])
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
				ui.Fatalf("cannot update the \"domain\" terraform variables - please re-run this installer.\n\t%q", err)
			}
			ui.Infof("re-running terraform to use the new domain %s", domain)
			terraform.Run([]string{"apply", "-auto-approve"}, terraform.WithBasedir(basedir), terraform.WithFatalErrors)

			ui.Infof("🎉  Your installation is ready at https://%s/workspaces/", domain)
		} else {
			ui.Infof("Please update your DNS records so that %s points to %s.", domain, ingressHostname)
			ui.Infof("🎉  Then your installation is ready at https://%s/workspaces/", domain)
		}

		// TODO(cw): smoke-test the installation
	},
}

func init() {
	rootCmd.AddCommand(awsCmd)
}
