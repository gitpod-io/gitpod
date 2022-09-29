// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package log

import (
	"encoding/json"
	"testing"

	"github.com/sirupsen/logrus"

	ctesting "github.com/gitpod-io/gitpod/common-go/testing"
)

func TestFormatterRedaction(t *testing.T) {
	type fixture map[string]interface{}
	type gold map[string]interface{}

	test := ctesting.FixtureTest{
		T:    t,
		Path: "testdata/*.json",
		Test: func(t *testing.T, input interface{}) interface{} {
			logEntry := &logrus.Entry{
				Data:   logrus.Fields{"req": input},
				Logger: Log.Logger,
			}

			f := &JSONFormatter{}

			err := f.SetFilters(WSManagerFilters)
			if err != nil {
				t.Error(err)
			}

			result, err := f.Format(logEntry)
			if err != nil {
				t.Fatalf("cannot format message: %v", err)
			}

			var v map[string]interface{}
			if err := json.Unmarshal(result, &v); err != nil {
				t.Fatalf("cannot unmarshall message: %v", err)
			}

			return &v
		},
		Fixture: func() interface{} { return new(fixture) },
		Gold:    func() interface{} { return new(gold) },
	}

	test.Run()

}
