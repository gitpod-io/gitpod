// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package k3s

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/cockroachdb/errors"
	"github.com/sirupsen/logrus"
	"golang.org/x/crypto/ssh"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/gitpod-io/gitpod/previewctl/pkg/k8s"
	kctx "github.com/gitpod-io/gitpod/previewctl/pkg/k8s/context"
	pssh "github.com/gitpod-io/gitpod/previewctl/pkg/ssh"
)

var _ kctx.Loader = (*ConfigLoader)(nil)

const (
	k3sConfigPath   = "/etc/rancher/k3s/k3s.yaml"
	catK3sConfigCmd = "sudo cat /etc/rancher/k3s/k3s.yaml"
)

var (
	ErrK3SConfigNotFound = errors.New("k3s config file not found")
)

type ConfigLoader struct {
	logger *logrus.Logger

	sshClientFactory pssh.ClientFactory
	client           pssh.Client

	configPath string
	opts       ConfigLoaderOpts
}

type ConfigLoaderOpts struct {
	Logger *logrus.Logger

	PreviewName       string
	PreviewNamespace  string
	SSHPrivateKeyPath string
	SSHUser           string
}

func New(ctx context.Context, opts ConfigLoaderOpts) (*ConfigLoader, error) {
	key, err := os.ReadFile(opts.SSHPrivateKeyPath)
	if err != nil {
		return nil, err
	}

	signer, err := ssh.ParsePrivateKey(key)
	if err != nil {
		return nil, err
	}

	config := &ConfigLoader{
		logger: opts.Logger,
		sshClientFactory: &pssh.FactoryImplementation{
			SSHConfig: &ssh.ClientConfig{
				User: opts.SSHUser,
				Auth: []ssh.AuthMethod{
					ssh.PublicKeys(signer),
				},
				HostKeyCallback: ssh.InsecureIgnoreHostKey(),
			},
		},
		configPath: k3sConfigPath,
		opts:       opts,
	}

	return config, nil
}

func (k *ConfigLoader) installVMSSHKeys() error {
	path := filepath.Join(os.Getenv("LEEWAY_WORKSPACE_ROOT"), "dev/preview/ssh-vm.sh")
	cmd := exec.Command(path, "-c", "echo success", "-v", k.opts.PreviewName)
	cmd.Env = os.Environ()

	output, err := cmd.CombinedOutput()
	if err != nil {
		k.logger.WithError(err).WithField("output", string(output)).Error("failed to install VM SSH keys")
		return errors.Wrap(err, string(output))
	}
	return nil
}

func (k *ConfigLoader) Load(ctx context.Context) (*api.Config, error) {
	if k.client == nil {
		err := k.installVMSSHKeys()
		if err != nil {
			k.logger.Error(err)
			return nil, err
		}
		err = k.connectToHost(ctx, fmt.Sprintf("%s.preview.gitpod-dev.com", k.opts.PreviewName), "2222")
		if err != nil {
			k.logger.Error(err)
			return nil, err
		}

		defer func(k *ConfigLoader) {
			err := k.Close()
			if err != nil {
				k.logger.WithFields(logrus.Fields{"err": err}).Error("failed to close client")
				return
			}
		}(k)
	}

	return k.getContext(ctx)
}

func (k *ConfigLoader) getContext(ctx context.Context) (*api.Config, error) {
	stdout := new(bytes.Buffer)
	stderr := new(bytes.Buffer)

	err := k.client.Run(ctx, catK3sConfigCmd, stdout, stderr)
	if err != nil {
		if strings.Contains(stderr.String(), "No such file or directory") {
			return nil, ErrK3SConfigNotFound
		}

		return nil, errors.Wrap(err, stderr.String())
	}

	c, err := clientcmd.NewClientConfigFromBytes(stdout.Bytes())
	if err != nil {
		return nil, err
	}

	rc, err := c.RawConfig()
	if err != nil {
		return nil, err
	}

	k3sConfig, err := k8s.RenameConfig(&rc, "default", k.opts.PreviewName)
	if err != nil {
		return nil, err
	}

	k3sConfig.Clusters[k.opts.PreviewName].Server = fmt.Sprintf("https://%s.preview.gitpod-dev.com:6443", k.opts.PreviewName)

	return &rc, nil
}

func (k *ConfigLoader) connectToHost(ctx context.Context, host, port string) error {
	client, err := k.sshClientFactory.Dial(ctx, host, port)
	if err != nil {
		return err
	}
	k.client = client

	return nil
}

func (k *ConfigLoader) Close() error {
	if k.client == nil {
		return errors.New("attempting to close a nil client")
	}

	if err := k.client.Close(); err != nil {
		return err
	}

	k.client = nil
	return nil
}
