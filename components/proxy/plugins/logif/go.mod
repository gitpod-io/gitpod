module github.com/gitpod-io/gitpod/proxy/plugins/logif

go 1.17

replace github.com/gitpod-io/gitpod/proxy/plugins/jsonselect => ../jsonselect

require (
	github.com/PaesslerAG/gval v1.1.1
	github.com/buger/jsonparser v1.1.1
	github.com/caddyserver/caddy/v2 v2.4.5
	github.com/gitpod-io/gitpod/proxy/plugins/jsonselect v0.0.0-00010101000000-000000000000
	go.uber.org/zap v1.19.0
	golang.org/x/term v0.0.0-20210615171337-6886f2dfbf5b
)

require (
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/caddyserver/certmagic v0.14.5 // indirect
	github.com/cespare/xxhash/v2 v2.1.1 // indirect
	github.com/dustin/go-humanize v1.0.1-0.20200219035652-afde56e7acac // indirect
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/google/uuid v1.3.0 // indirect
	github.com/klauspost/cpuid/v2 v2.0.9 // indirect
	github.com/libdns/libdns v0.2.1 // indirect
	github.com/matttproud/golang_protobuf_extensions v1.0.1 // indirect
	github.com/mholt/acmez v1.0.0 // indirect
	github.com/miekg/dns v1.1.42 // indirect
	github.com/prometheus/client_golang v1.11.0 // indirect
	github.com/prometheus/client_model v0.2.0 // indirect
	github.com/prometheus/common v0.26.0 // indirect
	github.com/prometheus/procfs v0.6.0 // indirect
	go.uber.org/atomic v1.7.0 // indirect
	go.uber.org/multierr v1.6.0 // indirect
	golang.org/x/crypto v0.0.0-20210616213533-5ff15b29337e // indirect
	golang.org/x/net v0.0.0-20210614182718-04defd469f4e // indirect
	golang.org/x/sys v0.0.0-20210630005230-0f9fa26af87c // indirect
	golang.org/x/text v0.3.6 // indirect
	google.golang.org/protobuf v1.27.1 // indirect
	gopkg.in/natefinch/lumberjack.v2 v2.0.0 // indirect
)
