// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/rand"
	"time"

	"crypto/sha512"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

func newAdminCmd(logger *logrus.Logger) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "admin",
		Short: "Manage installation's admin",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := create(); err != nil {
				logger.WithError(err).Fatal("Failed to create preview.")
			}

			return nil
		},
	}

	credentialsCmd := &cobra.Command{
		Use:   "credentials",
		Short: "Manage credentials",
	}

	credentialsCmd.AddCommand(
		newCreateAdminCredentialsCmd(logger),
	)

	cmd.AddCommand(credentialsCmd)

	return cmd
}

func newCreateAdminCredentialsCmd(logger *logrus.Logger) *cobra.Command {
	var (
		expiry time.Duration
	)

	createAdminCredentialsCmd := &cobra.Command{
		Use:   "create",
		Short: "Create admin credentials",
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := cmd.Context()
			token, creds, err := createAdminCredentials(ctx, expiry)
			if err != nil {
				logger.WithError(err).Fatal("Failed to create admin credentials.")
			}

			logger.Info("Created new admin credentials.")
			logger.Info("Created new admin credentials.")
			logger.Infof("Token: 	%s", token)
			logger.Infof("Hash:		%s", creds.TokenHash)
			logger.Infof("Expires:	%d (%s)", creds.ExpiresAt, time.Unix(creds.ExpiresAt, 0).Format(time.RFC3339))
			logger.Infof("Algo:		%s", creds.Algo)
			return nil
		},
	}

	createAdminCredentialsCmd.Flags().DurationVar(&expiry, "expiry", 20*time.Minute, "When the credentials expire, from now")

	return createAdminCredentialsCmd
}

type adminCredentials struct {
	TokenHash string `json:"tokenHash"`
	Algo      string `json:"algo"`
	ExpiresAt int64  `json:"expiresAt"`
}

func createAdminCredentials(ctx context.Context, expiry time.Duration) (string, *adminCredentials, error) {
	config, err := clientcmd.BuildConfigFromFlags("", getKubeConfigPath())
	if err != nil {
		return "", nil, fmt.Errorf("failed to get k8s config from env: %w", err)
	}

	// create the clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return "", nil, fmt.Errorf("failed to construct k8s client: %w", err)
	}

	token := randStringBytes(20)

	h := sha512.New()
	h.Write([]byte(token))

	digest := hex.EncodeToString(h.Sum(nil))

	creds := &adminCredentials{
		Algo:      "sha512",
		TokenHash: digest,
		ExpiresAt: time.Now().UTC().Add(expiry).Unix(),
	}

	secretContents, err := json.Marshal(creds)
	if err != nil {
		return "", nil, fmt.Errorf("failed to serialize credentials into JSON: %w", err)
	}

	_, err = clientset.CoreV1().Secrets("default").Create(ctx, &v1.Secret{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "v1",
			Kind:       "Secret",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:      "admin-credentials",
			Namespace: "default",
			Labels: map[string]string{
				"app":       "gitpod",
				"component": "server",
			},
		},
		Data: map[string][]byte{
			"admin.json": secretContents,
		},
	}, metav1.CreateOptions{})
	if err != nil {
		return "", nil, fmt.Errorf("failed to create k8s secret: %w", err)
	}

	return token, creds, nil
}

const letterBytes = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

func randStringBytes(n int) string {
	b := make([]byte, n)
	for i := range b {
		b[i] = letterBytes[rand.Intn(len(letterBytes))]
	}
	return string(b)
}
