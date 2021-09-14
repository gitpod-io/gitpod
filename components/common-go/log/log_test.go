// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package log

import (
	"bytes"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/sirupsen/logrus"
)

func TestFromBuffer(t *testing.T) {
	tests := []struct {
		Description string
		Input       []byte
		Expected    []byte
	}{
		{
			"Empty",
			[]byte("\x00"),
			[]byte(""),
		},
		{
			"With null and without msg or message field",
			[]byte("\x00{\"notMessages\":\"\"}"),
			[]byte(""),
		},
		{
			"Output without msg or message field",
			[]byte("\x00{\"notMessages\":\"\"}"),
			[]byte(""),
		},
		{
			"Output with message field",
			[]byte("{\"level\":\"info\",\"message\":\"DisposeWorkspace called\",\"time\":\"2021-09-14T21:26:44Z\"}"),
			[]byte("{\"context\":\"test\",\"level\":\"info\",\"msg\":\"DisposeWorkspace called\",\"time\":\"2021-09-14T21:26:44Z\"}\n"),
		},
		{
			"Output with msg field",
			[]byte("{\"level\":\"info\",\"msg\":\"DisposeWorkspace called\",\"time\":\"2021-09-14T21:26:44Z\"}"),
			[]byte("{\"context\":\"test\",\"level\":\"info\",\"msg\":\"DisposeWorkspace called\",\"time\":\"2021-09-14T21:26:44Z\"}\n"),
		},
		{
			"Output with msg field and error level",
			[]byte("{\"level\":\"error\",\"message\":\"DisposeWorkspace called\",\"time\":\"2021-09-14T21:26:44Z\"}"),
			[]byte("{\"context\":\"test\",\"level\":\"error\",\"msg\":\"DisposeWorkspace called\",\"time\":\"2021-09-14T21:26:44Z\"}\n"),
		},
		{
			"Output with msg field and error level",
			[]byte("{\"level\":\"error\",\"message\":\"DisposeWorkspace called\",\"time\":\"2021-09-14T21:26:44Z\"}"),
			[]byte("{\"context\":\"test\",\"level\":\"error\",\"msg\":\"DisposeWorkspace called\",\"time\":\"2021-09-14T21:26:44Z\"}\n"),
		},
		{
			"With invalid JSON",
			[]byte("{\"notMessages\":\"\""),
			[]byte(""),
		},
		{
			"Text as JSON",
			[]byte("NOT JSON"),
			[]byte(""),
		},
		{
			"Mixed content - text and valid JSON",
			[]byte("SOMETHING INVALID\n{\"level\":\"error\",\"message\":\"DisposeWorkspace called\",\"time\":\"2021-09-14T21:26:44Z\"}"),
			[]byte("{\"context\":\"test\",\"level\":\"error\",\"msg\":\"DisposeWorkspace called\",\"time\":\"2021-09-14T21:26:44Z\"}\n"),
		},
	}

	for _, test := range tests {
		logger := logrus.New()
		var buffer bytes.Buffer
		logger.SetFormatter(&logrus.JSONFormatter{})
		logger.SetOutput(&buffer)
		logger.SetLevel(logrus.DebugLevel)

		entry := logger.WithField("context", "test")

		FromBuffer(bytes.NewBuffer(test.Input), entry)
		if diff := cmp.Diff(string(test.Expected), buffer.String()); diff != "" {
			t.Errorf("%v: unexpected result (-want +got):\n%s", test.Description, diff)
		}
	}
}
