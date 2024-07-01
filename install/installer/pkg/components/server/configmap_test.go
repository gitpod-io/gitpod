// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
/// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package server

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/utils/pointer"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/components/auth"
	"github.com/gitpod-io/gitpod/installer/pkg/components/redis"
	config "github.com/gitpod-io/gitpod/installer/pkg/config/v1"
	"github.com/gitpod-io/gitpod/installer/pkg/config/v1/experimental"
	"github.com/gitpod-io/gitpod/installer/pkg/config/versions"
)

func TestConfigMap(t *testing.T) {
	type Expectation struct {
		EnableLocalApp                    bool
		RunDbDeleter                      bool
		DisableDynamicAuthProviderLogin   bool
		DisableWorkspaceGarbageCollection bool
		DefaultBaseImageRegistryWhiteList []string
		WorkspaceImage                    string
		JWTSecret                         string
		SessionSecret                     string
		GitHubApp                         experimental.GithubApp
		Auth                              auth.Config
		Redis                             redis.Configuration
	}

	expectation := Expectation{
		EnableLocalApp:                    true,
		DisableDynamicAuthProviderLogin:   true,
		RunDbDeleter:                      false,
		DisableWorkspaceGarbageCollection: true,
		DefaultBaseImageRegistryWhiteList: []string{"some-registry"},
		WorkspaceImage:                    "some-workspace-image",
		JWTSecret:                         "some-jwt-secret",
		SessionSecret:                     "some-session-secret",
		GitHubApp: experimental.GithubApp{
			AppId:           123,
			AuthProviderId:  "some-auth-provider-id",
			BaseUrl:         "some-base-url",
			CertPath:        "some-cert-path",
			Enabled:         true,
			LogLevel:        "some-log-level",
			MarketplaceName: "some-marketplace-name",
			WebhookSecret:   "some-webhook-secret",
			CertSecretName:  "some-cert-secret-name",
		},
		Auth: auth.Config{
			PKI: auth.PKIConfig{
				Signing: auth.KeyPair{
					ID:             "0001",
					PrivateKeyPath: "/secrets/auth-pki/signing/tls.key",
					PublicKeyPath:  "/secrets/auth-pki/signing/tls.crt",
				},
			},
			Session: auth.SessionConfig{
				LifetimeSeconds: int64((7 * 24 * time.Hour).Seconds()),
				Issuer:          "https://awesome.domain",
				Cookie: auth.CookieConfig{
					Name:     "__Host-_awesome_domain_jwt2_",
					MaxAge:   int64((7 * 24 * time.Hour).Seconds()),
					SameSite: "lax",
					Secure:   true,
					HTTPOnly: true,
				},
			},
		},
		Redis: redis.Configuration{
			Address: "redis.test_namespace.svc.cluster.local:6379",
		},
	}

	ctx, err := common.NewRenderContext(config.Config{
		Domain: "awesome.domain",
		Workspace: config.Workspace{
			WorkspaceImage: expectation.WorkspaceImage,
		},
		ContainerRegistry: config.ContainerRegistry{
			PrivateBaseImageAllowList: expectation.DefaultBaseImageRegistryWhiteList,
		},
		Experimental: &experimental.Config{
			WebApp: &experimental.WebAppConfig{
				Server: &experimental.ServerConfig{
					DisableDynamicAuthProviderLogin:   expectation.DisableDynamicAuthProviderLogin,
					EnableLocalApp:                    pointer.Bool(expectation.EnableLocalApp),
					RunDbDeleter:                      pointer.Bool(expectation.RunDbDeleter),
					DisableWorkspaceGarbageCollection: expectation.DisableWorkspaceGarbageCollection,
					OAuthServer: experimental.OAuthServer{
						JWTSecret: expectation.JWTSecret,
					},
					Session: experimental.Session{
						Secret: expectation.SessionSecret,
					},
					GithubApp: &expectation.GitHubApp,
				},
			},
		},
	}, versions.Manifest{}, "test_namespace")

	require.NoError(t, err)
	objs, err := configmap(ctx)
	if err != nil {
		t.Errorf("failed to generate configmap: %s\n", err)
	}

	configmap, ok := objs[0].(*corev1.ConfigMap)
	if !ok {
		t.Fatalf("rendering configmap did not return a configMap")
		return
	}

	configJson, ok := configmap.Data["config.json"]
	if ok == false {
		t.Errorf("no %q key found in configmap data", "config.json")
	}

	var config ConfigSerialized
	if err := json.Unmarshal([]byte(configJson), &config); err != nil {
		t.Errorf("failed to unmarshal config json: %s", err)
	}

	actual := Expectation{
		DisableDynamicAuthProviderLogin:   config.DisableDynamicAuthProviderLogin,
		EnableLocalApp:                    config.EnableLocalApp,
		RunDbDeleter:                      config.RunDbDeleter,
		DisableWorkspaceGarbageCollection: config.WorkspaceGarbageCollection.Disabled,
		DefaultBaseImageRegistryWhiteList: config.DefaultBaseImageRegistryWhitelist,
		WorkspaceImage:                    config.WorkspaceDefaults.WorkspaceImage,
		JWTSecret:                         config.OAuthServer.JWTSecret,
		SessionSecret:                     config.Session.Secret,
		GitHubApp: experimental.GithubApp{
			AppId:           config.GitHubApp.AppId,
			AuthProviderId:  config.GitHubApp.AuthProviderId,
			BaseUrl:         config.GitHubApp.BaseUrl,
			CertPath:        config.GitHubApp.CertPath,
			Enabled:         config.GitHubApp.Enabled,
			LogLevel:        config.GitHubApp.LogLevel,
			MarketplaceName: config.GitHubApp.MarketplaceName,
			WebhookSecret:   config.GitHubApp.WebhookSecret,
			CertSecretName:  config.GitHubApp.CertSecretName,
		},
		Auth:  config.Auth,
		Redis: config.Redis,
	}

	assert.Equal(t, expectation, actual)
}
