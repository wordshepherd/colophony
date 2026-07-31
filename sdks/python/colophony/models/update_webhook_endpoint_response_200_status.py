from enum import Enum


class UpdateWebhookEndpointResponse200Status(str, Enum):
    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"

    def __str__(self) -> str:
        return str(self.value)
