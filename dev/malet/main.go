package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"time"

	chclient "github.com/jpillora/chisel/client"
	chserver "github.com/jpillora/chisel/server"
	"github.com/urfave/cli/v2"
)

func main() {
	app := &cli.App{
		Name: "malet",
		Commands: []*cli.Command{
			{
				Name: "serve",
				Action: func(c *cli.Context) error {
					return serve()
				},
			},
			{
				Name:      "client",
				ArgsUsage: "<URL>",
				Action: func(c *cli.Context) error {
					if !c.Args().Present() {
						return fmt.Errorf("missing address")
					}
					return client(c.Args().First())
				},
			},
		},
	}
	app.RunAndExitOnError()
}

func serve() error {
	cfg := &chserver.Config{
		Proxy:   fmt.Sprintf("http://%s", os.Getenv("SUPERVISOR_ADDR")),
		Reverse: true,
	}
	srv, err := chserver.NewServer(cfg)
	if err != nil {
		return err
	}

	url, _ := exec.Command("gp", "url", "11111").CombinedOutput()
	fmt.Printf("\n\nrun:\n\tmalet client %s\n", string(url))

	return srv.Run("0.0.0.0", "11111")
}

func client(addr string) error {
	r := make(chan []string, 5)
	go controlRemotes(addr, r)
	go readRemotes(addr, r)
	<-make(chan struct{})
	return nil
}

func controlRemotes(addr string, remotes <-chan []string) error {
	var (
		ctx    context.Context
		cancel context.CancelFunc
		schan  = make(chan struct{}, 1)
		r      []string
	)
	for {
		select {
		case r = <-remotes:
			if r == nil {
				return nil
			}
			schan <- struct{}{}
		case <-schan:
			if cancel != nil {
				cancel()
			}

			ctx, cancel = context.WithCancel(context.Background())
			go func() {
				clnt, err := chclient.NewClient(&chclient.Config{
					Server:  addr,
					Remotes: r,
				})
				if err != nil {
					fmt.Printf("remotes error: %v\n", err)
					return
				}
				err = clnt.Start(ctx)
				if err != nil {
					time.Sleep(2 * time.Second)
					schan <- struct{}{}
					fmt.Printf("error: %v\n", err)
					return
				}
			}()
		}
	}
}

func readRemotes(addr string, r chan<- []string) {
	for {
		resp, err := http.Get(fmt.Sprintf("%s/_supervisor/v1/status/ports/observe/true", addr))
		if err != nil {
			fmt.Printf("cannot read remotes: %v\n", err)
			time.Sleep(2 * time.Second)
			continue
		}
		defer resp.Body.Close()

		type Port struct {
			Local   int  `json:"localPort"`
			Global  int  `json:"globalPort"`
			Served  bool `json:"served"`
			Exposed struct {
				Visibility string `json:"visibility"`
			} `json:"exposed"`
		}

		var (
			rd = bufio.NewReader(resp.Body)
			l  []byte
		)
		for l, _, err = rd.ReadLine(); err == nil; l, _, err = rd.ReadLine() {
			var prts struct {
				R struct {
					Port []Port `json:"ports"`
				} `json:"result"`
			}
			err := json.Unmarshal(l, &prts)
			if err != nil {
				fmt.Printf("cannot parse ports: %v\n", err)
				continue
			}

			var remotes []string
			for _, p := range prts.R.Port {
				if !p.Served {
					continue
				}
				if p.Local == 11111 {
					continue
				}
				if p.Exposed.Visibility != "public" {
					continue
				}

				remotes = append(remotes, fmt.Sprint(p.Local))
			}

			r <- remotes
		}
	}
}
