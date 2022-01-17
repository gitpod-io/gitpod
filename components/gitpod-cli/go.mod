module github.com/gitpod-io/gitpod/gitpod-cli

go 1.17

require (
	github.com/gitpod-io/gitpod/gitpod-protocol v0.0.0-00010101000000-000000000000
	github.com/gitpod-io/gitpod/supervisor/api v0.0.0-00010101000000-000000000000
	github.com/golang/mock v1.6.0
	github.com/google/go-cmp v0.5.6
	github.com/google/shlex v0.0.0-20181106134648-c34317bd91bf
	github.com/google/tcpproxy v0.0.0-20180808230851-dfa16c61dad2
	github.com/gorilla/handlers v1.5.1
	github.com/manifoldco/promptui v0.3.2
	github.com/nicksnyder/go-i18n v1.10.1 // indirect
	github.com/pkg/errors v0.9.1
	github.com/sirupsen/logrus v1.8.1
	github.com/spf13/cobra v1.3.0
	golang.org/x/sys v0.0.0-20220111092808-5a964db01320
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1
	google.golang.org/grpc v1.43.0
	gopkg.in/alecthomas/kingpin.v3-unstable v3.0.0-20191105091915-95d230a53780 // indirect
	gopkg.in/yaml.v2 v2.4.0
)

require (
	github.com/sourcegraph/jsonrpc2 v0.0.0-20200429184054-15c2290dcb37
	golang.org/x/term v0.0.0-20201126162022-7de9c90e9dd1
)

require (
	github.com/alecthomas/gometalinter v2.0.11+incompatible // indirect
	github.com/alecthomas/units v0.0.0-20190717042225-c3de453c63f4 // indirect
	github.com/chzyer/readline v0.0.0-20180603132655-2972be24d48e // indirect
	github.com/client9/misspell v0.3.4 // indirect
	github.com/fatih/color v1.13.0 // indirect
	github.com/felixge/httpsnoop v1.0.1 // indirect
	github.com/golang/lint v0.0.0-20181026193005-c67002cb31c3 // indirect
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/gordonklaus/ineffassign v0.0.0-20180909121442-1003c8bd00dc // indirect
	github.com/gorilla/websocket v1.4.2 // indirect
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.5.0 // indirect
	github.com/inconshreveable/mousetrap v1.0.0 // indirect
	github.com/juju/ansiterm v0.0.0-20180109212912-720a0952cc2a // indirect
	github.com/lunixbochs/vtclean v0.0.0-20180621232353-2d01aacdc34a // indirect
	github.com/mattn/go-colorable v0.1.12 // indirect
	github.com/mattn/go-isatty v0.0.14 // indirect
	github.com/pelletier/go-toml v1.9.4 // indirect
	github.com/rodaine/table v1.0.1 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	github.com/tsenart/deadcode v0.0.0-20160724212837-210d2dc333e9 // indirect
	golang.org/x/lint v0.0.0-20210508222113-6edffad5e616 // indirect
	golang.org/x/net v0.0.0-20210813160813-60bc85c4be6d // indirect
	golang.org/x/text v0.3.7 // indirect
	golang.org/x/tools v0.1.5 // indirect
	google.golang.org/genproto v0.0.0-20211208223120-3a66f561d7aa // indirect
	google.golang.org/protobuf v1.27.1 // indirect
)

replace github.com/gitpod-io/gitpod/gitpod-protocol => ../gitpod-protocol/go // leeway

replace github.com/gitpod-io/gitpod/supervisor/api => ../supervisor-api/go // leeway
