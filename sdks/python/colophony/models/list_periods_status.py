from enum import Enum

class ListPeriodsStatus(str, Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    UPCOMING = "UPCOMING"

    def __str__(self) -> str:
        return str(self.value)
