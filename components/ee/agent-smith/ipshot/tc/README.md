# tc

Notice `CAP_NET_ADMIN` is required.

## Usage

```go
import ...

var l = logrus.New()

func init() {
	l.SetLevel(logrus.DebugLevel)
}

func main() {
	route, err := DiscoverDefaultGateway()
	if err != nil {
		l.WithError(err).Fatal("could not discover default gateway")
	}

	l.WithField("iface", route.Iface).Info("get default gateway")

	if err := Load("tcprova.bpf.o", route.Iface); err != nil {
		l.WithError(err).Fatalf("loading eBPF filter")
	}
}
```

