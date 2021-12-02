// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package proxy

import (
	"bytes"
	_ "embed"
	"encoding/base64"
	"fmt"
	minioComponent "github.com/gitpod-io/gitpod/installer/pkg/components/minio"
	openvsxproxy "github.com/gitpod-io/gitpod/installer/pkg/components/openvsx-proxy"
	"text/template"

	"github.com/gitpod-io/gitpod/installer/pkg/common"

	"golang.org/x/crypto/bcrypt"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/pointer"
)

//go:embed templates/configmap/vhost.docker-registry.tpl
var vhostDockerRegistry []byte

//go:embed templates/configmap/vhost.empty.tpl
var vhostEmptyTmpl []byte

//go:embed templates/configmap/vhost.kedge.tpl
var vhostKedgeTmpl []byte

//go:embed templates/configmap/vhost.minio.tpl
var vhostMinioTmpl []byte

//go:embed templates/configmap/vhost.open-vsx.tpl
var vhostOpenVSXTmpl []byte

//go:embed templates/configmap/vhost.payment-endpoint.tpl
var vhostPaymentEndpointTmpl []byte

type commonTpl struct {
	Domain       string
	ReverseProxy string
}

type dockerRegistryTpl struct {
	Domain       string
	ReverseProxy string
	Username     string
	Password     string
}

type openVSXTpl struct {
	Domain  string
	RepoURL string
}

func renderTemplate(tpl []byte, values interface{}) (*string, error) {
	t, err := template.New("template").Parse(string(tpl))
	if err != nil {
		return nil, err
	}

	var parsed bytes.Buffer
	err = t.Execute(&parsed, values)
	if err != nil {
		return nil, err
	}

	rendered := parsed.String()

	return &rendered, nil
}

const kubeDomain = "svc.cluster.local"

func configmap(ctx *common.RenderContext) ([]runtime.Object, error) {
	empty, err := renderTemplate(vhostEmptyTmpl, nil)
	if err != nil {
		return nil, err
	}

	openVSX, err := renderTemplate(vhostOpenVSXTmpl, openVSXTpl{
		Domain:  ctx.Config.Domain,
		RepoURL: fmt.Sprintf("openvsx-proxy.%s.%s:%d", ctx.Namespace, kubeDomain, openvsxproxy.ServicePort),
	})
	if err != nil {
		return nil, err
	}

	paymentEndpoint, err := renderTemplate(vhostPaymentEndpointTmpl, commonTpl{
		Domain:       ctx.Config.Domain,
		ReverseProxy: fmt.Sprintf("payment-endpoint.%s.%s:%d", ctx.Namespace, kubeDomain, 3002), // todo(sje): get port from (future) config
	})
	if err != nil {
		return nil, err
	}

	// todo(sje): can this be deleted?
	kedge, err := renderTemplate(vhostKedgeTmpl, commonTpl{
		Domain:       ctx.Config.Domain,
		ReverseProxy: fmt.Sprintf("kedge.%s.%s:%d", ctx.Namespace, kubeDomain, 8080), // todo(sje): get port from (future) config
	})
	if err != nil {
		return nil, err
	}

	data := map[string]string{
		"vhost.empty":            *empty,
		"vhost.open-vsx":         *openVSX,
		"vhost.payment-endpoint": *paymentEndpoint,
		"vhost.kedge":            *kedge,
	}

	if ctx.Config.ObjectStorage.CloudStorage == nil {
		// Don't expose Minio if using cloud storage
		minio, err := renderTemplate(vhostMinioTmpl, commonTpl{
			Domain:       ctx.Config.Domain,
			ReverseProxy: fmt.Sprintf("minio.%s.%s:%d", ctx.Namespace, kubeDomain, minioComponent.ServiceConsolePort),
		})
		if err != nil {
			return nil, err
		}
		data["vhost.minio"] = *minio
	}

	if pointer.BoolDeref(ctx.Config.ContainerRegistry.InCluster, false) {
		username := ctx.Values.InternalRegistryUsername
		if username == "" {
			return nil, fmt.Errorf("unknown value: internal registry username")
		}

		password := ctx.Values.InternalRegistryPassword
		if password == "" {
			return nil, fmt.Errorf("unknown value: internal registry password")
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}

		dockerRegistry, err := renderTemplate(vhostDockerRegistry, dockerRegistryTpl{
			Domain:       ctx.Config.Domain,
			ReverseProxy: fmt.Sprintf("https://%s.%s.%s", common.DockerRegistryName, ctx.Namespace, kubeDomain),
			Username:     username,
			Password:     base64.StdEncoding.EncodeToString(hashedPassword),
		})
		if err != nil {
			return nil, err
		}

		data["vhost.docker-registry"] = *dockerRegistry
	}

	return []runtime.Object{
		&corev1.ConfigMap{
			TypeMeta: common.TypeMetaConfigmap,
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("%s-config", Component),
				Namespace: ctx.Namespace,
				Labels:    common.DefaultLabels(Component, ctx),
			},
			Data: data,
		},
	}, nil
}
