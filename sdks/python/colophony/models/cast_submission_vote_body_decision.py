from enum import Enum


class CastSubmissionVoteBodyDecision(str, Enum):
    ACCEPT = "ACCEPT"
    MAYBE = "MAYBE"
    REJECT = "REJECT"

    def __str__(self) -> str:
        return str(self.value)
