from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.update_organization_member_roles_body_roles_item import UpdateOrganizationMemberRolesBodyRolesItem

T = TypeVar("T", bound="UpdateOrganizationMemberRolesBody")


@_attrs_define
class UpdateOrganizationMemberRolesBody:
    """
    Attributes:
        roles (list[UpdateOrganizationMemberRolesBodyRolesItem]): Roles assigned to an organization member
    """

    roles: list[UpdateOrganizationMemberRolesBodyRolesItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        roles = []
        for roles_item_data in self.roles:
            roles_item = roles_item_data.value
            roles.append(roles_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "roles": roles,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        roles = []
        _roles = d.pop("roles")
        for roles_item_data in _roles:
            roles_item = UpdateOrganizationMemberRolesBodyRolesItem(roles_item_data)

            roles.append(roles_item)

        update_organization_member_roles_body = cls(
            roles=roles,
        )

        update_organization_member_roles_body.additional_properties = d
        return update_organization_member_roles_body

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
