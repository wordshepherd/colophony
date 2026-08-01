from enum import Enum


class ListWebhookDeliveriesStatus(str, Enum):
    CANCELLED = "CANCELLED"
    DELIVERED = "DELIVERED"
    DELIVERING = "DELIVERING"
    FAILED = "FAILED"
    QUEUED = "QUEUED"

    def __str__(self) -> str:
        return str(self.value)
