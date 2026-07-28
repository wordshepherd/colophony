from enum import Enum


class ImportCsrBodySubmissionsItemStatus(str, Enum):
    ACCEPTED = "accepted"
    DRAFT = "draft"
    HOLD = "hold"
    IN_REVIEW = "in_review"
    NO_RESPONSE = "no_response"
    REJECTED = "rejected"
    REVISE = "revise"
    SENT = "sent"
    UNKNOWN = "unknown"
    WITHDRAWN = "withdrawn"

    def __str__(self) -> str:
        return str(self.value)
