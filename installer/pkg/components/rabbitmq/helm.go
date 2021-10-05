// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package rabbitmq

import (
	"encoding/json"
	"github.com/gitpod-io/gitpod/installer/pkg/common"
	"github.com/gitpod-io/gitpod/installer/pkg/helm"
	"github.com/gitpod-io/gitpod/installer/third_party/charts"
	"helm.sh/helm/v3/pkg/cli/values"
	"strings"
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

func generateParameters(username string, password string, input []parameter) ([]parameter, error) {
	var params []parameter

	for _, item := range input {
		// Sort out default values
		if item.Name == "" {
			name, err := common.RandomString(20)
			if err != nil {
				return nil, err
			}
			item.Name = name
		}
		if item.Values.SrcExchange == "" {
			item.Values.SrcExchange = "gitpod.ws.local"
		}
		if item.Values.SrcExchangeKey == "" {
			item.Values.SrcExchangeKey = "#"
		}
		if item.Values.DestExchange == "" {
			item.Values.DestExchange = "gitpod.ws"
		}
		if item.Values.DestUri == "" {
			item.Values.DestUri = "amqp://"
		}

		srcUri := strings.Replace(item.Values.SrcUri, "$USERNAME", username, -1)
		srcUri = strings.Replace(srcUri, "$PASSWORD", password, -1)

		params = append(params, parameter{
			Name:      item.Name,
			Vhost:     "/",
			Component: "shovel",
			Values: parameterValues{
				AckMode:               "on-publish",
				SrcDeleteAfter:        "never",
				SrcExchange:           item.Values.SrcExchange,
				SrcExchangeKey:        item.Values.SrcExchangeKey,
				SrcProtocol:           "amqp091",
				SrcUri:                srcUri,
				DestAddForwardHeaders: item.Values.DestAddForwardHeaders,
				DestExchange:          item.Values.DestExchange,
				DestProtocol:          "amqp091",
				DestUri:               item.Values.DestUri,
				ReconnectDelay:        item.Values.ReconnectDelay,
			},
		})
	}
	return params, nil
}

var Helm = common.CompositeHelmFunc(
	helm.ImportTemplate(charts.RabbitMQ(), helm.TemplateConfig{}, func(cfg *common.RenderContext) (*common.HelmConfig, error) {
		username, err := common.RandomString(20)
		if err != nil {
			return nil, err
		}

		password, err := common.RandomString(20)
		if err != nil {
			return nil, err
		}

		parameters, err := generateParameters(username, password, []parameter{})
		if err != nil {
			return nil, err
		}

		loadDefinition, err := json.Marshal(config{
			Users: []user{{
				Name:     username,
				Password: password,
				Tags:     "administrator",
			}},
			Vhosts:     []vhost{{Name: "/"}},
			Parameters: parameters,
			Permissions: []permission{{
				User:      username,
				Vhost:     "/",
				Configure: ".*",
				Write:     ".*",
				Read:      ".*",
			}},
			Exchanges: []exchange{{
				Name:       "gitpod.ws",
				Vhost:      "/",
				Type:       "topic",
				Durable:    true,
				AutoDelete: false,
			}, {
				Name:       "gitpod.ws.local",
				Vhost:      "/",
				Type:       "topic",
				Durable:    true,
				AutoDelete: false,
			}, {
				Name:       "wsman",
				Vhost:      "/",
				Type:       "topic",
				Durable:    false,
				AutoDelete: false,
			}, {
				Name:       "consensus-leader",
				Vhost:      "/",
				Type:       "fanout",
				Durable:    false,
				AutoDelete: false,
			}},
			Bindings: []binding{{
				Source:          "gitpod.ws.local",
				Vhost:           "/",
				Destination:     "gitpod.ws",
				DestinationType: "exchange",
				RoutingKey:      "#",
				Arguments:       arguments{},
			}},
			Queues: []queue{{
				Name:       "consensus-peers",
				Vhost:      "/",
				Durable:    false,
				AutoDelete: false,
				Arguments:  arguments{},
			}, {
				Name:       "pwsupdatable",
				Vhost:      "/",
				Durable:    true,
				AutoDelete: false,
				Arguments:  arguments{},
			}},
			Policies: []policy{{
				Name:    "ha-all",
				Vhost:   "/",
				Pattern: ".*",
				Definition: policyDefinition{
					HAMode:          "all",
					HASyncMode:      "automatic",
					HASyncBatchSize: 5,
				},
			}},
		})
		if err != nil {
			return nil, err
		}

		loadDefinitionFilename, err := helm.KeyFileValue("rabbitmq.extraSecrets.load-definition.load_definition\\.json", loadDefinition)
		if err != nil {
			return nil, err
		}

		return &common.HelmConfig{
			Enabled: *cfg.Config.MessageQueue.InCluster,
			Values: &values.Options{
				Values: []string{
					helm.KeyValue("rabbitmq.auth.username", username),
					helm.KeyValue("rabbitmq.auth.password", password),
					helm.KeyValue("rabbitmq.auth.existingErlangSecret", CookieSecret),
					helm.KeyValue("rabbitmq.auth.tls.existingSecret", TLSSecret),
				},
				// This is too complex to be sent as a string
				FileValues: []string{
					loadDefinitionFilename,
				},
			},
		}, nil
	}),
)
