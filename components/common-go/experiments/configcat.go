// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package experiments

import (
	"context"
	"fmt"

	configcat "github.com/configcat/go-sdk/v7"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/sirupsen/logrus"
)

const (
	userIDAttribute         = "user_id"
	projectIDAttribute      = "project_id"
	teamIDAttribute         = "team_id"
	teamNameAttribute       = "team_name"
	vscodeClientIDAttribute = "vscode_client_id"
	gitpodHost              = "gitpod_host"
	component               = "component"
)

func newConfigCatClient(config configcat.Config) *configCatClient {
	return &configCatClient{
		client: configcat.NewCustomClient(config),
	}
}

var _ Client = (*configCatClient)(nil)

type configCatClient struct {
	client *configcat.Client
}

func (c *configCatClient) GetBoolValue(ctx context.Context, experimentName string, defaultValue bool, attributes Attributes) bool {
	value := c.client.GetBoolValue(experimentName, defaultValue, attributesToUser(attributes))
	log.AddFields(ctx, logField(experimentName, value))
	return value
}

func (c *configCatClient) GetIntValue(ctx context.Context, experimentName string, defaultValue int, attributes Attributes) int {
	value := c.client.GetIntValue(experimentName, defaultValue, attributesToUser(attributes))
	log.AddFields(ctx, logField(experimentName, value))
	return value
}

func (c *configCatClient) GetFloatValue(ctx context.Context, experimentName string, defaultValue float64, attributes Attributes) float64 {
	value := c.client.GetFloatValue(experimentName, defaultValue, attributesToUser(attributes))
	log.AddFields(ctx, logField(experimentName, value))
	return value
}

func (c *configCatClient) GetStringValue(ctx context.Context, experimentName string, defaultValue string, attributes Attributes) string {
	value := c.client.GetStringValue(experimentName, defaultValue, attributesToUser(attributes))
	log.AddFields(ctx, logField(experimentName, value))
	return value
}

func attributesToUser(attributes Attributes) *configcat.UserData {
	custom := make(map[string]string)

	if attributes.UserID != "" {
		custom[userIDAttribute] = attributes.UserID
	}

	if attributes.TeamID != "" {
		custom[teamIDAttribute] = attributes.TeamID
	}

	if attributes.TeamName != "" {
		custom[teamNameAttribute] = attributes.TeamName
	}

	if attributes.ProjectID != "" {
		custom[projectIDAttribute] = attributes.ProjectID
	}

	if attributes.VSCodeClientID != "" {
		custom[vscodeClientIDAttribute] = attributes.VSCodeClientID
	}

	if attributes.GitpodHost != "" {
		custom[gitpodHost] = attributes.GitpodHost
	}

	if attributes.Component != "" {
		custom[component] = attributes.Component
	}

	return &configcat.UserData{
		Identifier: attributes.UserID,
		Email:      attributes.UserEmail,
		Country:    "",
		Custom:     custom,
	}
}

type configCatLogger struct {
	*logrus.Entry
}

func (l *configCatLogger) GetLevel() configcat.LogLevel {
	return configcat.LogLevelError
}

func (l *configCatLogger) Debugf(format string, args ...interface{}) {}
func (l *configCatLogger) Infof(format string, args ...interface{})  {}
func (l *configCatLogger) Warnf(format string, args ...interface{})  {}

func logField(experimentName, value interface{}) logrus.Fields {
	return logrus.Fields{
		fmt.Sprintf("experiments.%s", experimentName): value,
	}
}
