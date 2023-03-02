// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"

	"github.com/spf13/cobra"

	"github.com/gitpod-io/gitpod/common-go/log"
)

var (
	hostname string
	hostfs   string
	port     int
)

var setupCmd = &cobra.Command{
	Use:   "setup",
	Short: "Updates the /etc/hosts file, updates the CA certificates and creates the registry host for containerd",
	Run: func(cmd *cobra.Command, args []string) {
		{
			log.Info("Creating containerd registry directory...")
			regPath := filepath.Join(hostfs, fmt.Sprintf("/etc/containerd/certs.d/%v:%v", hostname, port))
			err := os.MkdirAll(regPath, 0644)
			if err != nil {
				log.Fatalf("cannot create containerd cert directory: %v", err)
			}

			err = copyFile("/usr/local/share/ca-certificates/gitpod-ca.crt", filepath.Join(regPath, "ca.crt"))
			if err != nil {
				log.Fatal(err)
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

		{
			log.Info("Updating CA certificates in the node...")
			shCmd := exec.Command("update-ca-certificates", "-f")
			shCmd.Stdin = os.Stdin
			shCmd.Stderr = os.Stderr
			shCmd.Stdout = os.Stdout

			err := shCmd.Run()
			if err != nil {
				log.Fatalf("cannot update CA certificates: %v", err)
			}

			sourceCA := "/etc/ssl/certs/ca-certificates.crt"
			targetCA := filepath.Join(hostfs, "/etc/ssl/certs/ca-certificates.crt")

			err = copyFile(sourceCA, targetCA)
			if err != nil {
				log.Fatal(err)
			}
		}
	},
}

func init() {
	rootCmd.AddCommand(setupCmd)

	setupCmd.Flags().StringVar(&hostname, "hostname", "", "registry facade host <hostname:port>")
	setupCmd.Flags().StringVar(&hostfs, "hostfs", "", "Mount point path for the root filesystem")
	setupCmd.Flags().IntVar(&port, "port", 31750, "Listening port for the new registry hostname")

	_ = setupCmd.MarkFlagRequired("hostname")
	_ = setupCmd.MarkFlagRequired("hostfs")
	_ = setupCmd.MarkFlagRequired("ca-directory")
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
