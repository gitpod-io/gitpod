// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package api

import (
	"bytes"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gitpod-io/gitpod/common-go/log"
)

func NewStreamsClient(url string, timeout time.Duration, retries int) *StreamsClient {
	return &StreamsClient{
		out:     make(chan []byte, 100),
		idx:     make(chan int),
		stop:    make(chan struct{}),
		URL:     url,
		Timeout: timeout,
		Retries: retries,
	}
}

type StreamsClient struct {
	URL     string
	Timeout time.Duration
	Retries int

	out  chan []byte
	idx  chan int
	stop chan struct{}
	once sync.Once
	wg   sync.WaitGroup
}

var _ io.Closer = &StreamsClient{}
var _ io.Writer = &StreamsClient{}

func (c *StreamsClient) Close() error {
	c.once.Do(func() { close(c.stop) })
	c.wg.Wait()
	return nil
}

func (c *StreamsClient) Write(buf []byte) (int, error) {
	nbuf := make([]byte, len(buf))
	copy(nbuf, buf)
	c.out <- nbuf
	return len(nbuf), nil
}

func serveIdx(stop <-chan struct{}, idx chan<- int) {
	for i := 0; ; i++ {
		select {
		case idx <- i:
		case <-stop:
			return
		}
	}
}

func (c *StreamsClient) run(wg *sync.WaitGroup) {
	client := http.Client{
		Timeout: c.Timeout,
	}
	for b := range c.out {
		if b == nil {
			return
		}
		idx := <-c.idx

		var success bool
		for i := 0; i < c.Retries; i++ {
			req, err := http.NewRequest("POST", c.URL, bytes.NewReader(b))
			if err != nil {
				continue
			}
			req.Header.Add("x-log-idx", strconv.Itoa(idx))
			resp, err := client.Do(req)
			if err == nil && resp.StatusCode == 200 {
				break
			}

			time.Sleep(2 * time.Second)
		}
		if !success {
			log.WithField("idx", idx).Warn("dropping stream block")
		}
	}
}
