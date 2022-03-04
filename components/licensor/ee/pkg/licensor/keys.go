// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package licensor

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
)

var (
	keys = [][]byte{
		// Demo key - remove before publishing this code
		[]byte(`-----BEGIN PUBLIC KEY-----
MIIBCgKCAQEAtHhBNA9J7mh301CMP4Hfvv0OLMWDG3FjwR9nUAg3z5SFYnUz4tnP
NB7gDFNXUIUpetKUyyoAwAWwQsu4/zt9XDg6G25jiHZ/inEfI3xQV2tUhJm+zVLg
7RCUpVjbUZthaIhGyYm0Oa/Lqa8q/hInqP/Hlvgga+yfBurrYyhdaJFWpgF/m2ha
yFgEEE/427F/BP/qNfJN+v/ojtsJMM81/jGWH6Tm0bxoWa5nQPsGF7h0MjLc5pYp
NOrioO8lNSNu1Fz8cYwATxmdgA+0scS/pXyNcP1U9ELjpUAXaUdhthViQ4d5hXj2
48DoltWJYg1Vgjj2eeYKr7JiJjrXlZoaFwIDAQAB
-----END PUBLIC KEY-----`),
		// TOOD: add trial license key here
		// TODO: add actual production license key here
	}
)

var publicKeys []*rsa.PublicKey

func init() {
	publicKeys = make([]*rsa.PublicKey, len(keys))
	for i, pk := range keys {
		block, _ := pem.Decode(pk)
		if block == nil {
			panic("invalid public licensor key")
		}
		if block.Type != "PUBLIC KEY" {
			panic(fmt.Sprintf("unknown PEM block type %s", block.Type))
		}

		var err error
		publicKeys[i], err = x509.ParsePKCS1PublicKey(block.Bytes)
		if err != nil {
			panic(err)
		}
	}
}
