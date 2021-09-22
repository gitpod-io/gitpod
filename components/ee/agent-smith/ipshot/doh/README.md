# doh

> DNS over HTTPS client

Motivation for using DOH over the node's name resolution: if someone found a way to modify the name resolution on the node, they could change the way we reoslve those IPs and avoid detection or do harm. Also, DOH is more secure compared to DNS by virtue of TLS.