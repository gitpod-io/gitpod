// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package classifier

import (
	"errors"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/common"
	"github.com/gitpod-io/gitpod/common-go/log"
	lru "github.com/hashicorp/golang-lru"
	"github.com/minio/highwayhash"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
)

const (
	ClassifierCommandline string = "commandline"
	ClassifierComposite   string = "composite"
	ClassifierSignature   string = "signature"
	ClassifierGraded      string = "graded"
)

type Classification struct {
	Level      Level
	Classifier string
	Message    string
}

type Level string

const (
	LevelNoMatch Level = "no-match"
	LevelBarely  Level = Level(common.SeverityBarely)
	LevelAudit   Level = Level(common.SeverityAudit)
	LevelVery    Level = Level(common.SeverityVery)
)

// ProcessClassifier matches a process against a set of criteria
type ProcessClassifier interface {
	prometheus.Collector

	Matches(executable string, cmdline []string) (*Classification, error)
}

func NewCommandlineClassifier(name string, level Level, allowList []string, blockList []string) (*CommandlineClassifier, error) {
	al := make([]*regexp.Regexp, 0, len(allowList))
	for _, a := range allowList {
		r, err := regexp.Compile(a)
		if err != nil {
			return nil, fmt.Errorf("cannot compile %s: %w", a, err)
		}
		al = append(al, r)
	}

	return &CommandlineClassifier{
		DefaultLevel: level,
		AllowList:    al,
		BlockList:    blockList,

		allowListHitTotal: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: "gitpod_agent_smith",
			Subsystem: "classifier_commandline",
			Name:      "allowlist_hit_total",
			Help:      "total count of allowlist hits",
			ConstLabels: prometheus.Labels{
				"classifier_name": name,
			},
		}),
		blocklistHitTotal: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: "gitpod_agent_smith",
			Subsystem: "classifier_commandline",
			Name:      "blocklist_hit_total",
			Help:      "total count of blocklist hits",
			ConstLabels: prometheus.Labels{
				"classifier_name": name,
			},
		}),
	}, nil
}

// CommandlineClassifier looks at the commandline of a process
type CommandlineClassifier struct {
	DefaultLevel Level
	AllowList    []*regexp.Regexp
	BlockList    []string

	allowListHitTotal prometheus.Counter
	blocklistHitTotal prometheus.Counter
}

var _ ProcessClassifier = &CommandlineClassifier{}

var clNoMatch = &Classification{Level: LevelNoMatch, Classifier: ClassifierCommandline}

func (cl *CommandlineClassifier) Matches(executable string, cmdline []string) (*Classification, error) {
	for _, pattern := range cl.AllowList {
		if pattern.MatchString(executable) || pattern.MatchString(fmt.Sprintf("%v", cmdline)) {
			cl.allowListHitTotal.Inc()
			return clNoMatch, nil
		}
	}

	for _, b := range cl.BlockList {
		if strings.Contains(executable, b) || strings.Contains(strings.Join(cmdline, "|"), b) {
			cl.blocklistHitTotal.Inc()
			return &Classification{
				Level:      cl.DefaultLevel,
				Classifier: ClassifierCommandline,
				Message:    fmt.Sprintf("matched \"%s\"", b),
			}, nil
		}
	}

	return clNoMatch, nil
}

func (cl *CommandlineClassifier) Describe(d chan<- *prometheus.Desc) {
	cl.allowListHitTotal.Describe(d)
	cl.blocklistHitTotal.Describe(d)
}

func (cl *CommandlineClassifier) Collect(m chan<- prometheus.Metric) {
	cl.allowListHitTotal.Collect(m)
	cl.blocklistHitTotal.Collect(m)
}

func NewSignatureMatchClassifier(name string, defaultLevel Level, sig []*Signature) *SignatureMatchClassifier {
	cache, err := lru.New(2000)
	if err != nil {
		// lru.New only errs when size is <= 0
		panic(err)
	}
	return &SignatureMatchClassifier{
		Signatures:   sig,
		DefaultLevel: defaultLevel,
		processMissTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "gitpod_agent_smith",
			Subsystem: "classifier_signature",
			Name:      "process_miss_total",
			Help:      "total count of process executable misses",
			ConstLabels: prometheus.Labels{
				"classifier_name": name,
			},
		}, []string{"reason"}),
		signatureHitTotal: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: "gitpod_agent_smith",
			Subsystem: "classifier_signature",
			Name:      "signature_hit_total",
			Help:      "total count of process executable signature hits",
			ConstLabels: prometheus.Labels{
				"classifier_name": name,
			},
		}),
		cacheUseTotal: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "gitpod_agent_smith",
			Subsystem: "classifier_signature",
			Name:      "cache_use_total",
			Help:      "total count of cache hits and misses",
			ConstLabels: prometheus.Labels{
				"classifier_name": name,
			},
		}, []string{"use"}),
		cache: cache,
	}
}

const (
	// processMissNotFound is the reason we use on the process miss metric when
	// either the process itself or its executable cannot be found.
	processMissNotFound         = "not_found"
	processMissPermissionDenied = "permission_denied"
	processMissOther            = "other"
)

// SignatureMatchClassifier matches against binary signatures
type SignatureMatchClassifier struct {
	Signatures   []*Signature
	DefaultLevel Level
	cache        *lru.Cache

	processMissTotal  *prometheus.CounterVec
	signatureHitTotal prometheus.Counter
	cacheUseTotal     *prometheus.CounterVec
}

var _ ProcessClassifier = &SignatureMatchClassifier{}

var sigNoMatch = &Classification{Level: LevelNoMatch, Classifier: ClassifierSignature}

func (sigcl *SignatureMatchClassifier) Matches(executable string, cmdline []string) (c *Classification, err error) {
	r, err := os.Open(executable)
	if err != nil {
		var reason string
		if os.IsNotExist(err) {
			reason = processMissNotFound
		} else if errors.Is(err, os.ErrPermission) {
			reason = processMissPermissionDenied
		} else {
			reason = processMissOther
		}
		sigcl.processMissTotal.WithLabelValues(reason).Inc()
		log.WithFields(logrus.Fields{
			"executable": executable,
			"cmdline":    cmdline,
			"reason":     reason,
		}).WithError(err).Debug("signature classification miss")
		return sigNoMatch, nil
	}
	defer r.Close()

	hash, err := computeHash(r)
	if err == nil && hash != "" {
		clo, ok := sigcl.cache.Get(hash)
		if cl, cok := clo.(*Classification); ok && cok {
			sigcl.cacheUseTotal.WithLabelValues("hit").Inc()
			return cl, nil
		}
	}
	sigcl.cacheUseTotal.WithLabelValues("miss").Inc()

	defer func() {
		if c != nil && hash != "" {
			sigcl.cache.Add(hash, c)
		}
	}()

	var serr error
	for _, sig := range sigcl.Signatures {
		match, err := sig.Matches(r)
		if match {
			sigcl.signatureHitTotal.Inc()
			return &Classification{
				Level:      sigcl.DefaultLevel,
				Classifier: ClassifierSignature,
				Message:    fmt.Sprintf("matches %s", sig.Name),
			}, nil
		}
		if err != nil {
			serr = err
		}
	}
	if serr != nil {
		return nil, err
	}

	return sigNoMatch, nil
}

func computeHash(r io.ReadSeeker) (string, error) {
	defer func() {
		// once we're done with r, reset it
		r.Seek(0, io.SeekStart)
	}()

	var key = []byte{0x7e, 0x56, 0x05, 0xc7, 0x7f, 0xe6, 0x82, 0x65, 0xa2, 0xb6, 0xe4, 0xaf, 0x56, 0xb8, 0x78, 0x22, 0x0a, 0xd7, 0x51, 0x30, 0x59, 0xad, 0x79, 0xf3, 0x4a, 0x65, 0x79, 0xdc, 0x8c, 0xdb, 0xdd, 0x3c}
	hash, err := highwayhash.New(key)
	if err != nil {
		return "", err
	}
	_, err = io.Copy(hash, r)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", hash.Sum(nil)), nil
}

func (sigcl *SignatureMatchClassifier) Describe(d chan<- *prometheus.Desc) {
	sigcl.processMissTotal.Describe(d)
	sigcl.signatureHitTotal.Describe(d)
	sigcl.cacheUseTotal.Describe(d)
}

func (sigcl *SignatureMatchClassifier) Collect(m chan<- prometheus.Metric) {
	sigcl.processMissTotal.Collect(m)
	sigcl.signatureHitTotal.Collect(m)
	sigcl.cacheUseTotal.Collect(m)
}

// CompositeClassifier combines multiple classifiers into one. The first match wins.
type CompositeClassifier []ProcessClassifier

var _ ProcessClassifier = CompositeClassifier{}

var cmpNoMatch = &Classification{Level: LevelNoMatch, Classifier: ClassifierComposite}

func (cl CompositeClassifier) Matches(executable string, cmdline []string) (*Classification, error) {
	var (
		c   *Classification
		err error
	)
	for _, class := range cl {
		var cerr error
		c, cerr = class.Matches(executable, cmdline)
		if c != nil && c.Level != LevelNoMatch {
			// we've found a match - ignore previous errors
			err = nil
			break
		}
		if cerr != nil {
			err = cerr
		}
	}
	if err != nil {
		return nil, err
	}

	if c == nil {
		// empty composite classifier
		return cmpNoMatch, nil
	}
	if c.Level == LevelNoMatch {
		return cmpNoMatch, nil
	}

	res := *c
	res.Classifier = ClassifierComposite + "." + res.Classifier
	return &res, nil
}

func (cl CompositeClassifier) Describe(d chan<- *prometheus.Desc) {
	for _, c := range cl {
		obs, ok := c.(prometheus.Collector)
		if !ok {
			continue
		}
		obs.Describe(d)
	}
}

func (cl CompositeClassifier) Collect(m chan<- prometheus.Metric) {
	for _, c := range cl {
		obs, ok := c.(prometheus.Collector)
		if !ok {
			continue
		}
		obs.Collect(m)
	}
}

// GradedClassifier classifies processes based on a grading, in the order of "very", "barely", "audit"
type GradedClassifier map[Level]ProcessClassifier

var _ ProcessClassifier = GradedClassifier{}

var gradNoMatch = &Classification{Level: LevelNoMatch, Classifier: ClassifierGraded}

func (cl GradedClassifier) Matches(executable string, cmdline []string) (*Classification, error) {
	order := []Level{LevelVery, LevelBarely, LevelAudit}

	var (
		c   *Classification
		err error
	)
	for _, lvl := range order {
		class, ok := cl[lvl]
		if !ok {
			continue
		}

		var cerr error
		c, cerr = class.Matches(executable, cmdline)
		if c != nil && c.Level != LevelNoMatch {
			// we've found a match - ignore previous errors
			err = nil
			break
		}
		if cerr != nil {
			err = cerr
		}
	}
	if err != nil {
		return nil, err
	}

	if c == nil {
		// empty graded classifier
		return gradNoMatch, nil
	}
	if c.Level == LevelNoMatch {
		return gradNoMatch, nil
	}

	res := *c
	res.Classifier = ClassifierGraded + "." + res.Classifier
	return &res, nil
}

func (cl GradedClassifier) Describe(d chan<- *prometheus.Desc) {
	for _, c := range cl {
		obs, ok := c.(prometheus.Collector)
		if !ok {
			continue
		}
		obs.Describe(d)
	}
}

func (cl GradedClassifier) Collect(m chan<- prometheus.Metric) {
	for _, c := range cl {
		obs, ok := c.(prometheus.Collector)
		if !ok {
			continue
		}
		obs.Collect(m)
	}
}

func NewCountingMetricsClassifier(name string, delegate ProcessClassifier) *CountingMetricsClassifier {
	return &CountingMetricsClassifier{
		D: delegate,
		callCount: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: "gitpod_agent_smith",
			Subsystem: "classifier_count",
			Name:      "match_total",
			Help:      "total count of all Matches calls",
			ConstLabels: prometheus.Labels{
				"classifier_name": name,
			},
		}),
	}
}

// CountingMetricsClassifier adds a call count metric to a classifier
type CountingMetricsClassifier struct {
	D ProcessClassifier

	callCount prometheus.Counter
}

var _ ProcessClassifier = &CountingMetricsClassifier{}

func (cl *CountingMetricsClassifier) Matches(executable string, cmdline []string) (*Classification, error) {
	cl.callCount.Inc()
	return cl.D.Matches(executable, cmdline)
}

func (cl *CountingMetricsClassifier) Describe(d chan<- *prometheus.Desc) {
	cl.callCount.Describe(d)
	cl.D.Describe(d)
}

func (cl *CountingMetricsClassifier) Collect(m chan<- prometheus.Metric) {
	cl.callCount.Collect(m)
	cl.D.Collect(m)
}
