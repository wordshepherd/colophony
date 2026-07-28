from enum import Enum


class CastSubmissionVoteResponse201Decision(str, Enum):
    ACCEPT = "ACCEPT"
    MAYBE = "MAYBE"
    REJECT = "REJECT"

    def __str__(self) -> str:
        return str(self.value)
