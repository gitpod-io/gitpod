// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
)

var (
	hostname            string
	hostfs              string
	port                int
	containerdConfigDir string
)

var setupCmd = &cobra.Command{
	Use:   "setup",
	Short: "Updates the /etc/hosts file, updates the CA certificates and creates the registry host for containerd",
	Run: func(cmd *cobra.Command, args []string) {
		{
			log.Info("Creating containerd registry directory...")
			regDirectory := fmt.Sprintf("/certs.d/%v:%v", hostname, port)

			fakeRegPath := filepath.Join(hostfs, containerdConfigDir, regDirectory)
			err := os.MkdirAll(fakeRegPath, 0644)
			if err != nil {
				log.Fatalf("cannot create containerd cert directory: %v", err)
			}

			caPath := filepath.Join(fakeRegPath, "ca.crt")
			err = copyFile("/usr/local/share/ca-certificates/gitpod-ca.crt", caPath)
			if err != nil {
				log.Fatal(err)
			}

			// https://github.com/containerd/containerd/blob/main/docs/cri/config.md#registry-configuration
			// https://github.com/containerd/containerd/blob/main/docs/hosts.md
			hostsToml := fmt.Sprintf(`
server = "https://%v:%v"

[host."https://%v:%v"]
    capabilities = ["pull", "resolve"]
    ca = "%v"
	# skip verifications of the registry's certificate chain and host name when set to true
    #skip_verify = true
`, hostname, port, hostname, port, filepath.Join(containerdConfigDir, regDirectory, "ca.crt"))

			err = os.WriteFile(filepath.Join(fakeRegPath, "hosts.toml"), []byte(hostsToml), 0644)
			if err != nil {
				log.Fatalf("cannot create hosts.toml file: %v", err)
			}
		}

		{
			log.Info("Updating /etc/hosts file...")
			hostsPath := filepath.Join(hostfs, "/etc/hosts")
			if !hostExists(hostname, hostsPath) {
				err := addHost(hostname, "127.0.0.1", hostsPath)
				if err != nil {
					log.Fatalf("cannot update hosts file: %v", err)
				}
			}
		}
	},
}

func init() {
	rootCmd.AddCommand(setupCmd)

	setupCmd.Flags().StringVar(&hostname, "hostname", "", "registry facade host <hostname:port>")
	setupCmd.Flags().StringVar(&hostfs, "hostfs", "", "Mount point path for the root filesystem")
	setupCmd.Flags().IntVar(&port, "port", 31750, "Listening port for the new registry hostname")
	setupCmd.Flags().StringVar(&containerdConfigDir, "containerd-config-dir", "/etc/containerd", "Containerd configuration directory")

	_ = setupCmd.MarkFlagRequired("hostname")
	_ = setupCmd.MarkFlagRequired("hostfs")
}

func hostExists(hostname, hostsPath string) bool {
	b, err := os.ReadFile(hostsPath)
	if err != nil {
		panic(err)
	}

	exist, err := regexp.Match(hostname, b)
	if err != nil {
		return false
	}

	return exist
}

func addHost(hostname, ip, hostPath string) error {
	f, err := os.OpenFile(hostPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = f.WriteString(fmt.Sprintf("%v %v\n", ip, hostname))
	if err != nil {
		return err
	}

	return nil
}

func copyFile(source, target string) error {
	input, err := os.ReadFile(source)
	if err != nil {
		return fmt.Errorf("cannot read source file %v: %v", source, err)
	}

	err = os.WriteFile(target, input, 0644)
	if err != nil {
		return fmt.Errorf("cannot write to target file %v: %v", source, err)
	}

	return nil
}
