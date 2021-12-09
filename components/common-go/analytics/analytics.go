// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package analytics

import (
	"os"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
	segment "gopkg.in/segmentio/analytics-go.v3"
)

// Identity identifies a user
type Identity struct {
	UserID      string
	AnonymousID string
}

// IdentifyMessage parametrises the Identify call
type IdentifyMessage struct {
	Identity

	Traits    map[string]interface{}
	Timestamp time.Time
}

// TrackMessage parametrises the Track call
type TrackMessage struct {
	Identity

	Event      string
	Properties map[string]interface{}
	Timestamp  time.Time
}

// NewFromEnvironment creates a new analytics writer based on the GITPOD_ANALYTICS_WRITER
// environment variable. This function never returns nil and callers are expected to call
// Close() on the received writer.
func NewFromEnvironment() Writer {
	switch os.Getenv("GITPOD_ANALYTICS_WRITER") {
	case "log":
		return &logAnalyticsWriter{}
	case "segment":
		return &segmentAnalyticsWriter{Client: segment.New(os.Getenv("GITPOD_ANALYTICS_SEGMENT_KEY"))}
	default:
		return &noAnalyticsWriter{}
	}
}

// Writer can write analytics
type Writer interface {
	Identify(IdentifyMessage)
	Track(TrackMessage)
	Close() error
}

type logAnalyticsWriter struct{}

func (s *logAnalyticsWriter) Identify(m IdentifyMessage) {
	log.WithField("message", m).Debug("analytics identify")
}

func (s *logAnalyticsWriter) Track(m TrackMessage) {
	log.WithField("message", m).Debug("analytics track")
}

func (s *logAnalyticsWriter) Close() error { return nil }

type noAnalyticsWriter struct{}

func (s *noAnalyticsWriter) Identify(m IdentifyMessage) {}
func (s *noAnalyticsWriter) Track(m TrackMessage)       {}
func (s *noAnalyticsWriter) Close() error               { return nil }

type segmentAnalyticsWriter struct {
	Client segment.Client
}

func (s *segmentAnalyticsWriter) Identify(m IdentifyMessage) {
	defer recover()

	err := s.Client.Enqueue(segment.Identify{
		AnonymousId: m.AnonymousID,
		UserId:      m.UserID,
		Timestamp:   m.Timestamp,
		Traits:      m.Traits,
	})
	if err != nil {
		log.WithError(err).Warn("analytics: identity failed")
	}
}

func (s *segmentAnalyticsWriter) Track(m TrackMessage) {
	defer recover()

	err := s.Client.Enqueue(segment.Track{
		AnonymousId: m.AnonymousID,
		UserId:      m.UserID,
		Event:       m.Event,
		Timestamp:   m.Timestamp,
		Properties:  m.Properties,
	})
	if err != nil {
		log.WithError(err).Warn("analytics: track failed")
	}
}

func (s *segmentAnalyticsWriter) Close() error {
	defer recover()

	return s.Client.Close()
}
