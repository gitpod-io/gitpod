// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package pkg

import (
	"context"
	"fmt"
	"math/rand"
	"net/http"
	"net/http/httputil"
	"strconv"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

func (o *OpenVSXProxy) Handler(p *httputil.ReverseProxy) func(http.ResponseWriter, *http.Request) {
	return func(rw http.ResponseWriter, r *http.Request) {
		start := time.Now()

		var (
			hitCacheRegular = false
			hitCacheBackup  = false
		)

		reqid := ""
		uuid, err := uuid.NewRandom()
		if err != nil {
			log.WithError(err).Warn("cannot generate a UUID")
			reqid = fmt.Sprintf("req%d", rand.Intn(999999))
		} else {
			reqid = uuid.String()
		}

		logFields := logrus.Fields{
			LOG_FIELD_FUNC:           "request_handler",
			LOG_FIELD_REQUEST_ID:     reqid,
			LOG_FIELD_REQUEST:        fmt.Sprintf("%s %s", r.Method, r.URL),
			"request_content_length": strconv.FormatInt(r.ContentLength, 10),
		}

		log.WithFields(logFields).Info("handling request")
		r = r.WithContext(context.WithValue(r.Context(), REQUEST_ID_CTX, reqid))

		key, err := o.key(r)
		if err != nil {
			log.WithFields(logFields).WithError(err).Error("cannot create cache key")
			r.Host = o.upstreamURL.Host
			p.ServeHTTP(rw, r)
			o.finishLog(logFields, start, hitCacheRegular, hitCacheBackup)
			o.metrics.DurationRequestProcessingHistogram.Observe(time.Since(start).Seconds())
			return
		}
		r = r.WithContext(context.WithValue(r.Context(), REQUEST_CACHE_KEY_CTX, key))
		logFields[LOG_FIELD_REQUEST] = key

		if o.Config.CacheDurationRegular > 0 {
			cached, ok, err := o.ReadCache(key)
			if err != nil {
				log.WithFields(logFields).WithError(err).Error("cannot read from cache")
			} else if !ok {
				log.WithFields(logFields).Debug("cache has no entry for key")
			} else {
				hitCacheBackup = true
				dateHeader := cached.Header.Get("Date")
				log.WithFields(logFields).Debugf("there is a cached value with date: %s", dateHeader)
				t, err := time.Parse("Mon, _2 Jan 2006 15:04:05 MST", dateHeader)
				if err != nil {
					log.WithFields(logFields).WithError(err).Warn("cannot parse date header of cached value")
				} else {
					minDate := time.Now().Add(-time.Duration(o.Config.CacheDurationRegular))
					if t.After(minDate) {
						hitCacheRegular = true
						log.WithFields(logFields).Debugf("cached value is younger than %s - using cached value", o.Config.CacheDurationRegular)
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
						rw.Header().Set("X-Cache", "HIT")
						rw.WriteHeader(cached.StatusCode)
						rw.Write(cached.Body)
						o.finishLog(logFields, start, hitCacheRegular, hitCacheBackup)
						o.metrics.DurationRequestProcessingHistogram.Observe(time.Since(start).Seconds())
						return
					} else {
						log.WithFields(logFields).Debugf("cached value is older than %s - ignoring cached value", o.Config.CacheDurationRegular)
					}
				}
			}
		}

		duration := time.Since(start)
		log.WithFields(logFields).WithFields(o.DurationLogFields(duration)).Info("processing request finished")
		o.metrics.DurationRequestProcessingHistogram.Observe(duration.Seconds())

		r.Host = o.upstreamURL.Host
		p.ServeHTTP(rw, r)
		o.finishLog(logFields, start, hitCacheRegular, hitCacheBackup)
	}
}

func (o *OpenVSXProxy) finishLog(logFields logrus.Fields, start time.Time, hitCacheRegular, hitCacheBackup bool) {
	duration := time.Since(start)
	o.metrics.DurationOverallHistogram.Observe(duration.Seconds())
	if hitCacheBackup {
		o.metrics.BackupCacheHitCounter.Inc()
	} else {
		o.metrics.BackupCacheMissCounter.Inc()
	}
	if hitCacheRegular {
		o.metrics.RegularCacheHitServeCounter.Inc()
	} else {
		o.metrics.RegularCacheMissCounter.Inc()
	}
	log.
		WithFields(logFields).
		WithFields(o.DurationLogFields(duration)).
		WithField("hit_cache_regular", hitCacheRegular).
		WithField("hit_cache_backup", hitCacheBackup).
		Info("request finished")
}
