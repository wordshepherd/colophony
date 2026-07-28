from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.update_organization_member_roles_response_200_roles_item import (
    UpdateOrganizationMemberRolesResponse200RolesItem,
)

T = TypeVar("T", bound="UpdateOrganizationMemberRolesResponse200")


@_attrs_define
class UpdateOrganizationMemberRolesResponse200:
    """
    Attributes:
        id (UUID): Membership record ID
        organization_id (UUID): ID of the organization
        user_id (UUID): ID of the member user
        roles (list[UpdateOrganizationMemberRolesResponse200RolesItem]): Roles assigned to an organization member
        created_at (datetime.datetime): When the membership was created
        updated_at (datetime.datetime): When the membership was last updated
    """

    id: UUID
    organization_id: UUID
    user_id: UUID
    roles: list[UpdateOrganizationMemberRolesResponse200RolesItem]
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        organization_id = str(self.organization_id)

        user_id = str(self.user_id)

        roles = []
        for roles_item_data in self.roles:
            roles_item = roles_item_data.value
            roles.append(roles_item)

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "organizationId": organization_id,
                "userId": user_id,
                "roles": roles,
                "createdAt": created_at,
                "updatedAt": updated_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))

        organization_id = UUID(d.pop("organizationId"))

        user_id = UUID(d.pop("userId"))

        roles = []
        _roles = d.pop("roles")
        for roles_item_data in _roles:
            roles_item = UpdateOrganizationMemberRolesResponse200RolesItem(roles_item_data)

            roles.append(roles_item)

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        updated_at = datetime.datetime.fromisoformat(d.pop("updatedAt"))

        update_organization_member_roles_response_200 = cls(
            id=id,
            organization_id=organization_id,
            user_id=user_id,
            roles=roles,
            created_at=created_at,
            updated_at=updated_at,
        )

        update_organization_member_roles_response_200.additional_properties = d
        return update_organization_member_roles_response_200

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
