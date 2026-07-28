from enum import Enum


class ImportCsrBodyCorrespondenceItemDirection(str, Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"

    def __str__(self) -> str:
        return str(self.value)
