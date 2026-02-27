from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.create_organization_response_201_membership_role import CreateOrganizationResponse201MembershipRole
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="CreateOrganizationResponse201Membership")



@_attrs_define
class CreateOrganizationResponse201Membership:
    """ 
        Attributes:
            id (UUID):
            organization_id (UUID):
            user_id (UUID):
            role (CreateOrganizationResponse201MembershipRole): Member role within an organization
            created_at (datetime.datetime):
            updated_at (datetime.datetime):
     """

    id: UUID
    organization_id: UUID
    user_id: UUID
    role: CreateOrganizationResponse201MembershipRole
    created_at: datetime.datetime
    updated_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        organization_id = str(self.organization_id)

        user_id = str(self.user_id)

        role = self.role.value

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "organizationId": organization_id,
            "userId": user_id,
            "role": role,
            "createdAt": created_at,
            "updatedAt": updated_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        organization_id = UUID(d.pop("organizationId"))




        user_id = UUID(d.pop("userId"))




        role = CreateOrganizationResponse201MembershipRole(d.pop("role"))




        created_at = isoparse(d.pop("createdAt"))




        updated_at = isoparse(d.pop("updatedAt"))




        create_organization_response_201_membership = cls(
            id=id,
            organization_id=organization_id,
            user_id=user_id,
            role=role,
            created_at=created_at,
            updated_at=updated_at,
        )


        create_organization_response_201_membership.additional_properties = d
        return create_organization_response_201_membership

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
