from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.list_organization_members_response_200_items_item_roles_item import (
    ListOrganizationMembersResponse200ItemsItemRolesItem,
)

T = TypeVar("T", bound="ListOrganizationMembersResponse200ItemsItem")


@_attrs_define
class ListOrganizationMembersResponse200ItemsItem:
    """
    Attributes:
        id (UUID): Membership record ID
        user_id (UUID): ID of the member user
        email (str): Email address of the member
        roles (list[ListOrganizationMembersResponse200ItemsItemRolesItem]): Roles assigned to an organization member
        created_at (datetime.datetime): When the member was added
    """

    id: UUID
    user_id: UUID
    email: str
    roles: list[ListOrganizationMembersResponse200ItemsItemRolesItem]
    created_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        user_id = str(self.user_id)

        email = self.email

        roles = []
        for roles_item_data in self.roles:
            roles_item = roles_item_data.value
            roles.append(roles_item)

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "userId": user_id,
                "email": email,
                "roles": roles,
                "createdAt": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))

        user_id = UUID(d.pop("userId"))

        email = d.pop("email")

        roles = []
        _roles = d.pop("roles")
        for roles_item_data in _roles:
            roles_item = ListOrganizationMembersResponse200ItemsItemRolesItem(roles_item_data)

            roles.append(roles_item)

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        list_organization_members_response_200_items_item = cls(
            id=id,
            user_id=user_id,
            email=email,
            roles=roles,
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
