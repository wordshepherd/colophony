from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.get_current_user_response_200_organizations_item_role import GetCurrentUserResponse200OrganizationsItemRole
from uuid import UUID






T = TypeVar("T", bound="GetCurrentUserResponse200OrganizationsItem")



@_attrs_define
class GetCurrentUserResponse200OrganizationsItem:
    """ 
        Attributes:
            id (UUID):
            name (str):
            slug (str):
            role (GetCurrentUserResponse200OrganizationsItemRole): Member role within an organization
     """

    id: UUID
    name: str
    slug: str
    role: GetCurrentUserResponse200OrganizationsItemRole
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        slug = self.slug

        role = self.role.value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "slug": slug,
            "role": role,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        slug = d.pop("slug")

        role = GetCurrentUserResponse200OrganizationsItemRole(d.pop("role"))




        get_current_user_response_200_organizations_item = cls(
            id=id,
            name=name,
            slug=slug,
            role=role,
        )


        get_current_user_response_200_organizations_item.additional_properties = d
        return get_current_user_response_200_organizations_item

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
