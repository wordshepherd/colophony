from enum import Enum


class ListWebhookDeliveriesResponse200ItemsItemStatus(str, Enum):
    CANCELLED = "CANCELLED"
    DELIVERED = "DELIVERED"
    DELIVERING = "DELIVERING"
    FAILED = "FAILED"
    QUEUED = "QUEUED"

    def __str__(self) -> str:
        return str(self.value)
