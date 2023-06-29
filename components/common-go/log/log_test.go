// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package log

import (
	"bytes"
	"fmt"
	"io"
	"strings"
	"testing"
	"time"

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

type TestWorkspaceInfo struct {
	WorkspaceId         string
	InstanceId          string
	WorkspaceContextUrl string
}

func TestScrubFormatter(t *testing.T) {
	logger := logrus.New()
	logger.SetFormatter(newGcpFormatter(false))

	var buffer bytes.Buffer
	logger.SetOutput(&buffer)

	createInfo := func() *TestWorkspaceInfo {
		return &TestWorkspaceInfo{
			WorkspaceId:         "1234567890",
			InstanceId:          "1234567890",
			WorkspaceContextUrl: "https://github.com/gitpod-io/gitpod",
		}
	}
	info := createInfo()
	workspaceID := "1234567890"

	logTime := time.Now()
	logger.WithTime(logTime).WithField("info", info).WithField("workspaceID", workspaceID).
		WithError(fmt.Errorf("some test error")).
		WithFields(ServiceContext("test", "1.0.0")).
		Info("email: anton@gitpod.io")

	expectation := fmt.Sprintf(
		`{"error":"some test error","info":"[redacted:nested]","level":"info","message":"email: anton@gitpod.io","serviceContext":{"service":"test","version":"1.0.0"},"severity":"INFO","time":"%s","workspaceID":"[redacted:md5:e807f1fcf82d132f9bb018ca6738a19f]"}`,
		logTime.Format(time.RFC3339Nano),
	)
	actual := strings.TrimSpace(buffer.String())
	if diff := cmp.Diff(expectation, actual); diff != "" {
		t.Errorf("unexpected result (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff(createInfo(), info); diff != "" {
		t.Errorf("info: unexpected result (-want +got):\n%s", diff)
	}
	if diff := cmp.Diff("1234567890", workspaceID); diff != "" {
		t.Errorf("workspaceID: unexpected result (-want +got):\n%s", diff)
	}
}

/*
12/06/2023 - no cahce fields
cpu: Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz
BenchmarkSimpleScrubFormatter/json-32         	  312109	      3617 ns/op	    2035 B/op	      31 allocs/op
BenchmarkSimpleScrubFormatter/scrub+json-32   	  244150	      4753 ns/op	    2242 B/op	      37 allocs/op

09/06/2023 - with redacting nested fields
cpu: Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz
BenchmarkSimpleScrubFormatter/json-32         	  281763	      3666 ns/op	    2035 B/op	      31 allocs/op
BenchmarkSimpleScrubFormatter/scrub+json-32   	  278829	      4248 ns/op	    2204 B/op	      37 allocs/op

05/06/2023 - with json scrubbing
cpu: Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz
BenchmarkSimpleScrubFormatter/json-32         	  321686	      3546 ns/op	    2035 B/op	      31 allocs/op
BenchmarkSimpleScrubFormatter/scrub+json-32   	  148384	      8308 ns/op	    3781 B/op	      76 allocs/op

02/06/2023 (Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz) - with cache lock and eviction
BenchmarkSimpleScrubFormatter/json-32         	  359746	      3144 ns/op	    1914 B/op	      28 allocs/op
BenchmarkSimpleScrubFormatter/scrub+json-32   	  312946	      3796 ns/op	    2083 B/op	      34 allocs/op

02/06/2023 (Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz) - precomputed cache
BenchmarkSimpleScrubFormatter/json-32         	  367134	      3215 ns/op	    1914 B/op	      28 allocs/op
BenchmarkSimpleScrubFormatter/scrub+json-32   	  302583	      3869 ns/op	    2083 B/op	      34 allocs/op

01/06/2023 (Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz) - with caching without lower case conversion
BenchmarkSimpleScrubFormatter/json-32         	  377443	      3059 ns/op	    1914 B/op	      28 allocs/op
BenchmarkSimpleScrubFormatter/scrub+json-32   	  311752	      3704 ns/op	    2083 B/op	      34 allocs/op

31/05/2023 (Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz) - skip message, scrub with KeyValue for string type
BenchmarkSimpleScrubFormatter/json-32         	  376062	      3019 ns/op	    1914 B/op	      28 allocs/op
BenchmarkSimpleScrubFormatter/scrub+json-32   	  313464	      3798 ns/op	    2097 B/op	      35 allocs/op

31/05/2023 (Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz) - skip message
BenchmarkSimpleScrubFormatter/json-32         	  380050	      2991 ns/op	    1914 B/op	      28 allocs/op
BenchmarkSimpleScrubFormatter/scrub+json-32   	  270021	      4420 ns/op	    2233 B/op	      43 allocs/op

30/05/2023 (Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz) - scrubbing takes almost twice as long because of relection and regex replacements
BenchmarkSimpleScrubFormatter/json-32         	  368532	      3095 ns/op	    1914 B/op	      28 allocs/op
BenchmarkSimpleScrubFormatter/scrub+json-32   	  200944	      5858 ns/op	    2666 B/op	      53 allocs/op
0      1.21s (flat, cum) 38.29% of Total
.          .     94:func (formatter *scrubFormatter) Format(entry *logrus.Entry) ([]byte, error) {
.      300ms     95:   entry.Message = scrubber.Default.Value(entry.Message)
.      260ms     96:   err := scrubber.Default.Struct(entry.Data)
.          .     97:   if err != nil {
.          .     98:           return nil, fmt.Errorf("cannot scrub log entry: %w", err)
.          .     99:   }
.      650ms    100:   return formatter.delegate.Format(entry)
.          .    101:}
*/
func BenchmarkSimpleScrubFormatter(b *testing.B) {
	logger := logrus.New()
	logger.SetOutput(io.Discard)

	run := func() {
		logger.WithField("workspaceID", "1234567890").Info("email: anton@gitpod.io")
	}

	logger.SetFormatter(newGcpFormatter(true))
	b.Run("json", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			run()
		}
	})

	logger.SetFormatter(newGcpFormatter(false))
	b.Run("scrub+json", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			run()
		}
	})

}

/*
12/06/2023 - no cahce fields
cpu: Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz
BenchmarkStructScrubFormatter/json-32         	  304662	      3860 ns/op	    2091 B/op	      32 allocs/op
BenchmarkStructScrubFormatter/scrub+json-32   	  320354	      3698 ns/op	    2091 B/op	      32 allocs/op

09/06/2023 - with redacting nested fields
cpu: Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz
BenchmarkStructScrubFormatter/json-32         	  315826	      3706 ns/op	    2091 B/op	      32 allocs/op
BenchmarkStructScrubFormatter/scrub+json-32   	  322910	      3647 ns/op	    2091 B/op	      32 allocs/op

05/06/2023 - with json scrubbing
cpu: Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz
BenchmarkStructScrubFormatter/json-32         	  310472	      3842 ns/op	    2091 B/op	      32 allocs/op
BenchmarkStructScrubFormatter/scrub+json-32   	  109390	     10808 ns/op	    5101 B/op	     105 allocs/op

02/06/2023 (Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz - with cache lock and eviction
BenchmarkStructScrubFormatter/json-32         	  354174	      3314 ns/op	    1971 B/op	      29 allocs/op
BenchmarkStructScrubFormatter/scrub+json-32   	  242992	      4896 ns/op	    2365 B/op	      44 allocs/op

02/06/2023 (Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz - precomputed cache
BenchmarkStructScrubFormatter/json-32         	  344023	      3465 ns/op	    1971 B/op	      29 allocs/op
BenchmarkStructScrubFormatter/scrub+json-32   	  240534	      4850 ns/op	    2365 B/op	      44 allocs/op

01/06/2023 (Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz) - with caching without lower case conversion
BenchmarkStructScrubFormatter/json-32         	  354729	      3259 ns/op	    1971 B/op	      29 allocs/op
BenchmarkStructScrubFormatter/scrub+json-32   	  232270	      4767 ns/op	    2365 B/op	      44 allocs/op

01/06/2023 (Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz) - with substring mathing - 3 times slower
BenchmarkStructScrubFormatter/json-32         	  351439	      3388 ns/op	    1971 B/op	      29 allocs/op
BenchmarkStructScrubFormatter/scrub+json-32   	  115599	      9032 ns/op	    2396 B/op	      44 allocs/op

31/05/2023 (Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz) - early exit with SkipEntry + no double traversing
BenchmarkStructScrubFormatter/json-32         	  369788	      3885 ns/op	    1971 B/op	      29 allocs/op
BenchmarkStructScrubFormatter/scrub+json-32   	  232442	      5092 ns/op	    2421 B/op	      47 allocs/op

31/05/2023 (Intel(R) Xeon(R) Platinum 8375C CPU @ 2.90GHz) - initial, still double
BenchmarkStructScrubFormatter/json-32         	  349736	      3240 ns/op	    1971 B/op	      29 allocs/op
BenchmarkStructScrubFormatter/scrub+json-32   	  142266	      8295 ns/op	    2580 B/op	      53 allocs/op
*/
func BenchmarkStructScrubFormatter(b *testing.B) {
	logger := logrus.New()
	logger.SetOutput(io.Discard)

	run := func() {
		logger.WithField("info", &TestWorkspaceInfo{
			WorkspaceId:         "1234567890",
			InstanceId:          "1234567890",
			WorkspaceContextUrl: "https://github.com/gitpod-io/gitpod",
		}).Info("resolve workspace info failed")
	}

	logger.SetFormatter(newGcpFormatter(true))
	b.Run("json", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			run()
		}
	})

	logger.SetFormatter(newGcpFormatter(false))
	b.Run("scrub+json", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			run()
		}
	})

}
