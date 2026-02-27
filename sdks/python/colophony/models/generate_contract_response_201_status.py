from enum import Enum

class GenerateContractResponse201Status(str, Enum):
    COMPLETED = "COMPLETED"
    COUNTERSIGNED = "COUNTERSIGNED"
    DRAFT = "DRAFT"
    SENT = "SENT"
    SIGNED = "SIGNED"
    VIEWED = "VIEWED"
    VOIDED = "VOIDED"

    def __str__(self) -> str:
        return str(self.value)
