package sshproxy

import (
	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/sirupsen/logrus"
	ssh "golang.org/x/crypto/ssh"
)

func handleChannel(conn *ssh.ServerConn, newChan ssh.NewChannel) {
	client, err := ssh.Dial("tcp", "127.0.0.1:22", &ssh.ClientConfig{
		User: "gitpod",
		Auth: []ssh.AuthMethod{
			ssh.Password("gitpod"),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
	})
	if err != nil {
		newChan.Reject(ssh.ConnectionFailed, err.Error())
		return
	}
	defer client.Close()
	log.Debug("client dialed")

	workspace, err := client.NewSession()
	if err != nil {
		newChan.Reject(ssh.ConnectionFailed, err.Error())
		return
	}
	log.Debug("new client session")

	incoming, reqs, err := newChan.Accept()
	if err != nil {
		log.Println("newChan.Accept failed:", err)
		return
	}
	log.Debug("channel accepted")

	for req := range reqs {
		log.WithFields(logrus.Fields{"type": req.Type, "wantreply": req.WantReply, "payload": req.Payload}).Debug("request")

		if req.Type != "shell" {
			ok, err := workspace.SendRequest(req.Type, req.WantReply, req.Payload)
			if err != nil {
				log.WithError(err).Warn("request failed")
			}
			if req.WantReply {
				req.Reply(ok, nil)
			}
			continue
		}

		go func(req *ssh.Request) {
			workspace.Stderr = incoming.Stderr()
			workspace.Stdout = incoming
			workspace.Stdin = incoming

			err = workspace.Shell()
			if err != nil {
				log.WithError(err).Error("cannot start shell")
				req.Reply(false, []byte(err.Error()))
				return
			}

			workspace.Wait()
			log.Debug("workspace wiat()")
			req.Reply(true, nil)

			incoming.Close()
		}(req)
	}
}
