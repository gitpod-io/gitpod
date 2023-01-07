module github.com/gitpod-io/gitpod/gitpod-cli

go 1.19

require (
	github.com/creack/pty v1.1.17
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/gitpod-protocol v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/ide-metrics-api v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/supervisor/api v0.0.0-00010101000000-000000000000
	github.com/go-errors/errors v1.4.2
	github.com/golang/mock v1.6.0
	github.com/google/go-cmp v0.5.8
	github.com/google/shlex v0.0.0-20181106134648-c34317bd91bf
	github.com/google/tcpproxy v0.0.0-20180808230851-dfa16c61dad2
	github.com/gorilla/handlers v1.5.1
	github.com/manifoldco/promptui v0.9.0
	github.com/olekukonko/tablewriter v0.0.5
	github.com/prometheus/procfs v0.8.0
	github.com/sirupsen/logrus v1.8.1
	github.com/sourcegraph/jsonrpc2 v0.0.0-20200429184054-15c2290dcb37
	github.com/spf13/cobra v1.1.3
	golang.org/x/sys v0.0.0-20220610221304-9f5ed59c137d
	golang.org/x/term v0.0.0-20220526004731-065cf7ba2467
	golang.org/x/xerrors v0.0.0-20220609144429-65e65417b02f
	google.golang.org/grpc v1.49.0
	gopkg.in/yaml.v2 v2.4.0
)

require (
	github.com/cenkalti/backoff/v4 v4.1.3 // indirect
	github.com/chzyer/readline v0.0.0-20180603132655-2972be24d48e // indirect
	github.com/felixge/httpsnoop v1.0.1 // indirect
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/gorilla/websocket v1.5.0 // indirect
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.11.3 // indirect
	github.com/inconshreveable/mousetrap v1.0.0 // indirect
	github.com/mattn/go-runewidth v0.0.9 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	github.com/xeipuuv/gojsonpointer v0.0.0-20180127040702-4e3ac2762d5f // indirect
	github.com/xeipuuv/gojsonreference v0.0.0-20180127040603-bd5ef7bd5415 // indirect
	github.com/xeipuuv/gojsonschema v1.2.0 // indirect
	golang.org/x/net v0.0.0-20220624214902-1bab6f366d9e // indirect
	golang.org/x/text v0.3.7 // indirect
	google.golang.org/genproto v0.0.0-20220822174746-9e6da59bd2fc // indirect
	google.golang.org/protobuf v1.28.1 // indirect
)

replace github.com/gitpod-io/gitpod/gitpod-protocol => ../gitpod-protocol/go // leeway

replace github.com/gitpod-io/gitpod/supervisor/api => ../supervisor-api/go // leeway

replace github.com/gitpod-io/gitpod/ide-metrics-api => ../ide-metrics-api/go // leeway

replace github.com/gitpod-io/gitpod/common-go => ../common-go // leeway
