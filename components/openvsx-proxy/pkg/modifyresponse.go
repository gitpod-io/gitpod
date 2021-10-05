// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package pkg

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/sirupsen/logrus"
)

func (o *OpenVSXProxy) ModifyResponse(r *http.Response) error {
	reqid := r.Request.Context().Value(REQUEST_ID_CTX).(string)
	key := r.Request.Context().Value(REQUEST_CACHE_KEY_CTX).(string)

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

	log.WithFields(logFields).Info("handling response")
	o.metrics.IncStatusCounter(r.Request, strconv.Itoa(r.StatusCode))

	if key == "" {
		log.WithFields(logFields).Error("cache key header is missing - sending response as is")
		return nil
	}

	body, err := ioutil.ReadAll(r.Body)
	if err != nil {
		log.WithFields(logFields).WithError(err).Error("error reading response body")
		return err
	}
	r.Body.Close()
	r.Body = ioutil.NopCloser(bytes.NewBuffer(body))

	if r.StatusCode >= 500 || r.StatusCode == http.StatusTooManyRequests || r.StatusCode == http.StatusRequestTimeout {
		// use cache if exists
		bodyLogField := "(binary)"
		if utf8.Valid(body) {
			bodyStr := string(body)
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
		r.Body = ioutil.NopCloser(bytes.NewBuffer(cached.Body))
		r.ContentLength = int64(len(cached.Body))
		r.StatusCode = cached.StatusCode
		log.WithFields(logFields).Info("used cache response due to an upstream error")
		o.metrics.BackupCacheServeCounter.Inc()
		return nil
	}

	// no error (status code < 500)
	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "application/json") {
		if log.Log.Level >= logrus.DebugLevel {
			log.WithFields(logFields).Debugf("replacing %d occurence(s) of '%s' in response body ...", strings.Count(string(body), o.Config.URLUpstream), o.Config.URLUpstream)
		}
		bodyStr := strings.ReplaceAll(string(body), o.Config.URLUpstream, o.Config.URLLocal)
		body = []byte(bodyStr)
	} else {
		log.WithFields(logFields).Debugf("response is not JSON but '%s', skipping replacing '%s' in response body", contentType, o.Config.URLUpstream)
	}

	cacheObj := &CacheObject{
		Header:     r.Header,
		Body:       body,
		StatusCode: r.StatusCode,
	}
	err = o.StoreCache(key, cacheObj)
	if err != nil {
		log.WithFields(logFields).WithError(err).Error("error storing response to cache")
	} else {
		log.WithFields(logFields).Info("successfully stored response to cache")
	}

	r.Body = ioutil.NopCloser(bytes.NewBuffer(body))
	r.ContentLength = int64(len(body))
	r.Header.Set("Content-Length", strconv.Itoa(len(body)))
	return nil
}
