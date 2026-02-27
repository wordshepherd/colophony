from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.get_current_user_response_200_organizations_item import GetCurrentUserResponse200OrganizationsItem





T = TypeVar("T", bound="GetCurrentUserResponse200")



@_attrs_define
class GetCurrentUserResponse200:
    """ 
        Attributes:
            id (UUID):
            email (str):
            email_verified (bool):
            created_at (datetime.datetime):
            organizations (list[GetCurrentUserResponse200OrganizationsItem]):
     """

    id: UUID
    email: str
    email_verified: bool
    created_at: datetime.datetime
    organizations: list[GetCurrentUserResponse200OrganizationsItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.get_current_user_response_200_organizations_item import GetCurrentUserResponse200OrganizationsItem
        id = str(self.id)

        email = self.email

        email_verified = self.email_verified

        created_at = self.created_at.isoformat()

        organizations = []
        for organizations_item_data in self.organizations:
            organizations_item = organizations_item_data.to_dict()
            organizations.append(organizations_item)




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "email": email,
            "emailVerified": email_verified,
            "createdAt": created_at,
            "organizations": organizations,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.get_current_user_response_200_organizations_item import GetCurrentUserResponse200OrganizationsItem
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        email = d.pop("email")

        email_verified = d.pop("emailVerified")

        created_at = isoparse(d.pop("createdAt"))




        organizations = []
        _organizations = d.pop("organizations")
        for organizations_item_data in (_organizations):
            organizations_item = GetCurrentUserResponse200OrganizationsItem.from_dict(organizations_item_data)



            organizations.append(organizations_item)


        get_current_user_response_200 = cls(
            id=id,
            email=email,
            email_verified=email_verified,
            created_at=created_at,
            organizations=organizations,
        )


        get_current_user_response_200.additional_properties = d
        return get_current_user_response_200

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
