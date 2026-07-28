from enum import Enum


class ListPeriodsResponse200ItemsItemBlindReviewMode(str, Enum):
    DOUBLE_BLIND = "double_blind"
    NONE = "none"
    SINGLE_BLIND = "single_blind"

    def __str__(self) -> str:
        return str(self.value)
