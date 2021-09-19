// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package doh

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	log "github.com/sirupsen/logrus"

	"github.com/dchest/uniuri"
	"github.com/miekg/dns"
	"golang.org/x/net/idna"
)

type Upstream struct {
	url string
}

func (u *Upstream) Lookup(name string, dnsType dns.Type) (Response, error) {
	dnsRequestResponse := Response{}

	for _, local := range locals {
		if name == local || strings.HasSuffix(name, fmt.Sprintf(".%s", local)) {
			return dnsRequestResponse, fmt.Errorf("cannot lookup TLD: %s", name)
		}
	}

	n, err := idna.ToASCII(name)
	if err != nil {
		return dnsRequestResponse, err
	}

	if _, ok := dns.IsDomainName(n); !ok {
		return dnsRequestResponse, fmt.Errorf("malformed domain name")
	}

	client := http.Client{
		Timeout: timeout,
	}

	req, err := http.NewRequest("GET", u.url, nil)
	if err != nil {
		return dnsRequestResponse, fmt.Errorf("error creating the request: %s", err)
	}
	req.Header.Add("accept", "application/dns-json")
	q := req.URL.Query()
	q.Add("name", url.QueryEscape(n))
	q.Add("type", strconv.Itoa(int(dnsType)))
	q.Add("do", "false") // ignore DNSSEC
	q.Add("cd", "false") // ignore DNSSEC
	req.URL.RawQuery = q.Encode()

	res, err := client.Do(req)
	log.WithField("url", req.URL.String()).Debug("querying")
	if err != nil {
		return dnsRequestResponse, fmt.Errorf("error sending the request: %s", err)
	}

	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return dnsRequestResponse, fmt.Errorf("error reading the response: %s", err)
	}

	err = json.Unmarshal(body, &dnsRequestResponse)
	if err != nil {
		log.Fatal(err)
	}

	if len(dnsRequestResponse.Answer) <= 0 {
		return dnsRequestResponse, fmt.Errorf("no answers")
	}
	if dnsRequestResponse.Status != dns.RcodeSuccess {
		return dnsRequestResponse, fmt.Errorf("error %s", dns.RcodeToString[dnsRequestResponse.Status])
	}

	return dnsRequestResponse, nil
}

func Lookup(pool *Pool, q string, queryType uint16, retry bool) ([]net.IP, int, error) {
	retries := 0
	minTTL := 0
	addresses := []net.IP{}

	queryTypeString, ok := dns.TypeToString[queryType]
	if !ok {
		return nil, minTTL, fmt.Errorf("unknown query type: %d", queryType)
	}

	var protoString string
	if queryTypeString == "A" {
		protoString = "IPv4"
	} else if queryTypeString == "AAAA" {
		protoString = "IPv6"
	} else {
		return nil, minTTL, fmt.Errorf("unsupported query type: %d", queryType)
	}

	k := pool.Borrow(q)
lookup:
	res, err := k.Lookup(q, dns.Type(queryType))
	if err != nil {
		if retries < maxRetries && retry {
			// Retry borrowing a different upstream
			k = pool.Borrow(fmt.Sprintf("%s%s", q, uniuri.New()))
			// note > it would be better to lower the weight of the previous upstream that failed
			retries++
			log.WithError(err).
				WithField("name", q).
				WithField("protocol", protoString).
				WithField("retry", retries).
				Warn("retrying")
			goto lookup
		}
		log.WithError(err).
			WithField("name", q).
			WithField("protocol", protoString).
			Warn("fail")
	}
	for _, a := range res.Answer {
		if a.Type == int(queryType) {
			ip := net.ParseIP(a.Data)
			if ip == nil {
				log.WithField("data", a.Data).
					Error("invalid IP")
				continue
			}
			if ip.IsLoopback() {
				log.WithField("name", q).
					WithField("protocol", protoString).
					Warn("resolves to localhost")
				continue
			}
			if ip.IsUnspecified() {
				log.WithField("name", q).
					WithField("protocol", protoString).
					Warn("unspecified")
			}
			log.WithField("ttl", a.TTL).
				WithField("name", q).
				WithField("protocol", protoString).
				WithField("IP", a.Data).
				Info("result")
			if a.TTL > minTTL {
				minTTL = a.TTL
			}
			addresses = append(addresses, ip)
		}
	}

	return addresses, minTTL, nil
}
