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
	"github.com/sirupsen/logrus"
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

	GitpodHost string

	// Component is using in components/service-waiter
	// Feature Flag key is `service_waiter_skip_component`
	Component string
}

type ClientOpt func(o *options)

func WithGitpodProxy(gitpodHost string) ClientOpt {
	return func(o *options) {
		o.sdkKey = "gitpod"
		o.baseURL = fmt.Sprintf("https://%s/configcat", gitpodHost)
		o.pollInterval = 1 * time.Minute
	}
}

func WithPollInterval(interval time.Duration) ClientOpt {
	return func(o *options) {
		o.pollInterval = interval
	}
}

func WithDefaultClient(defaultClient Client) ClientOpt {
	return func(o *options) {
		o.defaultClient = defaultClient
		o.hasDefaultClient = true
	}
}

type options struct {
	pollInterval     time.Duration
	baseURL          string
	sdkKey           string
	defaultClient    Client
	hasDefaultClient bool
}

// NewClient constructs a new experiments.Client. This is NOT A SINGLETON.
// You should normally only call this once in the lifecycle of an application, clients are independent of each other will refresh flags on their own.
// If the environment contains CONFIGCAT_SDK_KEY value, it will be used to construct a ConfigCat client.
// Otherwise, it returns a client which always returns the default value. This client is used for Self-Hosted installations.
func NewClient(opts ...ClientOpt) Client {
	opt := &options{
		sdkKey:       os.Getenv("CONFIGCAT_SDK_KEY"),
		baseURL:      os.Getenv("CONFIGCAT_BASE_URL"),
		pollInterval: 3 * time.Minute,
	}
	for _, o := range opts {
		o(opt)
	}

	if opt.sdkKey == "" {
		if opt.hasDefaultClient {
			return opt.defaultClient
		}
		return NewAlwaysReturningDefaultValueClient()
	}
	logger := log.Log.Dup()
	logger.Level = logrus.ErrorLevel
	return newConfigCatClient(configcat.Config{
		SDKKey:       opt.sdkKey,
		BaseURL:      opt.baseURL,
		PollInterval: opt.pollInterval,
		HTTPTimeout:  3 * time.Second,
		Logger:       &configCatLogger{logger},
	})
}
