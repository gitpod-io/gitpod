// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package pkg

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"
	"time"
	"unicode/utf8"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/sirupsen/logrus"
)

func (o *OpenVSXProxy) ModifyResponse(r *http.Response) error {
	reqid := r.Request.Context().Value(REQUEST_ID_CTX).(string)
	key, ok := r.Request.Context().Value(REQUEST_CACHE_KEY_CTX).(string)

	logFields := logrus.Fields{
		LOG_FIELD_FUNC:            "response_handler",
		LOG_FIELD_REQUEST_ID:      reqid,
		LOG_FIELD_REQUEST:         key,
		LOG_FIELD_STATUS:          strconv.Itoa(r.StatusCode),
		"response_content_length": r.Header.Get("Content-Length"),
	}

	start := time.Now()
	defer func(ts time.Time) {
		duration := time.Since(ts)
		o.metrics.DurationResponseProcessingHistogram.Observe(duration.Seconds())
		log.
			WithFields(logFields).
			WithFields(o.DurationLogFields(duration)).
			Info("processing response finished")
	}(start)

	log.WithFields(logFields).Debug("handling response")
	o.metrics.IncStatusCounter(r.Request, strconv.Itoa(r.StatusCode))

	if !ok {
		return nil
	}

	if key == "" {
		log.WithFields(logFields).Error("cache key header is missing - sending response as is")
		return nil
	}

	rawBody, err := ioutil.ReadAll(r.Body)
	if err != nil {
		log.WithFields(logFields).WithError(err).Error("error reading response raw body")
		return err
	}
	r.Body.Close()

	if r.StatusCode >= 500 || r.StatusCode == http.StatusTooManyRequests || r.StatusCode == http.StatusRequestTimeout {
		// use cache if exists
		bodyLogField := "(binary)"
		if utf8.Valid(rawBody) {
			bodyStr := string(rawBody)
			truncatedSuffix := ""
			if len(bodyStr) > 500 {
				truncatedSuffix = "... [truncated]"
			}
			bodyLogField = fmt.Sprintf("%.500s%s", bodyStr, truncatedSuffix)
		}
		log.
			WithFields(logFields).
			WithField("body", bodyLogField).
			Warn("error from upstream server - trying to use cached response")
		cached, ok, err := o.ReadCache(key)
		if err != nil {
			log.WithFields(logFields).WithError(err).Error("cannot read from cache")
			return nil
		}
		if !ok {
			log.WithFields(logFields).Debug("cache has no entry for key")
			return nil
		}
		r.Header = cached.Header
		if v := r.Header.Get("Access-Control-Allow-Origin"); v != "" && v != "*" {
			r.Header.Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
		}
		r.Body = ioutil.NopCloser(bytes.NewBuffer(cached.Body))
		r.ContentLength = int64(len(cached.Body))
		r.StatusCode = cached.StatusCode
		log.WithFields(logFields).Debug("used cache response due to an upstream error")
		o.metrics.BackupCacheServeCounter.Inc()
		return nil
	}

	// no error (status code < 500)
	cacheObj := &CacheObject{
		Header:     r.Header,
		Body:       rawBody,
		StatusCode: r.StatusCode,
	}
	err = o.StoreCache(key, cacheObj)
	if err != nil {
		log.WithFields(logFields).WithError(err).Error("error storing response to cache")
	} else {
		log.WithFields(logFields).Debug("successfully stored response to cache")
	}

	r.Body = ioutil.NopCloser(bytes.NewBuffer(rawBody))
	r.ContentLength = int64(len(rawBody))
	r.Header.Set("Content-Length", strconv.Itoa(len(rawBody)))
	return nil
}
