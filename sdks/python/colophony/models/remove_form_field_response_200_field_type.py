from enum import Enum

class RemoveFormFieldResponse200FieldType(str, Enum):
    CHECKBOX = "checkbox"
    CHECKBOX_GROUP = "checkbox_group"
    DATE = "date"
    EMAIL = "email"
    FILE_UPLOAD = "file_upload"
    INFO_TEXT = "info_text"
    MULTI_SELECT = "multi_select"
    NUMBER = "number"
    RADIO = "radio"
    RICH_TEXT = "rich_text"
    SECTION_HEADER = "section_header"
    SELECT = "select"
    TEXT = "text"
    TEXTAREA = "textarea"
    URL = "url"

    def __str__(self) -> str:
        return str(self.value)
