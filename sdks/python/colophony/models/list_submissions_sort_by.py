from enum import Enum


class ListSubmissionsSortBy(str, Enum):
    CREATEDAT = "createdAt"
    STATUS = "status"
    SUBMITTEDAT = "submittedAt"
    SUBMITTEREMAIL = "submitterEmail"
    TITLE = "title"

    def __str__(self) -> str:
        return str(self.value)
