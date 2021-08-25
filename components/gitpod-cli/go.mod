module github.com/gitpod-io/gitpod/gitpod-cli

go 1.16

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
	github.com/spf13/cobra v1.1.3
	golang.org/x/sys v0.0.0-20210510120138-977fb7262007
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1
	google.golang.org/grpc v1.39.1
	gopkg.in/alecthomas/kingpin.v3-unstable v3.0.0-20191105091915-95d230a53780 // indirect
	gopkg.in/yaml.v2 v2.4.0
)

replace github.com/gitpod-io/gitpod/gitpod-protocol => ../gitpod-protocol/go // leeway

replace github.com/gitpod-io/gitpod/supervisor/api => ../supervisor-api/go // leeway
