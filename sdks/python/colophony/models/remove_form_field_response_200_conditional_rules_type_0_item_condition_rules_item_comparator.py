from enum import Enum

class RemoveFormFieldResponse200ConditionalRulesType0ItemConditionRulesItemComparator(str, Enum):
    CONTAINS = "contains"
    ENDS_WITH = "ends_with"
    EQ = "eq"
    GT = "gt"
    GTE = "gte"
    IN = "in"
    IS_EMPTY = "is_empty"
    IS_NOT_EMPTY = "is_not_empty"
    LT = "lt"
    LTE = "lte"
    NEQ = "neq"
    NOT_CONTAINS = "not_contains"
    NOT_IN = "not_in"
    STARTS_WITH = "starts_with"

    def __str__(self) -> str:
        return str(self.value)
