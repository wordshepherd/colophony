from enum import Enum


class DeleteCollectionResponse200TypeHint(str, Enum):
    COMPARISON = "comparison"
    CUSTOM = "custom"
    HOLDS = "holds"
    ISSUE_PLANNING = "issue_planning"
    READING_LIST = "reading_list"

    def __str__(self) -> str:
        return str(self.value)
