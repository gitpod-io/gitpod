// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package classifier

import (
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/gitpod-io/gitpod/agent-smith/pkg/common"
	"github.com/prometheus/client_golang/prometheus"
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

func NewCommandlineClassifier(allowList []string, blockList []string) (*CommandlineClassifier, error) {
	al := make([]*regexp.Regexp, 0, len(allowList))
	for _, a := range allowList {
		r, err := regexp.Compile(a)
		if err != nil {
			return nil, fmt.Errorf("cannot compile %s: %w", a, err)
		}
		al = append(al, r)
	}

	return &CommandlineClassifier{
		DefaultLevel: LevelAudit,
		AllowList:    al,
		BlockList:    blockList,

		allowListHitTotal: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: "gitpod_agent_smith",
			Subsystem: "classifier_commandline",
			Name:      "allowlist_hit_total",
			Help:      "total count of allowlist hits",
		}),
	}, nil
}

// CommandlineClassifier looks at the commandline of a process
type CommandlineClassifier struct {
	DefaultLevel Level
	AllowList    []*regexp.Regexp
	BlockList    []string

	allowListHitTotal prometheus.Counter
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
}

func (cl *CommandlineClassifier) Collect(m chan<- prometheus.Metric) {
	cl.allowListHitTotal.Collect(m)
}

func NewSignatureMatchClassifier(sig []*Signature) *SignatureMatchClassifier {
	return &SignatureMatchClassifier{
		Signatures:   sig,
		DefaultLevel: LevelAudit,
		processMissTotal: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: "gitpod_agent_smith",
			Subsystem: "classifier_signature",
			Name:      "process_miss_total",
			Help:      "total count of process executable misses",
		}),
	}
}

// SignatureMatchClassifier matches against binary signatures
type SignatureMatchClassifier struct {
	Signatures   []*Signature
	DefaultLevel Level

	processMissTotal prometheus.Counter
}

var _ ProcessClassifier = &SignatureMatchClassifier{}

var sigNoMatch = &Classification{Level: LevelNoMatch, Classifier: ClassifierSignature}

func (sigcl *SignatureMatchClassifier) Matches(executable string, cmdline []string) (*Classification, error) {
	r, err := os.Open(executable)
	if os.IsNotExist(err) {
		sigcl.processMissTotal.Inc()
		return sigNoMatch, nil
	}
	defer r.Close()

	var serr error
	for _, sig := range sigcl.Signatures {
		match, err := sig.Matches(r)
		if match {
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

func (sigcl *SignatureMatchClassifier) Describe(d chan<- *prometheus.Desc) {
	sigcl.processMissTotal.Describe(d)
}

func (sigcl *SignatureMatchClassifier) Collect(m chan<- prometheus.Metric) {
	sigcl.processMissTotal.Collect(m)
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
