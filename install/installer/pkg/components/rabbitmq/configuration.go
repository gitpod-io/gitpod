// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package rabbitmq

import (
	"encoding/json"
	"fmt"

	"github.com/gitpod-io/gitpod/installer/pkg/common"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type parameterValues struct {
	AckMode               string `json:"ack-mode"`
	SrcDeleteAfter        string `json:"src-delete-after"`
	SrcExchange           string `json:"src-exchange"`
	SrcExchangeKey        string `json:"src-exchange-key"`
	SrcProtocol           string `json:"src-protocol"`
	SrcUri                string `json:"src-uri"`
	DestAddForwardHeaders string `json:"dest-add-forward-headers"`
	DestExchange          string `json:"dest-exchange"`
	DestProtocol          string `json:"dest-protocol"`
	DestUri               string `json:"dest-uri"`
	ReconnectDelay        int    `json:"reconnect-delay"`
}

type parameter struct {
	Name      string          `json:"name"`
	Vhost     string          `json:"vhost"`
	Component string          `json:"component"`
	Values    parameterValues `json:"value"`
}

type exchange struct {
	Name       string `json:"name"`
	Vhost      string `json:"vhost"`
	Type       string `json:"type"`
	Durable    bool   `json:"durable"`
	AutoDelete bool   `json:"auto_delete"`
}

type permission struct {
	User      string `json:"user"`
	Vhost     string `json:"vhost"`
	Configure string `json:"configure"`
	Write     string `json:"write"`
	Read      string `json:"read"`
}

type user struct {
	Name     string `json:"name"`
	Password string `json:"password"`
	Tags     string `json:"tags"`
}

type vhost struct {
	Name string `json:"name"`
}

type arguments struct{}

type binding struct {
	Source          string    `json:"source"`
	Vhost           string    `json:"vhost"`
	Destination     string    `json:"destination"`
	DestinationType string    `json:"destination_type"`
	RoutingKey      string    `json:"routing_key"`
	Arguments       arguments `json:"arguments"`
}

type queue struct {
	Name       string    `json:"name"`
	Vhost      string    `json:"vhost"`
	Durable    bool      `json:"durable"`
	AutoDelete bool      `json:"auto_delete"`
	Arguments  arguments `json:"arguments"`
}

type policyDefinition struct {
	HAMode          string `json:"ha-mode"`
	HASyncMode      string `json:"ha-sync-mode"`
	HASyncBatchSize int    `json:"ha-sync-batch-size"`
}

type policy struct {
	Name       string           `json:"name"`
	Vhost      string           `json:"vhost"`
	Pattern    string           `json:"pattern"`
	Definition policyDefinition `json:"definition"`
}

type config struct {
	Users       []user       `json:"users"`
	Vhosts      []vhost      `json:"vhosts"`
	Parameters  []parameter  `json:"parameters"`
	Permissions []permission `json:"permissions"`
	Exchanges   []exchange   `json:"exchanges"`
	Bindings    []binding    `json:"bindings"`
	Queues      []queue      `json:"queues"`
	Policies    []policy     `json:"policies"`
}

func configuration(ctx *common.RenderContext) ([]runtime.Object, error) {
	scfg := config{
		Users: []user{
			{
				Name:     rabbitMQUsername,
				Password: passwordReplaceString, // This is replaced by an init container
				Tags:     "administrator",
			},
		},
		Vhosts: []vhost{
			{
				Name: "/",
			},
		},
		Parameters: []parameter{},
		Permissions: []permission{
			{
				User:      rabbitMQUsername,
				Vhost:     "/",
				Configure: ".*",
				Write:     ".*",
				Read:      ".*",
			},
		},
		Exchanges: []exchange{
			{
				Name:       "gitpod.ws.local",
				Vhost:      "/",
				Type:       "topic",
				Durable:    true,
				AutoDelete: false,
			},
			{
				Name:       "consensus-leader",
				Vhost:      "/",
				Type:       "fanout",
				Durable:    false,
				AutoDelete: false,
			},
		},
		Bindings: []binding{},
		Queues: []queue{
			{
				Name:       "consensus-peers",
				Vhost:      "/",
				Durable:    false,
				AutoDelete: false,
				Arguments:  arguments{},
			},
			{
				Name:       "pwsupdatable",
				Vhost:      "/",
				Durable:    true,
				AutoDelete: false,
				Arguments:  arguments{},
			},
		},
		Policies: []policy{
			{
				Name:    "ha-all",
				Vhost:   "/",
				Pattern: ".*",
				Definition: policyDefinition{
					HAMode:          "all",
					HASyncMode:      "automatic",
					HASyncBatchSize: 5,
				},
			},
		},
	}

	fc, err := json.Marshal(scfg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal messagebus config: %w", err)
	}

	secretName := "load-definition"

	return []runtime.Object{
		&corev1.Secret{
			TypeMeta: common.TypeMetaSecret,
			ObjectMeta: metav1.ObjectMeta{
				Name:      secretName,
				Namespace: ctx.Namespace,
				Labels: common.CustomizeLabel(ctx, secretName, common.TypeMetaSecret, func() map[string]string {
					return common.DefaultLabels(Component)
				}),
				Annotations: common.CustomizeAnnotation(ctx, secretName, common.TypeMetaSecret, func() map[string]string {
					return common.DefaultLabels(Component)
				}),
			},
			StringData: map[string]string{
				"load_definition.json": string(fc),
			},
		},
	}, nil
}
