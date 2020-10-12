// Copyright (c) 2020 TypeFox GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package ports

import (
	"bytes"
	"context"
	"io"
	"io/ioutil"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
)

const validTCPInput = `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode                                                     
   0: 00000000:59D8 00000000:0000 0A 00000000:00000000 00:00000000 00000000 33333        0 57008615 1 0000000000000000 100 0 0 10 0                  
   1: 00000000:17C0 00000000:0000 0A 00000000:00000000 00:00000000 00000000 33333        0 57020850 1 0000000000000000 100 0 0 10 0                  
   2: 0100007F:170C 00000000:0000 0A 00000000:00000000 00:00000000 00000000 33333        0 57019442 1 0000000000000000 100 0 0 10 0                  
   3: 0100007F:EB64 0100007F:59D7 01 00000000:00000000 02:00000348 00000000 33333        0 57010758 2 0000000000000000 20 4 1 10 -1                  
   4: 940C380A:59D8 0302380A:BFFC 01 00000000:00000000 00:00000000 00000000 33333        0 57015718 3 0000000000000000 20 4 29 61 17                 
`

const validTCP6Input = `  sl  local_address                         remote_address                        st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 00000000000000000000000000000000:59D7 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000 33333        0 57007063 1 0000000000000000 100 0 0 10 0
   1: 00000000000000000000000000000000:8C3C 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000 33333        0 57022992 1 0000000000000000 100 0 0 10 0
   2: 00000000000000000000000001000000:170C 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000 33333        0 57019446 1 0000000000000000 100 0 0 10 0
   3: 00000000000000000000000000000000:8CF0 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000 33333        0 57018070 1 0000000000000000 100 0 0 10 0
   4: 0000000000000000FFFF0000940C380A:59D7 0000000000000000FFFF00006100840A:E45C 06 00000000:00000000 03:00001002 00000000     0        0 0 3 0000000000000000
   5: 0000000000000000FFFF0000940C380A:59D7 0000000000000000FFFF00006100840A:E38A 06 00000000:00000000 03:00000D46 00000000     0        0 0 3 0000000000000000
   6: 0000000000000000FFFF0000940C380A:59D7 0000000000000000FFFF0000030C380A:DBFE 01 00000000:00000000 02:000005D2 00000000 33333        0 57015690 2 0000000000000000 20 4 0 10 -1
   7: 0000000000000000FFFF0000940C380A:59D7 0000000000000000FFFF00006100840A:E08A 06 00000000:00000000 03:000003E6 00000000     0        0 0 3 0000000000000000
  20: 0000000000000000FFFF00000100007F:59D7 0000000000000000FFFF00000100007F:EB64 01 00000000:00000000 02:000003D2 00000000 33333        0 57014424 2 0000000000000000 20 4 0 10 -1`

func TestObserve(t *testing.T) {
	type Expectation [][]ServedPort
	tests := []struct {
		Name         string
		FileContents []string
		Expectation  Expectation
	}{
		{
			Name: "basic positive",
			FileContents: []string{
				"", "",
				validTCPInput, validTCP6Input,
			},
			Expectation: Expectation{
				{
					{Port: 23000},
					{Port: 6080},
					{Port: 5900, BoundToLocalhost: true},
					{Port: 22999},
					{Port: 35900}, {Port: 5900, BoundToLocalhost: true},
					{Port: 36080},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var f int
			obs := PollingServedPortsObserver{
				RefreshInterval: 100 * time.Millisecond,
				fileOpener: func(fn string) (io.ReadCloser, error) {
					if f >= len(test.FileContents) {
						return nil, os.ErrNotExist
					}

					res := ioutil.NopCloser(bytes.NewReader([]byte(test.FileContents[f])))
					f++
					return res, nil
				},
			}

			ctx, cancel := context.WithCancel(context.Background())
			updates, errs := obs.Observe(ctx)
			go func() {
				time.Sleep(500 * time.Millisecond)
				cancel()
			}()
			go func() {
				for range errs {
				}
			}()

			var act Expectation
			for up := range updates {
				act = append(act, up)
			}

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}

func TestReadNetTCPFile(t *testing.T) {
	type Expectation struct {
		Ports []ServedPort
		Error error
	}
	tests := []struct {
		Name          string
		Input         string
		ListeningOnly bool
		Expectation   Expectation
	}{
		{
			Name:          "valid tcp4 input",
			Input:         validTCPInput,
			ListeningOnly: true,
			Expectation: Expectation{
				Ports: []ServedPort{
					{Port: 23000},
					{Port: 6080},
					{Port: 5900, BoundToLocalhost: true},
				},
			},
		},
		{
			Name:          "valid tcp6 input",
			Input:         validTCP6Input,
			ListeningOnly: true,
			Expectation: Expectation{
				Ports: []ServedPort{
					{Port: 22999},
					{Port: 35900},
					{Port: 5900, BoundToLocalhost: true},
					{Port: 36080},
				},
			},
		},
		{
			Name:          "invalid input",
			Input:         strings.ReplaceAll(validTCPInput, "0A", ""),
			ListeningOnly: true,
			Expectation:   Expectation{},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			var act Expectation
			act.Ports, act.Error = readNetTCPFile(bytes.NewReader([]byte(test.Input)), test.ListeningOnly)

			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}
