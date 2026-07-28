from enum import Enum


class ExportCsrResponse200CorrespondenceItemDirection(str, Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"

    def __str__(self) -> str:
        return str(self.value)
