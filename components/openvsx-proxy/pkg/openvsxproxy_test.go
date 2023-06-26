// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package pkg

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"testing"
)

func createFrontend(backendURL string, isDisabledCache bool) (*httptest.Server, *OpenVSXProxy) {
	u, _ := url.Parse(backendURL)
	cfg := &Config{
		URLUpstream: backendURL,
	}
	if !isDisabledCache {
		cfg.AllowCacheDomain = []string{u.Host}
	}
	openVSXProxy := &OpenVSXProxy{Config: cfg}
	openVSXProxy.Setup()

	proxy := httputil.NewSingleHostReverseProxy(openVSXProxy.defaultUpstreamURL)
	proxy.ModifyResponse = openVSXProxy.ModifyResponse
	handler := http.HandlerFunc(openVSXProxy.Handler(proxy))
	frontend := httptest.NewServer(handler)
	return frontend, openVSXProxy
}

func TestAddResponseToCache(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		bodyBytes, _ := io.ReadAll(r.Body)
		rw.Header().Set("Content-Type", "application/json")
		rw.Write([]byte(fmt.Sprintf("Hello %s!", string(bodyBytes))))
	}))
	defer backend.Close()

	frontend, openVSXProxy := createFrontend(backend.URL, false)
	defer frontend.Close()

	frontendClient := frontend.Client()

	requestBody := backend.URL
	req, _ := http.NewRequest("POST", frontend.URL, bytes.NewBuffer([]byte(requestBody)))
	req.Close = true
	_, err := frontendClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	key := fmt.Sprintf("POST / %d %s", len(requestBody), openVSXProxy.hash([]byte(requestBody)))
	if _, err = openVSXProxy.cacheManager.Get(key); err != nil {
		t.Error(err)
	}
	if _, ok, err := openVSXProxy.ReadCache(key); ok == false || err != nil {
		t.Errorf("key not found or error: %v", err)
	}
}

func TestServeFromCacheOnUpstreamError(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		rw.WriteHeader(http.StatusInternalServerError)
	}))
	defer backend.Close()

	frontend, openVSXProxy := createFrontend(backend.URL, false)
	defer frontend.Close()

	requestBody := "Request Body Foo"
	key := fmt.Sprintf("POST / %d %s", len(requestBody), openVSXProxy.hash([]byte(requestBody)))

	expectedHeader := make(map[string][]string)
	expectedHeader["X-Test"] = []string{"Foo Bar"}
	expectedResponse := "Response Body Baz"
	expectedStatus := 200

	openVSXProxy.StoreCache(key, &CacheObject{
		Header:     expectedHeader,
		Body:       []byte(expectedResponse),
		StatusCode: expectedStatus,
	})

	frontendClient := frontend.Client()

	req, _ := http.NewRequest("POST", frontend.URL, bytes.NewBuffer([]byte(requestBody)))
	req.Close = true
	res, err := frontendClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}

	if res.StatusCode != expectedStatus {
		t.Errorf("got status %d; expected %d", res.StatusCode, expectedStatus)
	}
	if bodyBytes, _ := io.ReadAll(res.Body); string(bodyBytes) != expectedResponse {
		t.Errorf("got body '%s'; expected '%s'", string(bodyBytes), expectedResponse)
	}
	if h := res.Header.Get("X-Test"); h != "Foo Bar" {
		t.Errorf("got header '%s'; expected '%s'", h, "Foo Bar")
	}
}

func TestServeFromNonCacheOnUpstreamError(t *testing.T) {
	backend := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
		rw.WriteHeader(http.StatusInternalServerError)
	}))
	defer backend.Close()

	frontend, openVSXProxy := createFrontend(backend.URL, true)
	defer frontend.Close()

	requestBody := "Request Body Foo"
	key := fmt.Sprintf("POST / %d %s", len(requestBody), openVSXProxy.hash([]byte(requestBody)))

	expectedHeader := make(map[string][]string)
	expectedResponse := ""
	expectedStatus := 500

	openVSXProxy.StoreCache(key, &CacheObject{
		Header:     expectedHeader,
		Body:       []byte(expectedResponse),
		StatusCode: expectedStatus,
	})

	frontendClient := frontend.Client()

	req, _ := http.NewRequest("POST", frontend.URL, bytes.NewBuffer([]byte(requestBody)))
	req.Close = true
	res, err := frontendClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}

	if res.StatusCode != expectedStatus {
		t.Errorf("got status %d; expected %d", res.StatusCode, expectedStatus)
	}
	if bodyBytes, _ := io.ReadAll(res.Body); string(bodyBytes) != expectedResponse {
		t.Errorf("got body '%s'; expected '%s'", string(bodyBytes), expectedResponse)
	}
}
