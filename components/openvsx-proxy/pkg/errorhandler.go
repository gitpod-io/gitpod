// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package pkg

import (
	"net/http"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/sirupsen/logrus"
)

func (o *OpenVSXProxy) ErrorHandler(rw http.ResponseWriter, r *http.Request, e error) {
	reqid := r.Context().Value(REQUEST_ID_CTX).(string)
	key := r.Context().Value(REQUEST_CACHE_KEY_CTX).(string)

	logFields := logrus.Fields{
		LOG_FIELD_FUNC:       "error_handler",
		LOG_FIELD_REQUEST_ID: reqid,
		LOG_FIELD_REQUEST:    key,
		LOG_FIELD_STATUS:     "error",
	}

	start := time.Now()
	defer func(ts time.Time) {
		duration := time.Since(ts)
		o.metrics.DurationResponseProcessingHistogram.Observe(duration.Seconds())
		log.
			WithFields(logFields).
			WithFields(o.DurationLogFields(duration)).
			Info("processing error finished")
	}(start)

	log.WithFields(logFields).WithError(e).Warn("handling error")
	o.metrics.IncStatusCounter(r, "error")

	if key == "" {
		log.WithFields(logFields).Error("cache key header is missing")
		rw.WriteHeader(http.StatusBadGateway)
		return
	}

	cached, ok, err := o.ReadCache(key)
	if err != nil {
		log.WithFields(logFields).WithError(err).Error("cannot read from cache")
		rw.WriteHeader(http.StatusBadGateway)
		return
	}
	if !ok {
		log.WithFields(logFields).Debug("cache has no entry for key")
		rw.WriteHeader(http.StatusBadGateway)
		return
	}
	for k, v := range cached.Header {
		for i, val := range v {
			if i == 0 {
				rw.Header().Set(k, val)
			} else {
				rw.Header().Add(k, val)
			}
		}
	}
	if v := rw.Header().Get("Access-Control-Allow-Origin"); v != "" && v != "*" {
		rw.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
	}
	rw.WriteHeader(cached.StatusCode)
	rw.Write(cached.Body)
	log.WithFields(logFields).Info("used cached response due to a proxy error")
	o.metrics.BackupCacheServeCounter.Inc()
}
