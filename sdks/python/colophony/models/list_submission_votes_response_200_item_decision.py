from enum import Enum


class ListSubmissionVotesResponse200ItemDecision(str, Enum):
    ACCEPT = "ACCEPT"
    MAYBE = "MAYBE"
    REJECT = "REJECT"

    def __str__(self) -> str:
        return str(self.value)
