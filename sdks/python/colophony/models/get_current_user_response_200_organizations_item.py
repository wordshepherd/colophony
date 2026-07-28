from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.get_current_user_response_200_organizations_item_roles_item import (
    GetCurrentUserResponse200OrganizationsItemRolesItem,
)

T = TypeVar("T", bound="GetCurrentUserResponse200OrganizationsItem")


@_attrs_define
class GetCurrentUserResponse200OrganizationsItem:
    """
    Attributes:
        id (UUID):
        name (str):
        slug (str):
        roles (list[GetCurrentUserResponse200OrganizationsItemRolesItem]): Roles assigned to an organization member
    """

    id: UUID
    name: str
    slug: str
    roles: list[GetCurrentUserResponse200OrganizationsItemRolesItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        slug = self.slug

        roles = []
        for roles_item_data in self.roles:
            roles_item = roles_item_data.value
            roles.append(roles_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "name": name,
                "slug": slug,
                "roles": roles,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))

        name = d.pop("name")

        slug = d.pop("slug")

        roles = []
        _roles = d.pop("roles")
        for roles_item_data in _roles:
            roles_item = GetCurrentUserResponse200OrganizationsItemRolesItem(roles_item_data)

            roles.append(roles_item)

        get_current_user_response_200_organizations_item = cls(
            id=id,
            name=name,
            slug=slug,
            roles=roles,
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
