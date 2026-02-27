from enum import Enum

class CreateApiKeyBodyScopesItem(str, Enum):
    API_KEYSMANAGE = "api-keys:manage"
    API_KEYSREAD = "api-keys:read"
    AUDITREAD = "audit:read"
    CMSREAD = "cms:read"
    CMSWRITE = "cms:write"
    CONTRACTSREAD = "contracts:read"
    CONTRACTSWRITE = "contracts:write"
    FILESREAD = "files:read"
    FILESWRITE = "files:write"
    FORMSREAD = "forms:read"
    FORMSWRITE = "forms:write"
    ISSUESREAD = "issues:read"
    ISSUESWRITE = "issues:write"
    MANUSCRIPTSREAD = "manuscripts:read"
    MANUSCRIPTSWRITE = "manuscripts:write"
    ORGANIZATIONSREAD = "organizations:read"
    ORGANIZATIONSWRITE = "organizations:write"
    PAYMENTSREAD = "payments:read"
    PERIODSREAD = "periods:read"
    PERIODSWRITE = "periods:write"
    PIPELINEREAD = "pipeline:read"
    PIPELINEWRITE = "pipeline:write"
    PUBLICATIONSREAD = "publications:read"
    PUBLICATIONSWRITE = "publications:write"
    SUBMISSIONSREAD = "submissions:read"
    SUBMISSIONSWRITE = "submissions:write"
    USERSREAD = "users:read"
    WEBHOOKSMANAGE = "webhooks:manage"

    def __str__(self) -> str:
        return str(self.value)
