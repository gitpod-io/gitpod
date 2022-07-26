##
# Terraform AWS reference architecture
#

.PHONY: init
init:
	@terraform init

.PHONY: plan
plan: plan-cluster plan-cm-edns

.PHONY: apply
apply: apply-cluster apply-tools

.PHONY: destroy
destroy: destroy-tools destroy-cluster

.PHONY: output
output:
	@terraform output -json

.PHONY: plan-cluster
plan-cluster:
	@terraform plan -target=module.eks

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
	@terraform apply -target=module.eks --auto-approve

.PHONY: apply-tools
apply-tools: install-cm-edns install-cluster-issuer

.PHONY: install-cm-edns
install-cm-edns:
	@terraform apply -target=module.certmanager -target=module.externaldns --auto-approve

.PHONY: install-cluster-issuer
install-cluster-issuer:
	@terraform apply -target=module.externaldns  --auto-approve

.PHONY: destroy-cluster
destroy-cluster:
	@terraform destroy -target=module.gke --auto-approve

.PHONY: destroy-tools
destroy-tools: destroy-cluster-issuer destroy-cm-edns

.PHONY: destroy-cm-edns
destroy-cm-edns:
	@terraform destroy -target=module.certmanager  -target=module.externaldns --auto-approve

.PHONY: destroy-cluster-issuer
destroy-cluster-issuer:
	@terraform destroy -target=module.cluster-issuer  --auto-approve

# end
