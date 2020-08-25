MODULES := $(shell ls modules)

.PHONY: destroy
destroy:
	terraform destroy

.PHONY: apply
apply:
	terraform apply

.PHONY: fmt
fmt:
	for i in $(MODULES); do cd modules/$$i; terraform fmt; cd -; done 
	terraform fmt

.PHONY: debug-apply
debug-apply:
	TF_LOG=DEBUG terraform apply

.PHONY: debug-destroy
debug-destroy:
	TF_LOG=DEBUG terraform destroy

.PHONY: reconfigure
reconfigure:
	terraform init -reconfigure -backend-config=backend.hcl

.PHONY: refresh
refresh:
	terraform refresh

.PHONY: plan
plan:
	terraform plan

.PHONY: graph
graph:
	terraform graph -draw-cycles | dot -Tsvg > graph.svg

.PHONY: init
init:
	terraform init -backend-config=backend.hcl
