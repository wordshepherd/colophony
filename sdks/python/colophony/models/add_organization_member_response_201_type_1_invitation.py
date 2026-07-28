from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar, cast
from uuid import UUID

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.add_organization_member_response_201_type_1_invitation_roles_item import (
    AddOrganizationMemberResponse201Type1InvitationRolesItem,
)
from ..models.add_organization_member_response_201_type_1_invitation_status import (
    AddOrganizationMemberResponse201Type1InvitationStatus,
)

T = TypeVar("T", bound="AddOrganizationMemberResponse201Type1Invitation")


@_attrs_define
class AddOrganizationMemberResponse201Type1Invitation:
    """
    Attributes:
        id (UUID): Invitation record ID
        organization_id (UUID): ID of the organization
        email (str): Invitee email address
        roles (list[AddOrganizationMemberResponse201Type1InvitationRolesItem]): Roles assigned to an organization member
        status (AddOrganizationMemberResponse201Type1InvitationStatus): Lifecycle status of an organization invitation
        token_prefix (str): Token prefix for identification
        invited_by (None | UUID): ID of the user who sent the invite (null if inviter was deleted)
        expires_at (datetime.datetime): When the invitation expires
        created_at (datetime.datetime): When the invitation was created
    """

    id: UUID
    organization_id: UUID
    email: str
    roles: list[AddOrganizationMemberResponse201Type1InvitationRolesItem]
    status: AddOrganizationMemberResponse201Type1InvitationStatus
    token_prefix: str
    invited_by: None | UUID
    expires_at: datetime.datetime
    created_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        organization_id = str(self.organization_id)

        email = self.email

        roles = []
        for roles_item_data in self.roles:
            roles_item = roles_item_data.value
            roles.append(roles_item)

        status = self.status.value

        token_prefix = self.token_prefix

        invited_by: None | str
        if isinstance(self.invited_by, UUID):
            invited_by = str(self.invited_by)
        else:
            invited_by = self.invited_by

        expires_at = self.expires_at.isoformat()

        created_at = self.created_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "organizationId": organization_id,
                "email": email,
                "roles": roles,
                "status": status,
                "tokenPrefix": token_prefix,
                "invitedBy": invited_by,
                "expiresAt": expires_at,
                "createdAt": created_at,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))

        organization_id = UUID(d.pop("organizationId"))

        email = d.pop("email")

        roles = []
        _roles = d.pop("roles")
        for roles_item_data in _roles:
            roles_item = AddOrganizationMemberResponse201Type1InvitationRolesItem(roles_item_data)

            roles.append(roles_item)

        status = AddOrganizationMemberResponse201Type1InvitationStatus(d.pop("status"))

        token_prefix = d.pop("tokenPrefix")

        def _parse_invited_by(data: object) -> None | UUID:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                invited_by_type_0 = UUID(data)

                return invited_by_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | UUID, data)

        invited_by = _parse_invited_by(d.pop("invitedBy"))

        expires_at = datetime.datetime.fromisoformat(d.pop("expiresAt"))

        created_at = datetime.datetime.fromisoformat(d.pop("createdAt"))

        add_organization_member_response_201_type_1_invitation = cls(
            id=id,
            organization_id=organization_id,
            email=email,
            roles=roles,
            status=status,
            token_prefix=token_prefix,
            invited_by=invited_by,
            expires_at=expires_at,
            created_at=created_at,
        )

        add_organization_member_response_201_type_1_invitation.additional_properties = d
        return add_organization_member_response_201_type_1_invitation

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
