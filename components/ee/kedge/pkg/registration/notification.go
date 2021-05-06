// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package registration

import (
	"net/http"
	"strings"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
)

// ServiceNotifier tell the world about new services
type ServiceNotifier interface {
	// OnNewService is called when a new service was collected and installed
	OnNewService(name string)
}

// CompositeNotifier notifies many notifier
type CompositeNotifier []ServiceNotifier

// OnNewService is called when a new service was collected and installed
func (cn CompositeNotifier) OnNewService(name string) {
	for _, c := range cn {
		c.OnNewService(name)
	}
}

// HTTPServiceNotifier makes HTTP requests posting the name of newly discovered services
type HTTPServiceNotifier struct {
	URL    string
	Token  string
	Client *http.Client
}

// NewHTTPServiceNotifier creates a new notifier
func NewHTTPServiceNotifier(url, token string, timeout time.Duration) *HTTPServiceNotifier {
	return &HTTPServiceNotifier{
		URL:    url,
		Token:  token,
		Client: &http.Client{Timeout: timeout},
	}
}

// OnNewService is called when a new service was collected and installed
func (hn *HTTPServiceNotifier) OnNewService(name string) {
	req, err := http.NewRequest("POST", hn.URL, strings.NewReader(name))
	if err != nil {
		log.WithError(err).WithField("url", hn.URL).Error("cannot send new-service notification")
		return
	}
	if hn.Token != "" {
		req.SetBasicAuth("Bearer", hn.Token)
	}
	req.Header.Add("Content-Type", "text/plain")

	resp, err := hn.Client.Do(req)
	if err != nil {
		log.WithError(err).WithField("url", hn.URL).Error("cannot send new-service notification")
		return
	}
	if resp.StatusCode != http.StatusOK {
		log.WithField("statusCode", resp.StatusCode).WithField("url", hn.URL).Debug("received non-200 status code")
	}
}
