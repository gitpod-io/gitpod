// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package doh

import (
	"time"
)

// Maximum lookup retries
const maxRetries = 3

// Lookup timeout
const timeout time.Duration = 10 * time.Second

// Don't look up any of these TLDs
// RFC 2606, 3166, 6303, 7393
// https://www.iana.org/assignments/locally-served-dns-zones/locally-served-dns-zones.xhtml
// https://ithi.research.icann.org/graph-m3.html#M332
// https://tools.ietf.org/html/draft-ietf-dnsop-private-use-tld-00
var locals = []string{
	"localhost",
	"in-addr.arpa", "ip6.arpa", "home.arpa",
	"i2p", "onion",
	"i2p.arpa", "onion.arpa",
	"corp", "home", "internal", "intranet", "lan", "local", "private",
	"dhcp", "localdomain", "bbrouter", "dlink", "ctc", "intra", "loc", "modem", "ip",
	"test", "example", "invalid",
	"alt",
	"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
	"n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
	"aa",
	"qm", "qn", "qo", "qp", "qq", "qr", "qs", "qt", "qu", "qv", "qw", "qx", "qy", "qz",
	"xa", "xb", "xc", "xd", "xe", "xf", "xg", "xh", "xi", "xj", "xk", "xl", "xm",
	"xn", "xo", "xp", "xq", "xr", "xs", "xt", "xu", "xv", "xw", "xx", "xy", "xz",
	"zz",
}

var cloudflare1 = &Upstream{
	url: "https://1.0.0.1/dns-query",
}

var cloudflare2 = &Upstream{
	url: "https://1.1.1.1/dns-query",
}

var google1 = &Upstream{
	url: "https://dns.google/resolve",
}

var quad91 = &Upstream{
	url: "https://9.9.9.9:5053/dns-query",
}

var quad92 = &Upstream{
	url: "https://149.112.112.112:5053/dns-query",
}

var ahadnsIT = &Upstream{
	url: "https://doh.it.ahadns.net/dns-query",
}

var ahadnsES = &Upstream{
	url: "https://doh.es.ahadns.net/dns-query",
}

var upstreams = []*Upstream{
	cloudflare1, cloudflare2,
	google1,
	quad91, quad92,
	ahadnsIT, ahadnsES,
}

var questions = []string{
	"xmr.f2pool.com",
	"eth.f2pool.com",      // v6 too
	"ethv2-eu.f2pool.com", // v6 too
	"xmr.hashcity.org",
	"xmr.miningpool.fun",
	"xmr.2miners.com", // v6 too
	"btc.ss.poolin.com",
	"eth-asia1.nanopool.org",
	"eth-au1.nanopool.org",
	"eth-eu1.nanopool.org",
	"eth-eu2.nanopool.org",
	"eth-jp1.nanopool.org",
	"xmr-asia1.nanopool.org",
	"xmr-au1.nanopool.org",
	"xmr-eu1.nanopool.org",
	"xmr-eu2.nanopool.org",
	"xmr-jp1.nanopool.org",
	"xmr-us-east1.nanopool.org",
	"xmr-us-west1.nanopool.org",
	"eth-us-east1.nanopool.org",
	"eth-us-west1.nanopool.org",
	"eu.stratum.slushpool.com",
	"sg.stratum.slushpool.com",
	"us-east.stratum.slushpool.com",
	"asia1.ethpool.org", // v6 too
	"eu1.ethpool.org",   // v6 too
	"us1.ethpool.org",   // v6 too
	"us2.ethpool.org",   // v6 too
	"mine.xmrpool.net",
	"fr.minexmr.com",
	"pool.minexmr.com",
	"ca.minexmr.com",
	"de.minexmr.com",
	"sg.minexmr.com",
	"pool.hashvault.pro",
	"pool.supportxmr.com",
	"ss.antpool.com",
	"dash.antpool.com",
	"eth.antpool.com",
	"zec.antpool.com",
	"xmc.antpool.com",
	"btm.antpool.com",
	"stratum-eth.antpool.com",
	"stratum-ltc.antpool.com",
	"stratum-dash.antpool.com",
	"stratum-btm.antpool.com",
	"stratum-zec.antpool.com",
	"stratum-xmc.antpool.com",
	"stratum.antpool.com", // v6 too
	"eu1.ethermine.org",   // v6 too
	"us1.ethermine.org",   // v6 too
	"us2.ethermine.org",   // v6 too
	"xmr.crypto-pool.fr",
	"xmr.pool.minergate.com",
	"rx.unmineable.com",
}
