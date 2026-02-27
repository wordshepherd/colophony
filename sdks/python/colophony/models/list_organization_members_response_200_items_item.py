from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_organization_members_response_200_items_item_role import ListOrganizationMembersResponse200ItemsItemRole
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="ListOrganizationMembersResponse200ItemsItem")



@_attrs_define
class ListOrganizationMembersResponse200ItemsItem:
    """ 
        Attributes:
            id (UUID): Membership record ID
            user_id (UUID): ID of the member user
            email (str): Email address of the member
            role (ListOrganizationMembersResponse200ItemsItemRole): Member role within an organization
            created_at (datetime.datetime): When the member was added
     """

    id: UUID
    user_id: UUID
    email: str
    role: ListOrganizationMembersResponse200ItemsItemRole
    created_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        user_id = str(self.user_id)

        email = self.email

        role = self.role.value

        created_at = self.created_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "userId": user_id,
            "email": email,
            "role": role,
            "createdAt": created_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        user_id = UUID(d.pop("userId"))




        email = d.pop("email")

        role = ListOrganizationMembersResponse200ItemsItemRole(d.pop("role"))




        created_at = isoparse(d.pop("createdAt"))




        list_organization_members_response_200_items_item = cls(
            id=id,
            user_id=user_id,
            email=email,
            role=role,
            created_at=created_at,
        )


        list_organization_members_response_200_items_item.additional_properties = d
        return list_organization_members_response_200_items_item

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
