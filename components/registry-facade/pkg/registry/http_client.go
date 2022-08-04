// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package registry

import (
	"net/http"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/hashicorp/go-retryablehttp"
)

type Option func(opts *httpOpts)

func NewRetryableHTTPClient(options ...Option) *http.Client {
	opts := defaultOptions()
	for _, o := range options {
		o(&opts)
	}

	client := retryablehttp.NewClient()
	client.RetryMax = opts.RetryMax
	client.Logger = opts.Logger
	client.RequestLogHook = opts.RequestLogHook
	client.ResponseLogHook = opts.ResponseLogHook

	if opts.HTTPClient != nil {
		client.HTTPClient = opts.HTTPClient
	}

	return client.StandardClient()
}

func defaultOptions() httpOpts {
	return httpOpts{
		RetryMax: 5,
		Logger:   log.Log,

		RequestLogHook: func(logger retryablehttp.Logger, req *http.Request, attempt int) {
			if attempt > 0 {
				log.Warnf("%v %v request failed. Retry count: %v", req.Method, req.URL, attempt)
			}
		},
	}
}

type httpOpts struct {
	HTTPClient *http.Client
	Logger     interface{}

	RetryMax int

	RequestLogHook retryablehttp.RequestLogHook

	ResponseLogHook retryablehttp.ResponseLogHook
}

// WithRequestLogHook can be used to configure a custom request log hook.
func WithRequestLogHook(hook retryablehttp.RequestLogHook) Option {
	return func(opts *httpOpts) {
		opts.RequestLogHook = hook
	}
}

// WithResponseLogHook can be used to configure a custom response log hook.
func WithResponseLogHook(hook retryablehttp.ResponseLogHook) Option {
	return func(opts *httpOpts) {
		opts.ResponseLogHook = hook
	}
}

// WithRetryMax can be used to configure a custom number of retries.
func WithRetryMax(retryMax int) Option {
	return func(opts *httpOpts) {
		opts.RetryMax = retryMax
	}
}

func WithHTTPClient(client *http.Client) Option {
	return func(opts *httpOpts) {
		opts.HTTPClient = client
	}
}
