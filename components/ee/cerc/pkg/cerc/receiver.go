// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package cerc

import (
	"golang.org/x/xerrors"
	"net/http"
	"time"
)

// Receiver implements http.Handler and serves as Cerc endpoint. Prior to responding to an incoming
// cerc request it calls Responder(). If Responder() returns a non-nil result, we return a non-200
// status code in response to the cerc request. Responder() is expected to trigger a request to url
// passing the token as Bearer basic auth.
//
// If Responder is nil, we'll answer the cerc request ourselves.
type Receiver struct {
	Responder func(url, tkn string) error
}

func (r *Receiver) ServeHTTP(resp http.ResponseWriter, req *http.Request) {
	tkn := req.Header.Get(HeaderToken)
	url := req.Header.Get(HeaderURL)

	if tkn == "" {
		resp.WriteHeader(http.StatusUnauthorized)
		return
	}
	if url == "" {
		resp.WriteHeader(http.StatusPreconditionFailed)
		return
	}

	responder := r.Responder
	if responder == nil {
		responder = defaultResponder
	}

	err := responder(url, tkn)
	if err != nil {
		resp.WriteHeader(http.StatusInternalServerError)
		resp.Write([]byte(err.Error()))
	}

	resp.WriteHeader(http.StatusOK)
}

func defaultResponder(url, tkn string) error {
	req, err := http.NewRequest("POST", url, nil)
	req.SetBasicAuth("Bearer", tkn)

	client := http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	if resp.StatusCode != http.StatusOK {
		return xerrors.Errorf("Cerc response endpoint returned non-200 status (%d)", resp.StatusCode)
	}
	return nil
}
