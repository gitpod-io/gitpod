// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"errors"
	"fmt"
	"io/ioutil"
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
		version, err := ioutil.ReadFile(layout.VersionDestination())
		if err != nil {
			ui.Fatalf("failed to read version file %q:\n\t%q", layout.VersionDestination(), err)
		}

		branchPreview, _ := cmd.Flags().GetBool("branch-preview")
		folderID, _ := cmd.Flags().GetString("branch-preview-project-folder-id")
		billingAccountID, _ := cmd.Flags().GetString("branch-preview-billing-account-id")
		rootDNSZoneID, _ := cmd.Flags().GetString("root-clouddns-zone")

		if branchPreview {
			ui.Infof("Branch preview is enabled")

			setupBranchPreviewProject(branchPreviewProjectSettings{
				Version:                  string(version),
				FolderID:                 folderID,
				BillingAccountID:         billingAccountID,
				TerraformVarsFilepath:    tfvarsfn,
				TerraformBackendFilepath: filepath.Join(layout.TerraformDestination("gcp"), "backend.tf"),
				RootDNSZoneID:            rootDNSZoneID,
				DNSZoneName:              "gitpod-dns",
			})
		}

		if rootOpts.debug {
			// when in debug mode terraform chart_location needs to be updated to point to the charts
			// in the temporary install folder
			if err := terraform.PersistVariable(tfvarsfn, terraform.PersistVariableOpts{
				Name: "chart_location",
				Sources: []terraform.VariableValueSource{
					func(name string, spec terraform.VariableSpec) (value string, ok bool) {
						dest := layout.HelmDestination()
						// the chart_location expect a relative path from the tf root
						dest = strings.ReplaceAll(dest, layout.DestinationFolder(), "../")
						return dest, true
					},
				},
			}); err != nil {
				ui.Fatalf("failed to update chart_location terraform variable:\n\t%q", err)
			}
		}

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
				ui.Fatalf("cannot update the \"domain\" terraform variable:\n\t%q", err)
			}
		} else if !strings.Contains(domain, "ip.mygitpod.com") {
			err = terraform.PersistVariable(tfvarsfn,
				terraform.PersistVariableOpts{
					Name:    "force_https",
					Sources: []terraform.VariableValueSource{func(name string, spec terraform.VariableSpec) (value string, ok bool) { return "true", true }},
				},
				terraform.PersistVariableOpts{
					Name:    "certbot_enabled",
					Sources: []terraform.VariableValueSource{func(name string, spec terraform.VariableSpec) (value string, ok bool) { return "true", true }},
				},
				terraform.PersistVariableOpts{
					Name: "certificate_email",
					Spec: terraform.VariableSpec{
						Description: "Gitpod will attempt to issue HTTPS certificates for you. Please provide an email that's used with Let's Encrypt to do so.",
						Validate: func(val string) error {
							if !strings.Contains(val, "@") {
								return fmt.Errorf("not a valid email address")
							}
							return nil
						},
					},
				},
			)
			if err != nil {
				ui.Fatalf("cannot update the \"domain\" terraform variables:\n\t%q", err)
			}
		}

		err = terraform.Run([]string{"init"}, terraform.WithBasedir(basedir), terraform.WithFatalErrors)
		if err != nil {
			ui.Fatalf("terraform failed to init:\n\t%q", err)
		}

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
			if err := terraform.Run([]string{"apply", "-auto-approve"}, terraform.WithBasedir(basedir), terraform.WithFatalErrors); err != nil {
				ui.Fatalf("terraform failed to re-apply:\n\t%q", err)
			}
		} else if !strings.Contains(domain, "ip.mygitpod.com") {
			if rootDNSZoneID == "" {
				ui.Infof("Please update your DNS records so that %s points to %s.", domain, publicIP)
			}
		}

		// TODO(cw): wait for the installation to actually become available

		ui.Infof("🎉  Your installation is ready at https://%s/workspaces/", domain)

		// TODO(cw): smoke-test the installation
	},
}

type branchPreviewProjectSettings struct {
	Version                  string
	FolderID                 string
	BillingAccountID         string
	TerraformVarsFilepath    string
	TerraformBackendFilepath string
	RootDNSZoneID            string
	DNSZoneName              string
}

func setupBranchPreviewProject(settings branchPreviewProjectSettings) {
	branch, _, err := sources.ParseVersionBranch(settings.Version)
	if err != nil {
		ui.Fatalf("failed to extract branch from version %q:\n\t%q", settings.Version, err)
	}
	ui.Infof("\tversion: %s", settings.Version)
	ui.Infof("\tbranch: %s", branch)

	projectID, projectName := gcp.GenerateProjectNameAndID("gitpod-", branch)
	// Gitpod installation for this branch requires a dedicated project,
	// where its ID have been derived from the branch name.
	// If the project doesn't exists, it will be created
	ctx := context.Background()
	ok, err := gcp.ProjectExists(ctx, projectID)
	if err != nil {
		ui.Fatalf("failed to check project existance:\n\t%q", err)
	}
	if !ok {
		ui.Infof("Creating new GCP project (id: %q, name: %q), this may take a while...", projectID, projectName)
		err := gcp.CreateProject(ctx, projectID, projectName, settings.FolderID)
		if err != nil {
			ui.Fatalf("failed to auto create GCP project:\n\t%q", err)
		}

		ui.Infof("Success creating project %q", projectID)
	} else {
		ui.Infof("GCP project %q already exists", projectID)
	}

	if settings.BillingAccountID != "" {
		ui.Infof("Configuring billing account %q", settings.BillingAccountID)
		if err := gcp.ConfigureProjectBilling(ctx, projectID, settings.BillingAccountID); err != nil {
			ui.Fatalf("failed to configure billing account %q:\n\t%q", settings.BillingAccountID, err)
		}
	}

	ui.Infof("Enabling services...")
	if err := gcp.EnableProjectServices(ctx, projectID, nil); err != nil {
		ui.Fatalf("failed to enable project services:\n\t%q", err)
	}

	tfStateBucketName := fmt.Sprintf("%s-tfstate", projectID)
	ui.Infof("Creating terraform state storage bucket %q", tfStateBucketName)
	if err := gcp.CreateStorageBucket(ctx, projectID, tfStateBucketName); err != nil {
		ui.Fatalf("failed to create storage bucket:\n\t%q", err)
	}

	// Update terraform project variable with the generated projectID
	if err = terraform.PersistVariable(settings.TerraformVarsFilepath, terraform.PersistVariableOpts{
		Name:           "project",
		ForceOverwrite: true,
		Sources: []terraform.VariableValueSource{
			func(name string, spec terraform.VariableSpec) (value string, ok bool) { return projectID, true },
		},
	}); err != nil {
		ui.Fatalf("failed to overwrite terraform project:\n\t%q", err)
	}

	// Update terraform domain variable with a branch.domain subdomain
	// when a baseDomain exists. Otherwise, retrieve a baseDomain from other sources first.
	baseDomain, _ := terraform.GetVariableValue(settings.TerraformVarsFilepath, "domain")
	if settings.RootDNSZoneID != "" {
		baseDomain, err = gcp.GetRootDNSName(context.Background(), settings.RootDNSZoneID)
		if err != nil {
			ui.Fatalf("failed to retrieve root dns name from zone: %v", err)
		}

		ui.Infof("Using %q as a base domain from DNS zone", baseDomain)
	}
	var branchDomain string
	var persistDomainOpts terraform.PersistVariableOpts
	if baseDomain == "" || baseDomain == "ipDomain" {
		ui.Infof("\nBranch preview requires a base domain used to create subdomains for each installed branch.\n")
		persistDomainOpts = terraform.PersistVariableOpts{
			Name:           "domain",
			ForceOverwrite: true,
			Spec: terraform.VariableSpec{
				Validate: func(val string) error {
					if val == "" || val == "ipDomain" {
						return errors.New("invalid domain, must not be empty or \"ipDomain\"")
					}
					return nil
				},
				BeforeSaveHook: func(val string) string {
					branchDomain = fmt.Sprintf("%s.%s", branch, val)
					return branchDomain
				},
			},
		}
	} else {
		branchDomain = fmt.Sprintf("%s.%s", branch, baseDomain)
		persistDomainOpts = terraform.PersistVariableOpts{
			Name:           "domain",
			ForceOverwrite: true,
			Sources: []terraform.VariableValueSource{func(name string, spec terraform.VariableSpec) (value string, ok bool) {
				return branchDomain, true
			}},
		}
	}
	if err := terraform.PersistVariable(settings.TerraformVarsFilepath, persistDomainOpts); err != nil {
		ui.Fatalf("cannot update the \"domain\" terraform variable:\n\t%q", err)
	}

	// Creates a DNS zone for the branchDomain
	if err := terraform.PersistVariable(settings.TerraformVarsFilepath, terraform.PersistVariableOpts{
		Name:           "zone_name",
		ForceOverwrite: true,
		Sources: []terraform.VariableValueSource{func(name string, spec terraform.VariableSpec) (value string, ok bool) {
			return settings.DNSZoneName, true
		}},
	}); err != nil {
		ui.Fatalf("cannot update the \"zone_name\" terraform variable:\n\t%q", err)
	}

	ui.Infof("Creating DNS zone %s", settings.DNSZoneName)
	nameservers, err := gcp.CreateDNSZone(ctx, projectID, settings.DNSZoneName, branchDomain)
	if err != nil {
		ui.Fatalf("failed to create dns zone:\n\t%q", err)
	}
	ui.Infof("DNS nameservers for zone: %v", nameservers)

	if settings.RootDNSZoneID != "" {
		if err := gcp.UpdateDNSNameservers(ctx, settings.RootDNSZoneID, branchDomain, nameservers); err != nil {
			ui.Fatalf("failed to set NS record in parent DNS zone:\n\t%q", err)
		}
		ui.Infof("Root zone %q have been updated with subdomain zone nameservers", settings.RootDNSZoneID)
	}

	// Configure terraform backend to use a bucket in the newly created project to store its state
	// this allows to rerun the installer from a different build on the same project.
	if err = terraform.ConfigureGCPBackend(
		settings.TerraformBackendFilepath,
		tfStateBucketName,
		"tf-state",
	); err != nil {
		ui.Fatalf("failed to create terraform state backend: %v", err)
	}
}

func init() {
	rootCmd.AddCommand(gcpCmd)

	gcpCmd.Flags().Bool("assume-gcp-access", false, "don't check if we can GCP access or attempt to login to GCP")
	gcpCmd.Flags().String("root-clouddns-zone", "", "optionnal GCP CloudDNS zone name managing the root domain. When specified, the installer will insert NS records pointing to the Gitpod installation (format <projectID>/managedZones/<zoneName>)")
	gcpCmd.Flags().Bool("branch-preview", false, "indicate that this installation is a branch preview")
	gcpCmd.Flags().String("branch-preview-project-folder-id", "", "(requires branch-preview) ID of a GCP folder where the branch-preview project will be created")
	gcpCmd.Flags().String("branch-preview-billing-account-id", "", "(requires branch-preview) ID of the billing account to link on newly created projects (format: 012345-567890-ABCDEF)")
}
