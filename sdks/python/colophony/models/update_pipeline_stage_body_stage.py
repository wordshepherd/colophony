from enum import Enum

class UpdatePipelineStageBodyStage(str, Enum):
    AUTHOR_REVIEW = "AUTHOR_REVIEW"
    COPYEDIT_IN_PROGRESS = "COPYEDIT_IN_PROGRESS"
    COPYEDIT_PENDING = "COPYEDIT_PENDING"
    PROOFREAD = "PROOFREAD"
    PUBLISHED = "PUBLISHED"
    READY_TO_PUBLISH = "READY_TO_PUBLISH"
    WITHDRAWN = "WITHDRAWN"

    def __str__(self) -> str:
        return str(self.value)
