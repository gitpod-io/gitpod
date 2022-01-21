# Generate SSL Certificates and CA

```
openssl genrsa -DES-EDE3-CBC -out ca2.key 4096
openssl req -x509 -new -nodes -key ca.key -sha256 -days 10240 -out ca.crt -subj "/C=US/ST=Oregon/L=Portland/O=Company Name/OU=Org/CN=www.example.com"
openssl genrsa -out client.key 2048
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out client.crt -days 5000 -sha256
```
