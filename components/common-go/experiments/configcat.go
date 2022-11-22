// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package experiments

import (
	"context"
	"time"

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
)

func newConfigCatClient(sdkKey string) *configCatClient {
	return &configCatClient{
		client: configcat.NewCustomClient(configcat.Config{
			SDKKey:       sdkKey,
			PollInterval: 3 * time.Minute,
			HTTPTimeout:  3 * time.Second,
			Logger:       &configCatLogger{log.Log},
		}),
	}
}

var _ Client = (*configCatClient)(nil)

type configCatClient struct {
	client *configcat.Client
}

func (c *configCatClient) GetBoolValue(_ context.Context, experimentName string, defaultValue bool, attributes Attributes) bool {
	return c.client.GetBoolValue(experimentName, defaultValue, attributesToUser(attributes))
}

func (c *configCatClient) GetIntValue(_ context.Context, experimentName string, defaultValue int, attributes Attributes) int {
	return c.client.GetIntValue(experimentName, defaultValue, attributesToUser(attributes))
}

func (c *configCatClient) GetFloatValue(_ context.Context, experimentName string, defaultValue float64, attributes Attributes) float64 {
	return c.client.GetFloatValue(experimentName, defaultValue, attributesToUser(attributes))
}

func (c *configCatClient) GetStringValue(_ context.Context, experimentName string, defaultValue string, attributes Attributes) string {
	return c.client.GetStringValue(experimentName, defaultValue, attributesToUser(attributes))
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
	return l.Level
}
