from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.create_organization_invitation_body_roles_item import CreateOrganizationInvitationBodyRolesItem
from ..types import UNSET, Unset

T = TypeVar("T", bound="CreateOrganizationInvitationBody")


@_attrs_define
class CreateOrganizationInvitationBody:
    """
    Attributes:
        email (str): Email address to invite
        roles (list[CreateOrganizationInvitationBodyRolesItem]): Roles to assign on acceptance
        expires_in_days (int | Unset): Days until invitation expires (1-30, default 7) Default: 7.
    """

    email: str
    roles: list[CreateOrganizationInvitationBodyRolesItem]
    expires_in_days: int | Unset = 7
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        email = self.email

        roles = []
        for roles_item_data in self.roles:
            roles_item = roles_item_data.value
            roles.append(roles_item)

        expires_in_days = self.expires_in_days

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "email": email,
                "roles": roles,
            }
        )
        if expires_in_days is not UNSET:
            field_dict["expiresInDays"] = expires_in_days

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        email = d.pop("email")

        roles = []
        _roles = d.pop("roles")
        for roles_item_data in _roles:
            roles_item = CreateOrganizationInvitationBodyRolesItem(roles_item_data)

            roles.append(roles_item)

        expires_in_days = d.pop("expiresInDays", UNSET)

        create_organization_invitation_body = cls(
            email=email,
            roles=roles,
            expires_in_days=expires_in_days,
        )

        create_organization_invitation_body.additional_properties = d
        return create_organization_invitation_body

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
