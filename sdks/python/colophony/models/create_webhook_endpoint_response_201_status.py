from enum import Enum


class CreateWebhookEndpointResponse201Status(str, Enum):
    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"

    def __str__(self) -> str:
        return str(self.value)
