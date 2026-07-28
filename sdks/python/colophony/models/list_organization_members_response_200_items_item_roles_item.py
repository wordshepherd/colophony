from enum import Enum


class ListOrganizationMembersResponse200ItemsItemRolesItem(str, Enum):
    ADMIN = "ADMIN"
    BUSINESS_OPS = "BUSINESS_OPS"
    EDITOR = "EDITOR"
    PRODUCTION = "PRODUCTION"
    READER = "READER"

    def __str__(self) -> str:
        return str(self.value)
