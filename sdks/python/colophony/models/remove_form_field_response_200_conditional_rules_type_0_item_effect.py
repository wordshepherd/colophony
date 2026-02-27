from enum import Enum

class RemoveFormFieldResponse200ConditionalRulesType0ItemEffect(str, Enum):
    HIDE = "HIDE"
    REQUIRE = "REQUIRE"
    SHOW = "SHOW"

    def __str__(self) -> str:
        return str(self.value)
