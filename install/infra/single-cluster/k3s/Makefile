##
# Terraform AWS reference architecture
#

.PHONY: init
init:
	@terraform init

touch-kubeconfig:
	@touch kubeconfig

cleanup-kubeconfig:
	@rm kubeconfig

.PHONY: plan
plan: touch-kubeconfig plan-cluster plan-cm-edns cleanup-kubeconfig

.PHONY: apply
apply: apply-cluster apply-tools

.PHONY: destroy
destroy: destroy-tools destroy-cluster

.PHONY: refresh
refresh:
	@echo "Refreshing terraform state"
	@terraform refresh
	@echo ""
	@echo "Done!"

.PHONY: output
output: refresh output-done-msg output-url output-nameservers output-registry output-database output-storage output-issuer

output-done-msg:
	@echo ""
	@echo ""
	@echo "=========================="
	@echo "🎉🥳🔥🧡🚀"
	@echo "Your cloud infrastructure is ready to install Gitpod. Please visit"
	@echo "https://www.gitpod.io/docs/self-hosted/latest/getting-started#step-4-install-gitpod"
	@echo "for your next steps."
	@echo "================="
	@echo "Config Parameters"
	@echo "================="

output-url:
	@echo ""
	@echo "Gitpod domain name:"
	@echo "================="
	@terraform output -json url | jq

output-nameservers:
	@echo ""
	@echo "Nameservers for the domain(to be added as NS records in your domain provider):"
	@echo "================="
	@terraform output -json nameservers | jq

output-storage:
	@echo ""
	@echo "Object storage:"
	@echo "=============="
	@terraform output -json storage | jq

output-registry:
	@echo ""
	@echo "GCR registry:"
	@echo "=================="
	@terraform output -json registry | jq

output-database:
	@echo ""
	@echo "Database:"
	@echo "========"
	@echo "Tick the option 'Use Google Cloud SQL Proxy' if using this database"
	@terraform output -json database | jq
	@echo ""

output-issuer:
	@echo ""
	@echo "ClusterIssuer name:"
	@echo "================="
	@terraform output -json cluster_issuer | jq

.PHONY: plan-cluster
plan-cluster:
	@terraform plan -target=module.k3s

.PHONY: plan-tools
plan-tools: plan-cm-edns plan-cluster-issuer

.PHONY: plan-cm-edns
plan-cm-edns:
	@terraform plan -target=module.certmanager -target=module.externaldns

.PHONY: plan-cluster-issuer
plan-cluster-issuer:
	@terraform plan -target=module.cluster-issuer

.PHONY: apply-cluster
apply-cluster:
	@terraform apply -target=module.k3s --auto-approve

.PHONY: apply-tools
apply-tools: install-cm-edns install-cluster-issuer

.PHONY: install-cm-edns
install-cm-edns:
	@terraform apply -target=module.certmanager -target=module.externaldns --auto-approve

.PHONY: install-cluster-issuer
install-cluster-issuer:
	@terraform apply -target=module.cluster-issuer  --auto-approve

.PHONY: destroy-cluster
destroy-cluster:
	@terraform destroy -target=module.k3s --auto-approve

.PHONY: destroy-tools
destroy-tools: destroy-cluster-issuer destroy-cm-edns

.PHONY: destroy-cm-edns
destroy-cm-edns:
	@terraform destroy -target=module.certmanager  -target=module.externaldns --auto-approve

.PHONY: destroy-cluster-issuer
destroy-cluster-issuer:
	@terraform destroy -target=module.cluster-issuer  --auto-approve || echo "Could not remove cluster-issuer"

# end
