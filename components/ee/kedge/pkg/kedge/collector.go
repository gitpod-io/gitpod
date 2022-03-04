// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package kedge

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"golang.org/x/xerrors"
	"k8s.io/client-go/kubernetes"
)

// Collect attempts to retrieve a service list from another kedge instance
func Collect(url, token string) ([]Service, error) {
	var client = &http.Client{
		Timeout: time.Second * 10,
	}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, xerrors.Errorf("cannot create new HTTP request: %w", err)
	}
	// req.SetBasicAuth("Bearer", token)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	response, err := client.Do(req)
	if err != nil {
		return nil, xerrors.Errorf("unable to make request: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, xerrors.Errorf("HTTP request returned non-OK status: %s", response.Status)
	}

	var result []Service
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		return nil, xerrors.Errorf("cannot unmarshal response: %w", err)
	}
	return result, nil
}

// Collector can collect service info from another kedge instance and install it in a Kubernetes cluster
type Collector struct {
	Name   string `json:"name"`
	URL    string `json:"url"`
	Prefix string `json:"prefix,omitempty"`
	Suffix string `json:"suffix,omitempty"`
	Token  string `json:"token"`
}

// ErrCollectionFailed is returned by CollectAndInstall if the collection part failed
type ErrCollectionFailed struct {
	Err error
	URL string
}

// Unwrap returns the underlying error
func (e *ErrCollectionFailed) Unwrap() error {
	return e.Err
}

func (e *ErrCollectionFailed) Error() string {
	return fmt.Sprintf("cannot collect from %s: %s", e.URL, e.Err.Error())
}

// CollectAndInstall collects kedge service information and installs that in a cluster
func (c *Collector) CollectAndInstall(clientset kubernetes.Interface, namespace string) (newServices []string, err error) {
	services, err := Collect(c.URL, c.Token)
	if err != nil {
		return nil, &ErrCollectionFailed{err, c.URL}
	}

	return Install(clientset, namespace, c.Name, services, DefaultNamer(c.Prefix, c.Suffix))
}

// Namer decides on a service name in the new cluster
type Namer func(serviceName string) (newName string)

// DefaultNamer prepends prefix (if not empty) and appends the suffix (if not empty)
func DefaultNamer(prefix, suffix string) Namer {
	return func(sn string) string {
		segments := []string{}
		if prefix != "" {
			segments = append(segments, prefix)
		}
		segments = append(segments, sn)
		if suffix != "" {
			segments = append(segments, suffix)
		}
		return strings.Join(segments, "-")
	}
}
