module github.com/gitpod-io/gitpod/proxy/plugins/logif

go 1.17

replace github.com/gitpod-io/gitpod/proxy/plugins/jsonselect => ../jsonselect

require (
	github.com/PaesslerAG/gval v1.1.1
	github.com/buger/jsonparser v1.1.1
	github.com/caddyserver/caddy/v2 v2.4.3
	github.com/gitpod-io/gitpod/proxy/plugins/jsonselect v0.0.0-00010101000000-000000000000
	go.uber.org/zap v1.18.1
	golang.org/x/term v0.0.0-20210615171337-6886f2dfbf5b
)
