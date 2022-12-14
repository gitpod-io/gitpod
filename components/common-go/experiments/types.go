// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package experiments

import (
	"context"
	"fmt"
	"os"
	"time"

	configcat "github.com/configcat/go-sdk/v7"
	"github.com/gitpod-io/gitpod/common-go/log"
)

type Client interface {
	GetBoolValue(ctx context.Context, experimentName string, defaultValue bool, attributes Attributes) bool
	GetIntValue(ctx context.Context, experimentName string, defaultValue int, attributes Attributes) int
	GetFloatValue(ctx context.Context, experimentName string, defaultValue float64, attributes Attributes) float64
	GetStringValue(ctx context.Context, experimentName string, defaultValue string, attributes Attributes) string
}

type Attributes struct {
	UserID    string
	UserEmail string
	ProjectID string
	TeamID    string
	TeamName  string

	// this is vscode header `x-market-client-id`
	VSCodeClientID string
}

// NewClient constructs a new experiments.Client. This is NOT A SINGLETON.
// You should normally only call this once in the lifecycle of an application, clients are independent of each other will refresh flags on their own.
// If the environment contains CONFIGCAT_SDK_KEY value, it vill be used to construct a ConfigCat client.
// Otherwise, it returns a client which always returns the default value. This client is used for Self-Hosted installations.
func NewClient() Client {
	gitpodHost := os.Getenv("GITPOD_HOST")
	if gitpodHost != "" {
		return newConfigCatClient(configcat.Config{
			SDKKey:       "gitpod",
			BaseURL:      fmt.Sprintf("%s%s", gitpodHost, "/configcat"),
			PollInterval: 1 * time.Minute,
			HTTPTimeout:  3 * time.Second,
		})
	}
	sdkKey := os.Getenv("CONFIGCAT_SDK_KEY")
	if sdkKey == "" {
		return NewAlwaysReturningDefaultValueClient()
	}
	return newConfigCatClient(configcat.Config{
		SDKKey:       sdkKey,
		PollInterval: 3 * time.Minute,
		HTTPTimeout:  3 * time.Second,
		Logger:       &configCatLogger{log.Log},
	})
}
