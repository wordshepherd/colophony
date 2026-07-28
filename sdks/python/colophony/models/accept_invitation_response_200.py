from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.accept_invitation_response_200_roles_item import AcceptInvitationResponse200RolesItem

T = TypeVar("T", bound="AcceptInvitationResponse200")


@_attrs_define
class AcceptInvitationResponse200:
    """
    Attributes:
        invitation_id (UUID):
        organization_id (UUID):
        member_id (UUID):
        roles (list[AcceptInvitationResponse200RolesItem]): Roles assigned to an organization member
    """

    invitation_id: UUID
    organization_id: UUID
    member_id: UUID
    roles: list[AcceptInvitationResponse200RolesItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        invitation_id = str(self.invitation_id)

        organization_id = str(self.organization_id)

        member_id = str(self.member_id)

        roles = []
        for roles_item_data in self.roles:
            roles_item = roles_item_data.value
            roles.append(roles_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "invitationId": invitation_id,
                "organizationId": organization_id,
                "memberId": member_id,
                "roles": roles,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        invitation_id = UUID(d.pop("invitationId"))

        organization_id = UUID(d.pop("organizationId"))

        member_id = UUID(d.pop("memberId"))

        roles = []
        _roles = d.pop("roles")
        for roles_item_data in _roles:
            roles_item = AcceptInvitationResponse200RolesItem(roles_item_data)

            roles.append(roles_item)

        accept_invitation_response_200 = cls(
            invitation_id=invitation_id,
            organization_id=organization_id,
            member_id=member_id,
            roles=roles,
        )

        accept_invitation_response_200.additional_properties = d
        return accept_invitation_response_200

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
