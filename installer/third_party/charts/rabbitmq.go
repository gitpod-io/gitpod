// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package charts

import (
	_ "embed"
)

// Imported from https://github.com/bitnami/charts/tree/master/bitnami/rabbitmq

//go:embed rabbitmq/Chart.yaml
var rabbitMQChart []byte

//go:embed rabbitmq/values.yaml
var rabbitMQValues []byte

func RabbitMQ() *Chart {
	return &Chart{
		Name:   "RabbitMQ",
		Chart:  rabbitMQChart,
		Values: rabbitMQValues,
	}
}
