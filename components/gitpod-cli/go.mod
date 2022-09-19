module github.com/gitpod-io/gitpod/gitpod-cli

go 1.18

require (
	github.com/creack/pty v1.1.17
	github.com/gitpod-io/gitpod/common-go v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/gitpod-protocol v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/supervisor/api v0.0.0-00010101000000-000000000000
	github.com/golang/mock v1.6.0
	github.com/google/go-cmp v0.5.8
	github.com/google/shlex v0.0.0-20191202100458-e7afc7fbc510
	github.com/google/tcpproxy v0.0.0-20180808230851-dfa16c61dad2
	github.com/gorilla/handlers v1.5.1
	github.com/manifoldco/promptui v0.9.0
	github.com/olekukonko/tablewriter v0.0.5
	github.com/pkg/errors v0.9.1
	github.com/prometheus/procfs v0.8.0
	github.com/sirupsen/logrus v1.9.0
	github.com/sourcegraph/jsonrpc2 v0.0.0-20200429184054-15c2290dcb37
	github.com/spf13/cobra v1.5.0
	golang.org/x/sys v0.0.0-20220919091848-fb04ddd9f9c8
	golang.org/x/term v0.0.0-20220526004731-065cf7ba2467
	golang.org/x/xerrors v0.0.0-20220609144429-65e65417b02f
	google.golang.org/grpc v1.49.0
	gopkg.in/yaml.v2 v2.4.0
)

require (
	github.com/chzyer/readline v0.0.0-20180603132655-2972be24d48e // indirect
	github.com/felixge/httpsnoop v1.0.2 // indirect
	github.com/golang/glog v1.0.0 // indirect
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/gorilla/websocket v1.5.0 // indirect
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.5.0 // indirect
	github.com/inconshreveable/mousetrap v1.0.0 // indirect
	github.com/kr/pretty v0.3.0 // indirect
	github.com/mattn/go-runewidth v0.0.9 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	github.com/stretchr/testify v1.8.0 // indirect
	golang.org/x/net v0.0.0-20220812174116-3211cb980234 // indirect
	golang.org/x/text v0.3.8-0.20211004125949-5bd84dd9b33b // indirect
	google.golang.org/genproto v0.0.0-20220617124728-180714bec0ad // indirect
	google.golang.org/protobuf v1.28.1 // indirect
	gopkg.in/check.v1 v1.0.0-20201130134442-10cb98267c6c // indirect
)

replace github.com/gitpod-io/gitpod/gitpod-protocol => ../gitpod-protocol/go // leeway

replace github.com/gitpod-io/gitpod/supervisor/api => ../supervisor-api/go // leeway

replace github.com/gitpod-io/gitpod/common-go => ../common-go // leeway
