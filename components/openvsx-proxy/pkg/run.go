// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package pkg

import (
	"context"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/eko/gocache/cache"
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
)

const (
	REQUEST_CACHE_KEY_CTX = "gitpod-cache-key"
	REQUEST_ID_CTX        = "gitpod-request-id"
	LOG_FIELD_REQUEST_ID  = "request_id"
	LOG_FIELD_REQUEST     = "request"
	LOG_FIELD_FUNC        = "func"
	LOG_FIELD_STATUS      = "status"
)

type OpenVSXProxy struct {
	Config       *Config
	upstreamURL  *url.URL
	cacheManager *cache.Cache
	metrics      *Prometheus
}

func (o *OpenVSXProxy) Setup() error {
	o.metrics = &Prometheus{}
	o.metrics.Start(o.Config)

	err := o.SetupCache()
	if err != nil {
		return xerrors.Errorf("error setting up cache: %v", err)
	}

	o.upstreamURL, err = url.Parse(o.Config.URLUpstream)
	if err != nil {
		return xerrors.Errorf("error parsing upstream URL: %v", err)
	}

	http.DefaultTransport.(*http.Transport).MaxIdleConns = o.Config.MaxIdleConns
	http.DefaultTransport.(*http.Transport).MaxIdleConnsPerHost = o.Config.MaxIdleConnsPerHost
	return nil
}

func (o *OpenVSXProxy) Start() (shutdown func(context.Context) error, err error) {
	if o.upstreamURL == nil {
		if err := o.Setup(); err != nil {
			return nil, err
		}
	}
	proxy := newSingleHostReverseProxy(o.upstreamURL)
	proxy.ErrorHandler = o.ErrorHandler
	proxy.ModifyResponse = o.ModifyResponse
	proxy.Transport = &DurationTrackingTransport{o: o}

	http.HandleFunc("/", o.Handler(proxy))
	http.HandleFunc("/openvsx-proxy-status", func(rw http.ResponseWriter, r *http.Request) {
		if _, _, err := o.ReadCache("does-not-exist"); err != nil {
			log.WithError(err).Debug("status not ready")
			rw.WriteHeader(http.StatusInternalServerError)
			rw.Write([]byte(err.Error()))
			return
		}
		rw.WriteHeader(http.StatusOK)
		rw.Write([]byte("ok"))
	})

	srv := &http.Server{Addr: ":8080"}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.WithError(err).Panic("error starting HTTP server")
		}
	}()
	return func(c context.Context) error {
		return srv.Shutdown(c)
	}, nil
}

type DurationTrackingTransport struct {
	o *OpenVSXProxy
}

func (t *DurationTrackingTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	reqid := r.Context().Value(REQUEST_ID_CTX).(string)
	key := r.Context().Value(REQUEST_CACHE_KEY_CTX).(string)

	logFields := logrus.Fields{
		LOG_FIELD_FUNC:       "transport_roundtrip",
		LOG_FIELD_REQUEST_ID: reqid,
		LOG_FIELD_REQUEST:    key,
	}

	start := time.Now()
	defer func(ts time.Time) {
		duration := time.Since(ts)
		t.o.metrics.DurationUpstreamCallHistorgram.Observe(duration.Seconds())
		log.
			WithFields(logFields).
			WithFields(t.o.DurationLogFields(duration)).
			Info("upstream call finished")
	}(start)
	return http.DefaultTransport.RoundTrip(r)
}

// From go/src/net/http/httputil/reverseproxy.go

func singleJoiningSlash(a, b string) string {
	aslash := strings.HasSuffix(a, "/")
	bslash := strings.HasPrefix(b, "/")
	switch {
	case aslash && bslash:
		return a + b[1:]
	case !aslash && !bslash:
		return a + "/" + b
	}
	return a + b
}

func joinURLPath(a, b *url.URL) (path, rawpath string) {
	if a.RawPath == "" && b.RawPath == "" {
		return singleJoiningSlash(a.Path, b.Path), ""
	}
	// Same as singleJoiningSlash, but uses EscapedPath to determine
	// whether a slash should be added
	apath := a.EscapedPath()
	bpath := b.EscapedPath()

	aslash := strings.HasSuffix(apath, "/")
	bslash := strings.HasPrefix(bpath, "/")

	switch {
	case aslash && bslash:
		return a.Path + b.Path[1:], apath + bpath[1:]
	case !aslash && !bslash:
		return a.Path + "/" + b.Path, apath + "/" + bpath
	}
	return a.Path + b.Path, apath + bpath
}

func newSingleHostReverseProxy(target *url.URL) *httputil.ReverseProxy {
	targetQuery := target.RawQuery
	director := func(req *http.Request) {
		// originalHost := req.Host

		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host
		req.URL.Path, req.URL.RawPath = joinURLPath(target, req.URL)
		if targetQuery == "" || req.URL.RawQuery == "" {
			req.URL.RawQuery = targetQuery + req.URL.RawQuery
		} else {
			req.URL.RawQuery = targetQuery + "&" + req.URL.RawQuery
		}
		req.Host = target.Host

		if _, ok := req.Header["User-Agent"]; !ok {
			// explicitly disable User-Agent so it's not set to default value
			req.Header.Set("User-Agent", "")
		}

		// req.Header.Del("X-Forwarded-For")
		// req.Header.Set("X-Forwarded-Host", originalHost)
		// if req.TLS == nil {
		// 	req.Header.Set("X-Forwarded-Proto", "http")
		// } else {
		// 	req.Header.Set("X-Forwarded-Proto", "https")
		// }
	}
	return &httputil.ReverseProxy{Director: director}
}
