// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package compute

import (
	"io/ioutil"
	"os"
	"strconv"
	"strings"

	"github.com/gitpod-io/gitpod/common-go/log"

	"encoding/json"

	"github.com/spf13/cobra"
	"golang.org/x/net/context"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/compute/v1"
)

type LocalSSD struct {
	DeviceName string
	Interface  string
}

func newInstanceTemplatesCreateCommand() *cobra.Command {
	var (
		region               string
		project              string
		machineType          string
		minCpuPlatform       string
		serviceAccount       string
		serviceAccountScopes string
		bootDiskSize         string
		bootDiskType         string
		tags                 string
		labels               string
		image                string
		networkInterface     string
		metadata             string
		metadataFromFile     string
		localSSDs            []string
		noRestartOnFailure   bool
		dryRun               bool
	)

	cmd := &cobra.Command{
		Use:     "create",
		Short:   "create wrapper",
		Example: "  create instance-template-1",
		Run: func(cmd *cobra.Command, args []string) {
			if len(args) != 1 {
				log.Fatal("no name was provided")
			}

			name := args[0]

			ctx := context.Background()

			c, err := google.DefaultClient(ctx, compute.CloudPlatformScope)
			if err != nil {
				log.Fatal(err)
			}

			computeService, err := compute.New(c)
			if err != nil {
				log.Fatal(err)
			}

			networkInterfaceParsed := parseLabels(networkInterface)
			automaticRestart := !noRestartOnFailure
			metadata := parseMetadata(metadata)
			metadata = append(metadata, parseMetadataFromFile(metadataFromFile)...)
			localSSDDevices := parseLocalSSDs(localSSDs)
			labels := parseLabels(labels)

			// source: https://cloud.google.com/sdk/gcloud/reference/beta/compute/instances/set-scopes
			scopesMapping := map[string][]string{
				"bigquery":              {"https://www.googleapis.com/auth/bigquery"},
				"cloud-platform":        {"https://www.googleapis.com/auth/cloud-platform"},
				"cloud-source-repos":    {"https://www.googleapis.com/auth/source.full_control"},
				"cloud-source-repos-ro": {"https://www.googleapis.com/auth/source.read_only"},
				"compute-ro":            {"https://www.googleapis.com/auth/compute.readonly"},
				"compute-rw":            {"https://www.googleapis.com/auth/compute"},
				"datastore":             {"https://www.googleapis.com/auth/datastore"},
				"default": {"https://www.googleapis.com/auth/devstorage.read_only",
					"https://www.googleapis.com/auth/logging.write",
					"https://www.googleapis.com/auth/monitoring.write",
					"https://www.googleapis.com/auth/pubsub",
					"https://www.googleapis.com/auth/service.management.readonly",
					"https://www.googleapis.com/auth/servicecontrol",
					"https://www.googleapis.com/auth/trace.append"},
				"gke-default": {"https://www.googleapis.com/auth/devstorage.read_only",
					"https://www.googleapis.com/auth/logging.write",
					"https://www.googleapis.com/auth/monitoring",
					"https://www.googleapis.com/auth/service.management.readonly",
					"https://www.googleapis.com/auth/servicecontrol",
					"https://www.googleapis.com/auth/trace.append"},
				"logging-write":      {"https://www.googleapis.com/auth/logging.write"},
				"monitoring":         {"https://www.googleapis.com/auth/monitoring"},
				"monitoring-read":    {"https://www.googleapis.com/auth/monitoring.read"},
				"monitoring-write":   {"https://www.googleapis.com/auth/monitoring.write"},
				"pubsub":             {"https://www.googleapis.com/auth/pubsub"},
				"service-control":    {"https://www.googleapis.com/auth/servicecontrol"},
				"service-management": {"https://www.googleapis.com/auth/service.management.readonly"},
				"sql-admin":          {"https://www.googleapis.com/auth/sqlservice.admin"},
				"storage-full":       {"https://www.googleapis.com/auth/devstorage.full_control"},
				"storage-ro":         {"https://www.googleapis.com/auth/devstorage.read_only"},
				"storage-rw":         {"https://www.googleapis.com/auth/devstorage.read_write"},
				"taskqueue":          {"https://www.googleapis.com/auth/taskqueue"},
				"trace":              {"https://www.googleapis.com/auth/trace.append"},
				"userinfo-email":     {"https://www.googleapis.com/auth/userinfo.email"},
			}
			// map serviceAccountScopes to scopesMapping
			scopes := []string{}
			for _, scope := range strings.Split(serviceAccountScopes, ",") {
				scopes = append(scopes, scopesMapping[scope]...)
			}

			rb := &compute.InstanceTemplate{
				Name: name,
				Properties: &compute.InstanceProperties{
					MachineType:    machineType,
					MinCpuPlatform: minCpuPlatform,
					ServiceAccounts: []*compute.ServiceAccount{
						{
							Email:  serviceAccount,
							Scopes: scopes,
						},
					},
					Disks: []*compute.AttachedDisk{
						{
							AutoDelete: true,
							Boot:       true,
							InitializeParams: &compute.AttachedDiskInitializeParams{
								DiskSizeGb:  parseDiskSize(bootDiskSize, 10),
								DiskType:    bootDiskType,
								SourceImage: image,
								Labels:      labels,
							},
						},
					},
					Tags: &compute.Tags{
						Items: strings.Split(tags, ","),
					},
					Labels: labels,
					NetworkInterfaces: []*compute.NetworkInterface{
						{
							AccessConfigs: []*compute.AccessConfig{
								{
									NetworkTier: networkInterfaceParsed["network-tier"],
									Type:        "ONE_TO_ONE_NAT",
								},
							},
							Network:    networkInterfaceParsed["network"],
							Subnetwork: networkInterfaceParsed["subnet"],
						},
					},
					Metadata: &compute.Metadata{
						Items: metadata,
					},
					Scheduling: &compute.Scheduling{
						AutomaticRestart: &automaticRestart,
					},
				},
			}

			for _, localSSD := range localSSDDevices {
				rb.Properties.Disks = append(rb.Properties.Disks, &compute.AttachedDisk{
					AutoDelete: true,
					Boot:       false,
					InitializeParams: &compute.AttachedDiskInitializeParams{
						DiskType: "local-ssd",
						// local ssd non persistent disks do not support labels
						//Labels:   labels,
					},
					Type:      "SCRATCH",
					Interface: localSSD.Interface,
				})
			}

			if dryRun {
				json, _ := json.MarshalIndent(rb, "", "    ")
				log.Infof("dry run: %s", string(json))
				return
			}

			resp, err := computeService.InstanceTemplates.Insert(project, rb).Context(ctx).Do()
			if err != nil {
				log.Fatal(err)
			}

			if resp.Error != nil {
				log.Fatal(resp.Error)
			}
			if resp.HttpErrorMessage != "" {
				log.Fatal(resp.HttpErrorMessage)
			}

			log.Infof("created instance template %s", name)
		},
	}

	cmd.Flags().StringVar(&region, "region", "", "gcp region")
	cmd.MarkFlagRequired("region")
	cmd.Flags().StringVar(&project, "project", "", "gcp project")
	cmd.MarkFlagRequired("project")
	cmd.Flags().StringVar(&machineType, "machine-type", "", "gcp machine type")
	cmd.MarkFlagRequired("machine-type")
	cmd.Flags().StringVar(&serviceAccount, "service-account", "", "gcp service account")
	cmd.MarkFlagRequired("service-account")
	cmd.Flags().StringVar(&serviceAccountScopes, "scopes", "", "gcp service account scopes")
	cmd.MarkFlagRequired("scopes")
	cmd.Flags().StringVar(&image, "image", "", "gcp image")
	cmd.MarkFlagRequired("image")
	cmd.Flags().StringVar(&networkInterface, "network-interface", "", "gcp network interface")
	cmd.MarkFlagRequired("network-interface")

	cmd.Flags().StringVar(&minCpuPlatform, "min-cpu-platform", "", "gcp min cpu platform")
	cmd.Flags().StringVar(&bootDiskSize, "boot-disk-size", "10GB", "gcp boot disk size")
	cmd.Flags().StringVar(&bootDiskType, "boot-disk-type", "pd-standard", "gcp boot disk type")
	cmd.Flags().StringVar(&tags, "tags", "", "gcp tags")
	cmd.Flags().StringVar(&labels, "labels", "", "gcp labels")
	cmd.Flags().StringVar(&metadata, "metadata", "", "gcp metadata")
	cmd.Flags().StringVar(&metadataFromFile, "metadata-from-file", "", "gcp metadata from file")
	cmd.Flags().StringArrayVar(&localSSDs, "local-ssd", []string{}, "gcp local ssd")
	cmd.Flags().BoolVar(&noRestartOnFailure, "no-restart-on-failure", false, "gcp no restart on failure")
	cmd.Flags().BoolVar(&dryRun, "dry-run", false, "gcp dry run")

	return cmd
}

// simple disk size parser (gcloud accepts sizes other then GB but for our case GB is enough for now)
func parseDiskSize(s string, defaultSize int64) int64 {
	if s == "" {
		return defaultSize
	}
	if !strings.HasSuffix(s, "GB") {
		log.Fatal("disk size must be in GB")
	}
	s = strings.TrimSuffix(s, "GB")
	i, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		log.Fatalf("failed to parse disk size: %s", err)
	}
	return i
}

func parseLabels(s string) map[string]string {
	if s == "" {
		return nil
	}
	m := make(map[string]string)
	for _, l := range strings.Split(s, ",") {
		parts := strings.Split(l, "=")
		if len(parts) != 2 {
			log.Fatal("label must be in format key=value")
		}
		m[parts[0]] = parts[1]
	}
	return m
}

func parseMetadata(s string) []*compute.MetadataItems {
	if s == "" {
		return nil
	}
	m := make([]*compute.MetadataItems, 0)
	for _, l := range strings.Split(s, ",") {
		key, value, found := strings.Cut(l, "=")
		if !found {
			log.Fatalf("metadata must be in format key=value, got: %s", l)
		}
		m = append(m, &compute.MetadataItems{
			Key:   key,
			Value: &value,
		})
	}
	return m
}

func parseMetadataFromFile(s string) []*compute.MetadataItems {
	if s == "" {
		return nil
	}
	m := make([]*compute.MetadataItems, 0)
	for _, l := range strings.Split(s, ",") {
		key, value, found := strings.Cut(l, "=")
		if !found {
			log.Fatalf("metadata must be in format key=value, got: %s", l)
		}
		// open file from value
		file, err := os.Open(value)
		if err != nil {
			log.Fatalf("failed to open file: %s", err)
		}
		defer file.Close()
		// read file content
		content, err := ioutil.ReadAll(file)
		if err != nil {
			log.Fatalf("failed to read file: %s", err)
		}
		file_content := string(content)
		m = append(m, &compute.MetadataItems{
			Key:   key,
			Value: &file_content,
		})
	}
	return m
}

func parseLocalSSDs(s []string) []*LocalSSD {
	if len(s) == 0 {
		return nil
	}
	m := make([]*LocalSSD, 0)
	for i, l := range s {
		params := strings.Split(l, ",")
		deviceName := "local-ssd-" + strconv.Itoa(i)
		interfaceName := "SCSI"
		for _, p := range params {
			parts := strings.Split(p, "=")
			if len(parts) != 2 {
				log.Fatal("local ssd params must be in format key=value")
			}
			if parts[0] != "device-name" && parts[0] != "interface" {
				log.Fatal("local ssd params must be in format device-name=value or interface=value")
			}
			if parts[0] == "device-name" {
				deviceName = parts[1]
			}
			if parts[0] == "interface" {
				interfaceName = parts[1]
			}
		}
		m = append(m, &LocalSSD{
			DeviceName: deviceName,
			Interface:  interfaceName,
		})
	}
	return m
}
